import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types";

type Props = { params: Promise<{ issue_number: string }> };

export async function generateMetadata({ params }: Props) {
  const { issue_number } = await params;
  return { title: `Issue ${issue_number}` };
}

export default async function IssueReaderPage({ params }: Props) {
  const { issue_number } = await params;
  const number = Number(issue_number);
  if (!Number.isSafeInteger(number) || number < 1) notFound();

  let issue: Issue | null = null;
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("issues")
      .select("*")
      .eq("issue_number", number)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    issue = data as Issue | null;
  } catch {
    return (
      <div className="page-shell">
        <span className="kicker">Publication reader</span>
        <h1>Reader temporarily unavailable.</h1>
        <p className="muted">The publication database is not configured or could not be reached. Please try again later.</p>
        <Link href="/issues">Return to the archive ↗</Link>
      </div>
    );
  }

  if (!issue) notFound();

  return (
    <article className="page-shell">
      <Link className="kicker" href="/issues">← All editions</Link>
      <p className="kicker" style={{ marginTop: 28 }}>ISSUE {String(issue.issue_number).padStart(3, "0")}</p>
      <h1>{issue.title}</h1>
      <p className="muted">{new Date(issue.publication_date).toLocaleDateString("en-US", { dateStyle: "long" })}</p>
      <p className="muted">{issue.description}</p>
      {issue.pdf_url ? (
        <section aria-label="PDF issue reader" style={{ marginTop: 36 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
            <a className="primary-link" href={issue.pdf_url} target="_blank" rel="noreferrer">Open PDF in new tab ↗</a>
            <a className="primary-link" href={issue.pdf_url} download>Download PDF ↓</a>
          </div>
          <iframe
            title={`ORBIT & ORIGIN Issue ${issue.issue_number}: ${issue.title}`}
            src={issue.pdf_url}
            style={{ width: "100%", height: "min(80vh, 1000px)", border: "1px solid var(--line)", background: "#fff" }}
            allowFullScreen
          />
          <p className="muted">PDF controls such as page navigation, zoom and fullscreen depend on the visitor’s browser PDF viewer. Use “Open PDF in new tab” if the embedded viewer is unavailable.</p>
        </section>
      ) : issue.html_content ? (
        <section className="article-content" style={{ marginTop: 36 }}>
          <p className="muted">This edition is available in its web reading format.</p>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{issue.html_content}</pre>
        </section>
      ) : (
        <p className="muted">The digital edition is not available yet.</p>
      )}
    </article>
  );
}
