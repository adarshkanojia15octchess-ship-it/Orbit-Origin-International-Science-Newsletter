import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types";
import { isPublishedStorageAsset } from "@/src/editorial/asset-url";

export const metadata = { title: "Issue Archive", description: "Browse published editions of ORBIT & ORIGIN." };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const departments = [
  { value: "tapestry-of-worlds", label: "Tapestry of Worlds" },
  { value: "frontier-tech", label: "Frontier Tech" },
  { value: "universal-record", label: "The Universal Record" },
];

export default async function IssuesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const department = departments.some((item) => item.value === params.department) ? String(params.department) : "";
  const year = typeof params.year === "string" && /^\d{4}$/.test(params.year) ? Number(params.year) : null;
  let issues: Issue[] = [];
  let available = true;

  try {
    const db = await createClient();
    let query = db.from("issues").select("*").eq("status", "published").order("publication_date", { ascending: false });
    if (search) query = query.ilike("title", "%" + search.replace(/[%_\\]/g, "\\$&") + "%");
    if (department) query = query.contains("departments", [department]);
    if (year && year >= 1900 && year <= 2099) {
      query = query.gte("publication_date", year + "-01-01").lte("publication_date", year + "-12-31");
    }
    const { data, error } = await query;
    if (error) throw error;
    issues = (data || []) as Issue[];
  } catch {
    available = false;
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  return (
    <div className="oo-archive">
      <header className="oo-archive-intro">
        <span className="oo-eyebrow">THE DIGITAL LIBRARY · EST. 2026</span>
        <h1>Ideas worth<br/><em>looking closer at.</em></h1>
        <p>Each edition is a considered record of discovery — from the scale of distant galaxies to the instruments expanding our reach.</p>
      </header>
      <section className="oo-archive-tools" aria-label="Filter the archive">
        <form action="/issues" method="get" className="oo-filter-form">
          <label>Search editions<input type="search" name="q" defaultValue={search} maxLength={100} placeholder="A title or subject"/></label>
          <label>Department<select name="department" defaultValue={department}>
            <option value="">All departments</option>
            {departments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select></label>
          <label>Year<input type="number" name="year" min={1900} max={2099} defaultValue={year ?? ""} placeholder="Any year"/></label>
          <button type="submit">Apply filters ↗</button>
        </form>
      </section>
      {!available ? (
        <p className="oo-archive-state" role="status">The archive is temporarily unavailable. Please return shortly.</p>
      ) : issues.length === 0 ? (
        <div className="oo-archive-state"><span className="oo-eyebrow">NO MATCHING EDITIONS</span><h2>The next discovery starts here.</h2><p>There are no published editions matching these filters.</p><Link href="/issues">Clear filters ↗</Link></div>
      ) : (
        <section className="oo-issue-grid" aria-label="Published editions">
          {issues.map((issue) => {
            const cover = issue.cover_image_url && isPublishedStorageAsset(issue.cover_image_url, projectUrl) ? issue.cover_image_url : null;
            const pdf = issue.pdf_url && isPublishedStorageAsset(issue.pdf_url, projectUrl) ? issue.pdf_url : null;
            return (
              <article className="oo-issue-card" key={issue.id}>
                <Link href={"/reader/" + issue.id} className="oo-issue-cover" aria-label={"Read " + issue.title}>
                  {cover ? <span className="oo-cover-image" style={{ backgroundImage: "url(" + JSON.stringify(cover) + ")" }}/> : <span className="oo-cover-placeholder"><span>ORBIT <i>&amp;</i> ORIGIN</span><strong>{String(issue.issue_number).padStart(3, "0")}</strong></span>}
                  <span className="oo-cover-label">DIGITAL EDITION · {String(issue.issue_number).padStart(3, "0")}</span>
                </Link>
                <div className="oo-issue-meta"><span>ISSUE {String(issue.issue_number).padStart(3, "0")}</span><time dateTime={issue.publication_date}>{new Date(issue.publication_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</time></div>
                <h2><Link href={"/reader/" + issue.id}>{issue.title}</Link></h2>
                <p>{issue.description}</p>
                <div className="oo-department-tags">{issue.departments?.map((item) => <span key={item}>{departments.find((d) => d.value === item)?.label || item}</span>)}</div>
                <div className="oo-issue-actions">
                  <Link href={"/reader/" + issue.id}>Read edition <span aria-hidden="true">↗</span></Link>
                  {pdf && <a href={pdf} download={"orbit-and-origin-" + issue.issue_number + ".pdf"}>Download PDF ↓</a>}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
