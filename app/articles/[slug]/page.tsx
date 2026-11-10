import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Article, ArticleDepartment } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

const departmentLabels: Record<ArticleDepartment, string> = {
  "tapestry-of-worlds": "Tapestry of Worlds",
  "frontier-tech": "Frontier Tech",
  "universal-record": "The Universal Record",
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const db = await createClient();
  const { data } = await db.from("articles").select("headline").eq("slug", slug).eq("status", "published").maybeSingle();
  return { title: data?.headline || "Article" };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const db = await createClient();
  const { data, error } = await db.from("articles").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw new Error("Could not load article.");
  if (!data) notFound();
  const article = data as Article;

  return (
    <article className="page-shell">
      <Link className="kicker" href="/articles">← All articles</Link>
      <p className="kicker" style={{ marginTop: 28 }}>{departmentLabels[article.department]}</p>
      <h1>{article.headline}</h1>
      <p className="muted">By {article.author}{article.published_at ? ` · ${new Date(article.published_at).toLocaleDateString("en-US", { dateStyle: "long" })}` : ""}</p>
      <div className="article-content" style={{ marginTop: 36 }}>
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", lineHeight: 1.85 }}>{article.body_markdown}</pre>
      </div>
      {article.images?.length > 0 && (
        <section aria-label="Article images" style={{ marginTop: 36 }}>
          {article.images.map((image, index) => (
            <figure key={`${image.url}-${index}`} style={{ margin: "28px 0" }}>
              <img src={image.url} alt={image.alt} loading="lazy" style={{ display: "block", maxWidth: "100%", height: "auto" }}/>
              {image.caption && <figcaption className="muted" style={{ marginTop: 8 }}>{image.caption}</figcaption>}
            </figure>
          ))}
        </section>
      )}
      {article.source_references?.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2>Sources and references</h2>
          <ol>
            {article.source_references.map((source, index) => (
              <li key={`${source.url}-${index}`} style={{ margin: "12px 0" }}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>
                {source.accessed_at && <span className="muted"> — accessed {source.accessed_at}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
