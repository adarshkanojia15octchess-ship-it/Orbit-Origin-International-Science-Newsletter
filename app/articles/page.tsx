import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Article, ArticleDepartment } from "@/lib/types";

export const metadata = { title: "Articles" };

const departments: { value: ArticleDepartment; label: string }[] = [
  { value: "tapestry-of-worlds", label: "Tapestry of Worlds" },
  { value: "frontier-tech", label: "Frontier Tech" },
  { value: "universal-record", label: "The Universal Record" },
];

export default async function ArticlesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 100);
  const department = departments.some((item) => item.value === params.department) ? params.department as ArticleDepartment : null;
  let articles: Article[] = [];
  let available = true;
  try {
    const db = await createClient();
    let query = db.from("articles").select("*").eq("status", "published").order("published_at", { ascending: false });
    if (q) query = query.ilike("headline", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
    if (department) query = query.eq("department", department);
    const { data, error } = await query;
    if (error) throw error;
    articles = (data || []) as Article[];
  } catch {
    available = false;
  }

  return (
    <main className="page-shell">
      <span className="kicker">The editorial desk</span>
      <h1>Ideas, evidence<br/><em>and discovery.</em></h1>
      <p className="muted">Explore reporting and analysis from ORBIT &amp; ORIGIN.</p>
      {!available && <p className="muted">The article archive will be available after the editorial database is configured.</p>}
      {available && (
        <>
          <form method="get" action="/articles" className="grid" style={{ gridTemplateColumns: "minmax(180px,2fr) minmax(180px,1fr) auto", alignItems: "end", marginTop: 28 }}>
            <label className="form-field">Search headlines<input type="search" name="q" maxLength={100} defaultValue={q}/></label>
            <label className="form-field">Department<select name="department" defaultValue={department || ""}><option value="">All departments</option>{departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
            <button type="submit">Filter articles</button>
          </form>
          {articles.length === 0 && <p className="muted" style={{ marginTop: 32 }}>No published articles match these filters.</p>}
          <div className="grid" style={{ marginTop: 40 }}>
            {articles.map((article) => (
              <article className="story-card" key={article.id}>
                <span className="kicker">{departments.find((d) => d.value === article.department)?.label}</span>
                <h3>{article.headline}</h3>
                <p className="muted">By {article.author}{article.published_at ? ` · ${new Date(article.published_at).toLocaleDateString()}` : ""}</p>
                <Link href={`/articles/${article.slug}`}>Read article ↗</Link>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
