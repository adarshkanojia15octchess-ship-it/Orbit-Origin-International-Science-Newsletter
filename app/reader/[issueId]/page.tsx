import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types";
import { isPublishedStorageAsset } from "@/src/editorial/asset-url";
import { PdfReader } from "@/src/editorial/pdf-reader";

type Props = { params: Promise<{ issueId: string }> };

export async function generateMetadata({ params }: Props) {
  const { issueId } = await params;
  return { title: "Edition reader", description: "Read a published ORBIT & ORIGIN edition." };
}

export default async function EditionReaderPage({ params }: Props) {
  const { issueId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(issueId)) notFound();

  const db = await createClient();
  const { data, error } = await db
    .from("issues")
    .select("*")
    .eq("id", issueId)
    .eq("status", "published")
    .maybeSingle();

  if (error || !data) notFound();
  const issue = data as Issue;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!issue.pdf_url || !isPublishedStorageAsset(issue.pdf_url, projectUrl)) notFound();

  return (
    <article className="oo-reader-page">
      <div className="oo-reader-heading">
        <Link href="/issues" className="oo-eyebrow">← The archive</Link>
        <p className="oo-eyebrow">ORBIT &amp; ORIGIN · ISSUE {String(issue.issue_number).padStart(3, "0")}</p>
        <h1>{issue.title}</h1>
        <p className="oo-reader-description">{issue.description}</p>
        <p className="oo-reader-date">{new Date(issue.publication_date).toLocaleDateString("en-US", { dateStyle: "long" })}</p>
      </div>
      <PdfReader
        url={issue.pdf_url}
        title={issue.title}
        downloadName={"orbit-and-origin-issue-" + String(issue.issue_number).padStart(3, "0") + ".pdf"}
      />
    </article>
  );
}
