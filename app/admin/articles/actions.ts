"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminContext } from "@/lib/auth/admin";

const departmentSchema = z.enum([
  "tapestry-of-worlds",
  "frontier-tech",
  "universal-record",
]);

const imageSchema = z.array(z.object({
  url: z.string().url().refine((value) => value.startsWith("https://"), "Images must use HTTPS."),
  alt: z.string().trim().min(1).max(240),
  caption: z.string().trim().max(500).optional(),
})).max(20);

const referenceSchema = z.array(z.object({
  title: z.string().trim().min(2).max(240),
  url: z.string().url().refine((value) => value.startsWith("https://"), "Sources must use HTTPS."),
  accessed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})).max(50);

const articleSchema = z.object({
  headline: z.string().trim().min(5).max(220),
  author: z.string().trim().min(2).max(120),
  department: departmentSchema,
  body_markdown: z.string().trim().min(1).max(100000),
  images: imageSchema,
  source_references: referenceSchema,
  issue_id: z.string().uuid().optional().or(z.literal("")),
});

function parseJsonField<T>(value: FormDataEntryValue | null, fallback: T): T | null {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try { return JSON.parse(value) as T; } catch { return null; }
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

function parseArticle(formData: FormData) {
  const images = parseJsonField(formData.get("images"), []);
  const sourceReferences = parseJsonField(formData.get("source_references"), []);
  if (!images || !sourceReferences) return null;
  const parsed = articleSchema.safeParse({
    headline: formData.get("headline"),
    author: formData.get("author"),
    department: formData.get("department"),
    body_markdown: formData.get("body_markdown"),
    images,
    source_references: sourceReferences,
    issue_id: formData.get("issue_id") || "",
  });
  return parsed.success ? parsed.data : null;
}

function refreshEditorialPaths() {
  revalidatePath("/");
  revalidatePath("/articles");
  revalidatePath("/admin/articles");
  revalidatePath("/admin");
}

export async function createArticle(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const parsed = parseArticle(formData);
  if (!parsed) redirect("/admin/articles?error=details");

  const slug = `${slugify(parsed.headline)}-${randomUUID().slice(0, 8)}`;
  const { error } = await context.supabase.from("articles").insert({
    ...parsed,
    issue_id: parsed.issue_id || null,
    slug,
    status: "draft",
  });
  if (error) redirect("/admin/articles?error=save");
  refreshEditorialPaths();
  redirect("/admin/articles?created=1");
}

export async function updateArticle(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const id = String(formData.get("article_id") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin/articles?error=article");
  const parsed = parseArticle(formData);
  if (!parsed) redirect("/admin/articles?error=details");

  const { error } = await context.supabase.from("articles").update({
    ...parsed,
    issue_id: parsed.issue_id || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) redirect("/admin/articles?error=save");
  refreshEditorialPaths();
  redirect("/admin/articles?updated=1");
}

export async function publishArticle(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const id = String(formData.get("article_id") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin/articles?error=article");
  const now = new Date().toISOString();
  const { data, error } = await context.supabase.from("articles").update({
    status: "published",
    published_at: now,
    scheduled_at: null,
    updated_at: now,
  }).eq("id", id).in("status", ["draft", "scheduled"]).select("id").maybeSingle();
  if (error || !data) redirect("/admin/articles?error=publish");
  refreshEditorialPaths();
  redirect("/admin/articles?published=1");
}

export async function scheduleArticle(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const id = String(formData.get("article_id") || "");
  const scheduledAt = String(formData.get("scheduled_at") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin/articles?error=article");
  const parsedDate = new Date(scheduledAt);
  if (!scheduledAt || Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
    redirect("/admin/articles?error=schedule");
  }
  const { data, error } = await context.supabase.from("articles").update({
    status: "scheduled",
    scheduled_at: parsedDate.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "draft").select("id").maybeSingle();
  if (error || !data) redirect("/admin/articles?error=schedule");
  refreshEditorialPaths();
  redirect("/admin/articles?scheduled=1");
}

export async function unpublishArticle(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const id = String(formData.get("article_id") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin/articles?error=article");
  const { data, error } = await context.supabase.from("articles").update({
    status: "draft",
    scheduled_at: null,
    published_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "published").select("id").maybeSingle();
  if (error || !data) redirect("/admin/articles?error=unpublish");
  refreshEditorialPaths();
  redirect("/admin/articles?unpublished=1");
}

export async function archiveArticle(formData: FormData) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const id = String(formData.get("article_id") || "");
  if (!z.string().uuid().safeParse(id).success) redirect("/admin/articles?error=article");
  const { data, error } = await context.supabase.from("articles").update({
    status: "archived",
    scheduled_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).in("status", ["draft", "scheduled", "published"]).select("id").maybeSingle();
  if (error || !data) redirect("/admin/articles?error=archive");
  refreshEditorialPaths();
  redirect("/admin/articles?archived=1");
}
