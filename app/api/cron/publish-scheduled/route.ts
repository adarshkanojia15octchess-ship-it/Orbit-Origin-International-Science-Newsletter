import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") || "";
  if (!secret || !supplied.startsWith("Bearer ")) return false;
  const expectedBytes = Buffer.from(`Bearer ${secret}`);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const claimToken = randomUUID();
  const { data: issues, error: issueReadError } = await admin.rpc(
    "claim_due_scheduled_issues",
    { p_claim_token: claimToken, p_now: nowIso, p_limit: 20 },
  );

  if (issueReadError) {
    return NextResponse.json({ error: "Could not load scheduled issues." }, { status: 500 });
  }

  let issuesPublished = 0;
  let issuesFailed = 0;

  async function releaseIssueClaim(issueId: string) {
    await admin.from("issues").update({
      publish_claim_token: null,
      publish_claimed_at: null,
    }).eq("id", issueId).eq("publish_claim_token", claimToken);
  }

  for (const issue of issues || []) {
    const prefix = `issues/${issue.issue_number}/`;
    const pdfPath = String(issue.pdf_url || "");
    const coverPath = String(issue.cover_image_url || "");
    if (!pdfPath.startsWith(prefix) || !coverPath.startsWith(prefix)) {
      await releaseIssueClaim(issue.id);
      issuesFailed += 1;
      continue;
    }

    const [pdfResult, coverResult] = await Promise.all([
      admin.storage.from("issue-drafts").download(pdfPath),
      admin.storage.from("issue-drafts").download(coverPath),
    ]);
    if (pdfResult.error || !pdfResult.data || coverResult.error || !coverResult.data) {
      await releaseIssueClaim(issue.id);
      issuesFailed += 1;
      continue;
    }

    const operationId = randomUUID();
    const extension = coverPath.split(".").pop() || "jpg";
    const operationPrefix = `issues/${issue.issue_number}/published/${operationId}`;
    const publicPdfPath = `${operationPrefix}/edition.pdf`;
    const publicCoverPath = `${operationPrefix}/cover.${extension}`;
    const coverType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";

    const { data: currentIssue, error: currentIssueError } = await admin
      .from("issues")
      .select("updated_at, status, publish_claim_token")
      .eq("id", issue.id)
      .eq("status", "scheduled")
      .eq("publish_claim_token", claimToken)
      .maybeSingle();
    if (currentIssueError || !currentIssue) {
      await releaseIssueClaim(issue.id);
      issuesFailed += 1;
      continue;
    }

    const pdfUrl = admin.storage.from("issue-public").getPublicUrl(publicPdfPath).data.publicUrl;
    const coverUrl = admin.storage.from("issue-public").getPublicUrl(publicCoverPath).data.publicUrl;
    const { data: startedOperation, error: startOperationError } = await admin.rpc(
      "begin_publication_operation",
      {
        p_operation_id: operationId,
        p_issue_id: issue.id,
        p_operation_kind: "scheduled_publish",
        p_source_status: "scheduled",
        p_source_pdf_url: pdfPath,
        p_source_cover_url: coverPath,
        p_source_updated_at: currentIssue.updated_at,
        p_target_pdf_path: publicPdfPath,
        p_target_cover_path: publicCoverPath,
        p_target_pdf_url: pdfUrl,
        p_target_cover_url: coverUrl,
        p_claim_token: claimToken,
        p_lease_seconds: 600,
      },
    );
    let operationStarted = !startOperationError && startedOperation === operationId;
    if (!operationStarted) {
      const { data: operationRows } = await admin.rpc(
        "read_publication_operation",
        { p_operation_id: operationId },
      );
      operationStarted = operationRows?.[0]?.state === "active";
    }
    if (!operationStarted) {
      await releaseIssueClaim(issue.id);
      issuesFailed += 1;
      continue;
    }

    const [pdfUpload, coverUpload] = await Promise.all([
      admin.storage.from("issue-public").upload(publicPdfPath, pdfResult.data, { contentType: "application/pdf", upsert: true }),
      admin.storage.from("issue-public").upload(publicCoverPath, coverResult.data, { contentType: coverType, upsert: true }),
    ]);
    if (pdfUpload.error || coverUpload.error) {
      // Record the failed attempt and preserve any partial operation-owned
      // objects for later ownership-checked reconciliation.
      await admin.rpc("fail_publication_operation", {
        p_operation_id: operationId,
        p_failure_reason: "One or more public asset uploads failed",
      });
      await releaseIssueClaim(issue.id);
      issuesFailed += 1;
      continue;
    }

    const [pdfVerification, coverVerification] = await Promise.all([
      admin.storage.from("issue-public").download(publicPdfPath),
      admin.storage.from("issue-public").download(publicCoverPath),
    ]);
    if (
      pdfVerification.error || !pdfVerification.data ||
      coverVerification.error || !coverVerification.data ||
      pdfVerification.data.size !== pdfResult.data.size ||
      coverVerification.data.size !== coverResult.data.size
    ) {
      await admin.rpc("fail_publication_operation", {
        p_operation_id: operationId,
        p_failure_reason: "Uploaded asset verification failed",
      });
      await releaseIssueClaim(issue.id);
      issuesFailed += 1;
      continue;
    }

    const { data: completed, error: completeError } = await admin.rpc(
      "complete_publication_operation",
      { p_operation_id: operationId },
    );
    let operationCommitted = !completeError && completed === true;
    if (!operationCommitted) {
      // Resolve a lost RPC response from the durable operation record before
      // treating the uploaded assets as abandoned.
      const { data: operationRows } = await admin.rpc(
        "read_publication_operation",
        { p_operation_id: operationId },
      );
      operationCommitted = operationRows?.[0]?.state === "committed";
    }
    if (!operationCommitted) {
      await admin.rpc("fail_publication_operation", {
        p_operation_id: operationId,
        p_failure_reason: completeError?.message || "Conditional scheduled publication did not commit",
      });
      const { data: finalOperationRows } = await admin.rpc(
        "read_publication_operation",
        { p_operation_id: operationId },
      );
      operationCommitted = finalOperationRows?.[0]?.state === "committed";
    }
    if (!operationCommitted) {
      await releaseIssueClaim(issue.id);
      issuesFailed += 1;
      continue;
    }

    const sourceCleanup = await admin.storage.from("issue-drafts").remove([pdfPath, coverPath]);
    if (!sourceCleanup.error) {
      await admin.rpc("mark_publication_source_assets_cleaned", {
        p_operation_id: operationId,
      });
    }
    issuesPublished += 1;
  }

  const { data: dueArticles, error: articleReadError } = await admin
    .from("articles")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(100);

  let articlesPublished = 0;
  let articlesFailed = 0;
  if (articleReadError) {
    articlesFailed += 1;
  } else {
    for (const article of dueArticles || []) {
      const { data, error } = await admin.from("articles").update({
        status: "published",
        published_at: nowIso,
        scheduled_at: null,
        updated_at: nowIso,
      }).eq("id", article.id).eq("status", "scheduled").lte("scheduled_at", nowIso).select("id").maybeSingle();
      if (error || !data) articlesFailed += 1;
      else articlesPublished += 1;
    }
  }

  if (issuesPublished || articlesPublished) {
    revalidatePath("/");
    revalidatePath("/issues");
    revalidatePath("/latest-issue");
    revalidatePath("/articles");
  }

  return NextResponse.json({
    issuesPublished,
    issuesFailed,
    articlesPublished,
    articlesFailed,
    checkedAt: nowIso,
  }, { status: issuesFailed || articlesFailed ? 207 : 200 });
}
