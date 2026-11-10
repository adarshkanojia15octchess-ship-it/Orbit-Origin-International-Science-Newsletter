import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/admin";
import type { Article, Issue } from "@/lib/types";
import {
  archiveArticle,
  createArticle,
  publishArticle,
  scheduleArticle,
  unpublishArticle,
  updateArticle,
} from "./actions";

export const metadata = { title: "Editorial Content Studio" };

const departments = [
  ["tapestry-of-worlds", "Tapestry of Worlds"],
  ["frontier-tech", "Frontier Tech"],
  ["universal-record", "The Universal Record"],
] as const;

function ArticleFields({ article, issues }: { article?: Article; issues: Issue[] }) {
  return (
    <>
      <label className="form-field">Headline
        <input name="headline" required minLength={5} maxLength={220} defaultValue={article?.headline ?? ""}/>
      </label>
      <label className="form-field">Author
        <input name="author" required minLength={2} maxLength={120} defaultValue={article?.author ?? ""}/>
      </label>
      <label className="form-field">Department
        <select name="department" required defaultValue={article?.department ?? "tapestry-of-worlds"}>
          {departments.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="form-field">Issue (optional)
        <select name="issue_id" defaultValue={article?.issue_id ?? ""}>
          <option value="">Independent article</option>
          {issues.map((issue) => <option key={issue.id} value={issue.id}>Issue {String(issue.issue_number).padStart(3, "0")} — {issue.title}</option>)}
        </select>
      </label>
      <label className="form-field">Article body (Markdown)
        <textarea name="body_markdown" required rows={14} maxLength={100000} defaultValue={article?.body_markdown ?? ""} style={{ padding: 12, background: "#f4f7f9", color: "#071321" }}/>
      </label>
      <label className="form-field">Images (JSON array: url, alt, optional caption)
        <textarea name="images" rows={4} defaultValue={JSON.stringify(article?.images ?? [], null, 2)} style={{ padding: 12, background: "#f4f7f9", color: "#071321", fontFamily: "monospace" }}/>
      </label>
      <label className="form-field">Sources and references (JSON array: title, HTTPS url, optional accessed_at)
        <textarea name="source_references" rows={4} defaultValue={JSON.stringify(article?.source_references ?? [], null, 2)} style={{ padding: 12, background: "#f4f7f9", color: "#071321", fontFamily: "monospace" }}/>
      </label>
    </>
  );
}

export default async function EditorialStudioPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const params = await searchParams;
  const [{ data: articleRows, error: articleError }, { data: issueRows, error: issueError }] = await Promise.all([
    context.supabase.from("articles").select("*").order("updated_at", { ascending: false }),
    context.supabase.from("issues").select("id, issue_number, title, status").order("issue_number", { ascending: false }),
  ]);
  if (articleError || issueError) {
    return <main className="page-shell"><h1>Editorial studio unavailable.</h1><p className="muted">Apply migration 004_editorial_content_and_scheduling.sql and verify administrator database policies.</p></main>;
  }
  const articles = (articleRows || []) as Article[];
  const issues = (issueRows || []) as Issue[];

  const messages: Record<string, string> = {
    details: "Check the headline, author, department, body, image JSON and source JSON.",
    save: "The article could not be saved.",
    article: "The selected article is invalid.",
    publish: "The article could not be published.",
    schedule: "Choose a valid future publication date and time.",
    unpublish: "The article could not be returned to draft.",
    archive: "The article could not be archived.",
  };

  return (
    <main className="page-shell">
      <Link className="kicker" href="/admin">← Publishing dashboard</Link>
      <span className="kicker" style={{ display: "block", marginTop: 24 }}>Editorial workspace</span>
      <h1>Article studio.</h1>
      <p className="muted">Create and maintain structured reporting across the three ORBIT &amp; ORIGIN departments.</p>
      {params.created && <p role="status">Article draft created.</p>}
      {params.updated && <p role="status">Article updated.</p>}
      {params.published && <p role="status">Article published.</p>}
      {params.scheduled && <p role="status">Article scheduled.</p>}
      {params.unpublished && <p role="status">Article returned to draft.</p>}
      {params.archived && <p role="status">Article archived.</p>}
      {params.error && <p role="alert">{messages[params.error] || "The action could not be completed."}</p>}

      <section style={{ marginTop: 40 }}>
        <h2>New article</h2>
        <form action={createArticle} style={{ maxWidth: 820 }}>
          <ArticleFields issues={issues}/>
          <button type="submit">Save article draft</button>
        </form>
      </section>

      <section style={{ marginTop: 64 }}>
        <h2>Editorial library</h2>
        {articles.length === 0 ? <p className="muted">No articles have been created.</p> : (
          <div className="grid" style={{ marginTop: 24 }}>
            {articles.map((article) => (
              <article className="story-card" key={article.id}>
                <span className="kicker">{article.department.replaceAll("-", " ")} / {article.status}</span>
                <h3>{article.headline}</h3>
                <p className="muted">By {article.author}</p>
                <details>
                  <summary>Edit article</summary>
                  <form action={updateArticle} style={{ marginTop: 16 }}>
                    <input type="hidden" name="article_id" value={article.id}/>
                    <ArticleFields article={article} issues={issues}/>
                    <button type="submit">Save changes</button>
                  </form>
                </details>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                  {(article.status === "draft" || article.status === "scheduled") && (
                    <form action={publishArticle}><input type="hidden" name="article_id" value={article.id}/><button type="submit">Publish now</button></form>
                  )}
                  {article.status === "draft" && (
                    <form action={scheduleArticle} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input type="hidden" name="article_id" value={article.id}/>
                      <input type="datetime-local" name="scheduled_at" required aria-label="Article publication date and time"/>
                      <button type="submit">Schedule</button>
                    </form>
                  )}
                  {article.status === "published" && (
                    <form action={unpublishArticle}><input type="hidden" name="article_id" value={article.id}/><button type="submit">Unpublish</button></form>
                  )}
                  {article.status !== "archived" && (
                    <form action={archiveArticle}><input type="hidden" name="article_id" value={article.id}/><button type="submit">Archive</button></form>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
