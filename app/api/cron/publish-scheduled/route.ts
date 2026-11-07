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

    const extension = coverPath.split(".").pop() || "jpg";
    const publicPdfPath = `issues/${issue.issue_number}/edition.pdf`;
    const publicCoverPath = `issues/${issue.issue_number}/cover.${extension}`;
    const coverType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";

    const [pdfUpload, coverUpload] = await Promise.all([
      admin.storage.from("issue-public").upload(publicPdfPath, pdfResult.data, { contentType: "application/pdf", upsert: true }),
      admin.storage.from("issue-public").upload(publicCoverPath, coverResult.data, { contentType: coverType, upsert: true }),
    ]);
    if (pdfUpload.error || coverUpload.error) {
      // Keep any successfully copied object. A retry is idempotent (upsert),
      // while deleting a shared path here could remove another worker's asset.
      await releaseIssueClaim(issue.id);
      issuesFailed += 1;
      continue;
    }

    const pdfUrl = admin.storage.from("issue-public").getPublicUrl(publicPdfPath).data.publicUrl;
    const coverUrl = admin.storage.from("issue-public").getPublicUrl(publicCoverPath).data.publicUrl;
    const { data: published, error: publishError } = await admin
      .from("issues")
      .update({
        pdf_url: pdfUrl,
        cover_image_url: coverUrl,
        status: "published",
        scheduled_at: null,
        publish_claim_token: null,
        publish_claimed_at: null,
        updated_at: nowIso,
      })
      .eq("id", issue.id)
      .eq("status", "scheduled")
      .eq("publish_claim_token", claimToken)
      .lte("scheduled_at", nowIso)
      .select("id")
      .maybeSingle();

    if (publishError || !published) {
      // Preserve public objects on ambiguous/competing transitions. They may
      // already be referenced by a successful commit; a lease retry can safely
      // overwrite them after the claim expires or is released.
      await releaseIssueClaim(issue.id);
      issuesFailed += 1;
      continue;
    }

    await admin.storage.from("issue-drafts").remove([pdfPath, coverPath]);
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
