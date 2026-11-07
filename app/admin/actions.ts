"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";

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

  const { supabase } = context;
  const { data: issue, error: readError } = await supabase
    .from("issues")
    .select("id, issue_number, pdf_url, cover_image_url, status")
    .eq("id", id)
    .eq("status", "draft")
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

  const pdfPublicPath = `issues/${issue.issue_number}/edition.pdf`;
  const coverExtension = coverPath.split(".").pop() || "jpg";
  const coverPublicPath = `issues/${issue.issue_number}/cover.${coverExtension}`;

  const { error: pdfPublishError } = await supabase.storage
    .from("issue-public")
    .upload(pdfPublicPath, pdfFile, { contentType: "application/pdf", upsert: true });
  if (pdfPublishError) redirect("/admin?error=publish-assets");

  const coverType = coverExtension === "png" ? "image/png" : coverExtension === "webp" ? "image/webp" : "image/jpeg";
  const { error: coverPublishError } = await supabase.storage
    .from("issue-public")
    .upload(coverPublicPath, coverFile, { contentType: coverType, upsert: true });
  if (coverPublishError) {
    await supabase.storage.from("issue-public").remove([pdfPublicPath]);
    redirect("/admin?error=publish-assets");
  }

  const pdfUrl = supabase.storage.from("issue-public").getPublicUrl(pdfPublicPath).data.publicUrl;
  const coverUrl = supabase.storage.from("issue-public").getPublicUrl(coverPublicPath).data.publicUrl;
  const { error: updateError } = await supabase
    .from("issues")
    .update({
      pdf_url: pdfUrl,
      cover_image_url: coverUrl,
      status: "published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "draft");

  if (updateError) {
    await supabase.storage.from("issue-public").remove([pdfPublicPath, coverPublicPath]);
    redirect("/admin?error=publish");
  }

  await supabase.storage.from("issue-drafts").remove([pdfPath, coverPath]);
  revalidatePath("/");
  revalidatePath("/issues");
  revalidatePath("/latest-issue");
  revalidatePath(`/issues/${issue.issue_number}`);
  redirect("/admin?published=1");
}
