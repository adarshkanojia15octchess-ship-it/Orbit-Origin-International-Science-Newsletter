"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

const issueSchema = z.object({
  issue_number: z.coerce.number().int().positive().max(999999),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(2000),
  publication_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departments: z.array(z.enum(["tapestry-of-worlds", "frontier-tech", "universal-record"])).min(1),
});

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_COVER_BYTES = 8 * 1024 * 1024;

async function hasPrefix(file: File, prefix: number[]) {
  const bytes = new Uint8Array(await file.slice(0, prefix.length).arrayBuffer());
  return prefix.every((value, index) => bytes[index] === value);
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

export async function createIssue(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");

  const parsed = issueSchema.safeParse({
    issue_number: formData.get("issue_number"),
    title: formData.get("title"),
    description: formData.get("description"),
    publication_date: formData.get("publication_date"),
    departments: formData.getAll("departments"),
  });
  if (!parsed.success) redirect("/admin?error=details");

  const pdf = formData.get("pdf");
  const cover = formData.get("cover");
  if (!(pdf instanceof File) || pdf.size === 0 || pdf.size > MAX_PDF_BYTES || pdf.type !== "application/pdf" || !(await hasPrefix(pdf, [0x25, 0x50, 0x44, 0x46, 0x2d]))) {
    redirect("/admin?error=pdf");
  }
  if (!(cover instanceof File) || cover.size === 0 || cover.size > MAX_COVER_BYTES) {
    redirect("/admin?error=cover");
  }

  const validCover = (
    (cover.type === "image/jpeg" && await hasPrefix(cover, [0xff, 0xd8, 0xff])) ||
    (cover.type === "image/png" && await hasPrefix(cover, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (cover.type === "image/webp" && await hasPrefix(cover, [0x52, 0x49, 0x46, 0x46]))
  );
  if (!validCover) redirect("/admin?error=cover");

  const { supabase } = context;
  const issueNumber = parsed.data.issue_number;
  const basePath = `issues/${issueNumber}/${randomUUID()}`;
  const pdfPath = `${basePath}.pdf`;
  const coverExtension = cover.type === "image/png" ? "png" : cover.type === "image/webp" ? "webp" : "jpg";
  const coverPath = `${basePath}-cover.${coverExtension}`;

  const pdfUpload = await supabase.storage.from("issue-drafts").upload(pdfPath, pdf, { contentType: "application/pdf", upsert: false });
  if (pdfUpload.error) redirect("/admin?error=upload");
  const coverUpload = await supabase.storage.from("issue-drafts").upload(coverPath, cover, { contentType: cover.type, upsert: false });
  if (coverUpload.error) {
    await supabase.storage.from("issue-drafts").remove([pdfPath]);
    redirect("/admin?error=upload");
  }

  const slug = `${String(issueNumber).padStart(3, "0")}-${slugify(parsed.data.title)}`;

  const { error } = await supabase.from("issues").insert({
    issue_number: issueNumber,
    title: parsed.data.title,
    slug,
    description: parsed.data.description,
    publication_date: parsed.data.publication_date,
    departments: parsed.data.departments,
    pdf_url: pdfPath,
    cover_image_url: coverPath,
    status: "draft",
  });

  if (error) {
    await supabase.storage.from("issue-drafts").remove([pdfPath, coverPath]);
    redirect(error.code === "23505" ? "/admin?error=duplicate" : "/admin?error=save");
  }

  revalidatePath("/");
  revalidatePath("/issues");
  redirect("/admin?created=1");
}

export async function publishIssue(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const id = String(formData.get("issue_id") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin?error=issue");

  const supabase = createAdminClient();
  const { data: issue, error: readError } = await supabase
    .from("issues")
    .select("id, issue_number, pdf_url, cover_image_url, status, updated_at")
    .eq("id", id)
    .in("status", ["draft", "scheduled"])
    .maybeSingle();

  if (readError || !issue || !issue.pdf_url || !issue.cover_image_url) {
    redirect("/admin?error=issue");
  }

  const pdfPath = String(issue.pdf_url);
  const coverPath = String(issue.cover_image_url);
  const expectedPrefix = `issues/${issue.issue_number}/`;
  if (!pdfPath.startsWith(expectedPrefix) || !coverPath.startsWith(expectedPrefix)) {
    redirect("/admin?error=issue");
  }

  const { data: pdfFile, error: pdfReadError } = await supabase.storage.from("issue-drafts").download(pdfPath);
  if (pdfReadError || !pdfFile) redirect("/admin?error=publish-assets");
  const { data: coverFile, error: coverReadError } = await supabase.storage.from("issue-drafts").download(coverPath);
  if (coverReadError || !coverFile) redirect("/admin?error=publish-assets");

  const publicationOperation = randomUUID();
  const publicPrefix = `issues/${issue.issue_number}/published/${publicationOperation}`;
  const pdfPublicPath = `${publicPrefix}/edition.pdf`;
  const coverExtension = coverPath.split(".").pop() || "jpg";
  const coverPublicPath = `${publicPrefix}/cover.${coverExtension}`;

  const pdfUrl = supabase.storage.from("issue-public").getPublicUrl(pdfPublicPath).data.publicUrl;
  const coverUrl = supabase.storage.from("issue-public").getPublicUrl(coverPublicPath).data.publicUrl;
  const { data: startedOperation, error: startOperationError } = await supabase.rpc(
    "begin_publication_operation",
    {
      p_operation_id: publicationOperation,
      p_issue_id: id,
      p_operation_kind: "manual_publish",
      p_source_status: issue.status,
      p_source_pdf_url: pdfPath,
      p_source_cover_url: coverPath,
      p_source_updated_at: issue.updated_at,
      p_target_pdf_path: pdfPublicPath,
      p_target_cover_path: coverPublicPath,
      p_target_pdf_url: pdfUrl,
      p_target_cover_url: coverUrl,
      p_claim_token: null,
      p_lease_seconds: 600,
    },
  );
  if (startOperationError || startedOperation !== publicationOperation) {
    redirect("/admin?error=publish-conflict");
  }

  const { error: pdfPublishError } = await supabase.storage
    .from("issue-public")
    .upload(pdfPublicPath, pdfFile, { contentType: "application/pdf", upsert: true });
  if (pdfPublishError) {
    await supabase.rpc("fail_publication_operation", { p_operation_id: publicationOperation, p_failure_reason: "PDF upload failed" });
    redirect("/admin?error=publish-assets");
  }

  const coverType = coverExtension === "png" ? "image/png" : coverExtension === "webp" ? "image/webp" : "image/jpeg";
  const { error: coverPublishError } = await supabase.storage
    .from("issue-public")
    .upload(coverPublicPath, coverFile, { contentType: coverType, upsert: true });
  if (coverPublishError) {
    await supabase.rpc("fail_publication_operation", { p_operation_id: publicationOperation, p_failure_reason: "Cover upload failed" });
    redirect("/admin?error=publish-assets");
  }

  const { data: completed, error: completeError } = await supabase.rpc(
    "complete_publication_operation",
    { p_operation_id: publicationOperation },
  );
  let operationCommitted = !completeError && completed === true;
  if (!operationCommitted) {
    // RPC responses can be lost after PostgreSQL commits. Read the durable
    // operation row before deciding whether the publication failed.
    const { data: operationRows } = await supabase.rpc(
      "read_publication_operation",
      { p_operation_id: publicationOperation },
    );
    operationCommitted = operationRows?.[0]?.state === "committed";
  }
  if (!operationCommitted) {
    await supabase.rpc("fail_publication_operation", {
      p_operation_id: publicationOperation,
      p_failure_reason: completeError?.message || "Conditional publication transition did not commit",
    });
    redirect("/admin?error=publish");
  }

  await supabase.storage.from("issue-drafts").remove([pdfPath, coverPath]);
  revalidatePath("/");
  revalidatePath("/issues");
  revalidatePath("/latest-issue");
  revalidatePath(`/issues/${issue.issue_number}`);
  redirect("/admin?published=1");
}


const issueEditSchema = z.object({
  issue_id: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(2000),
  publication_date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
});

export async function updateIssue(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const parsed = issueEditSchema.safeParse({
    issue_id: formData.get("issue_id"),
    title: formData.get("title"),
    description: formData.get("description"),
    publication_date: formData.get("publication_date"),
  });
  if (!parsed.success) redirect("/admin?error=details");

  const { data: issue, error: readError } = await context.supabase
    .from("issues")
    .select("issue_number")
    .eq("id", parsed.data.issue_id)
    .maybeSingle();
  if (readError || !issue) redirect("/admin?error=issue");

  const slug = `${String(issue.issue_number).padStart(3, "0")}-${slugify(parsed.data.title)}`;
  const { error } = await context.supabase.from("issues").update({
    title: parsed.data.title,
    description: parsed.data.description,
    publication_date: parsed.data.publication_date,
    slug,
    updated_at: new Date().toISOString(),
  }).eq("id", parsed.data.issue_id);
  if (error) redirect(error.code === "23505" ? "/admin?error=duplicate" : "/admin?error=save");

  revalidatePath("/");
  revalidatePath("/issues");
  revalidatePath("/latest-issue");
  revalidatePath(`/issues/${issue.issue_number}`);
  redirect("/admin?updated=1");
}

export async function scheduleIssue(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const id = String(formData.get("issue_id") || "");
  const scheduledAt = String(formData.get("scheduled_at") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin?error=issue");
  const date = new Date(scheduledAt);
  if (!scheduledAt || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    redirect("/admin?error=schedule");
  }
  const { data, error } = await context.supabase.from("issues").update({
    status: "scheduled",
    scheduled_at: date.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft").select("id").maybeSingle();
  if (error || !data) redirect("/admin?error=schedule");
  revalidatePath("/admin");
  redirect("/admin?scheduled=1");
}

export async function cancelIssueSchedule(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const id = String(formData.get("issue_id") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin?error=issue");
  const { data, error } = await context.supabase.from("issues").update({
    status: "draft",
    scheduled_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "scheduled").select("id").maybeSingle();
  if (error || !data) redirect("/admin?error=issue");
  revalidatePath("/admin");
  redirect("/admin?unscheduled=1");
}

function getPublicIssueObjectPath(value: string, issueNumber: number) {
  try {
    const url = new URL(value);
    const marker = "/storage/v1/object/public/issue-public/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const objectPath = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
    return objectPath.startsWith(`issues/${issueNumber}/`) && !objectPath.includes("..")
      ? objectPath
      : null;
  } catch {
    return null;
  }
}

export async function unpublishIssue(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const id = String(formData.get("issue_id") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin?error=issue");
  const supabase = createAdminClient();
  const { data: issue, error: readError } = await supabase.from("issues")
    .select("id, issue_number, pdf_url, cover_image_url, status, updated_at")
    .eq("id", id).eq("status", "published").maybeSingle();
  if (readError || !issue || !issue.pdf_url || !issue.cover_image_url) redirect("/admin?error=issue");

  const publicPdfPath = getPublicIssueObjectPath(String(issue.pdf_url), issue.issue_number);
  const publicCoverPath = getPublicIssueObjectPath(String(issue.cover_image_url), issue.issue_number);
  if (!publicPdfPath || !publicCoverPath) redirect("/admin?error=unpublish-assets");

  const [pdfResult, coverResult] = await Promise.all([
    supabase.storage.from("issue-public").download(publicPdfPath),
    supabase.storage.from("issue-public").download(publicCoverPath),
  ]);
  if (pdfResult.error || !pdfResult.data || coverResult.error || !coverResult.data) {
    redirect("/admin?error=unpublish-assets");
  }

  const basePath = `issues/${issue.issue_number}/${randomUUID()}`;
  const draftPdfPath = `${basePath}.pdf`;
  const extension = publicCoverPath.split(".").pop() || "jpg";
  const draftCoverPath = `${basePath}-cover.${extension}`;
  const coverType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  const { data: startedOperation, error: startOperationError } = await supabase.rpc(
    "begin_publication_operation",
    {
      p_operation_id: basePath.split("/").pop(),
      p_issue_id: id,
      p_operation_kind: "unpublish",
      p_source_status: "published",
      p_source_pdf_url: String(issue.pdf_url),
      p_source_cover_url: String(issue.cover_image_url),
      p_source_updated_at: issue.updated_at,
      p_target_pdf_path: draftPdfPath,
      p_target_cover_path: draftCoverPath,
      p_target_pdf_url: draftPdfPath,
      p_target_cover_url: draftCoverPath,
      p_claim_token: null,
      p_lease_seconds: 600,
    },
  );
  const operationId = basePath.split("/").pop() as string;
  if (startOperationError || startedOperation !== operationId) redirect("/admin?error=unpublish-conflict");

  const [pdfUpload, coverUpload] = await Promise.all([
    supabase.storage.from("issue-drafts").upload(draftPdfPath, pdfResult.data, { contentType: "application/pdf", upsert: false }),
    supabase.storage.from("issue-drafts").upload(draftCoverPath, coverResult.data, { contentType: coverType, upsert: false }),
  ]);
  if (pdfUpload.error || coverUpload.error) {
    await supabase.rpc("fail_publication_operation", {
      p_operation_id: operationId,
      p_failure_reason: "One or more draft asset copies failed",
    });
    redirect("/admin?error=unpublish-assets");
  }

  const { data: completed, error: completeError } = await supabase.rpc(
    "complete_publication_operation",
    { p_operation_id: operationId },
  );
  let operationCommitted = !completeError && completed === true;
  if (!operationCommitted) {
    const { data: operationRows } = await supabase.rpc(
      "read_publication_operation",
      { p_operation_id: operationId },
    );
    operationCommitted = operationRows?.[0]?.state === "committed";
  }
  if (!operationCommitted) {
    await supabase.rpc("fail_publication_operation", {
      p_operation_id: operationId,
      p_failure_reason: completeError?.message || "Conditional unpublish transition did not commit",
    });
    redirect("/admin?error=unpublish");
  }

  // The database no longer references the public objects. Only now may they be
  // removed; if storage cleanup fails, the private copies remain available for
  // recovery and the issue remains safely unpublished.
  const { error: removeError } = await supabase.storage.from("issue-public").remove([publicPdfPath, publicCoverPath]);
  if (removeError) redirect("/admin?error=unpublish-cleanup");

  revalidatePath("/");
  revalidatePath("/issues");
  revalidatePath("/latest-issue");
  revalidatePath(`/issues/${issue.issue_number}`);
  redirect("/admin?unpublished=1");
}
