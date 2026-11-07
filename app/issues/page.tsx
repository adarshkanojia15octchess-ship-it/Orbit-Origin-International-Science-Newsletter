import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types";

export const metadata = { title: "Issue Archive" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const departments = [
  { value: "tapestry-of-worlds", label: "Tapestry of Worlds" },
  { value: "frontier-tech", label: "Frontier Tech" },
  { value: "universal-record", label: "The Universal Record" },
] as const;

export default async function IssuesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawSearch = typeof params.q === "string" ? params.q : "";
  const search = rawSearch.trim().slice(0, 100);
  const department = departments.some((item) => item.value === params.department)
    ? String(params.department)
    : "";
  const year = typeof params.year === "string" && /^\d{4}$/.test(params.year)
    ? Number(params.year)
    : null;

  let issues: Issue[] = [];
  let configured = true;
  try {
    const db = await createClient();
    let query = db
      .from("issues")
      .select("*")
      .eq("status", "published")
      .order("publication_date", { ascending: false });

    if (search) query = query.ilike("title", `%${search.replace(/[%_\\]/g, "\\$&")}%`);
    if (department) query = query.contains("departments", [department]);
    if (year && year >= 1900 && year <= 2099) {
      query = query
        .gte("publication_date", `${year}-01-01`)
        .lte("publication_date", `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) throw error;
    issues = (data || []) as Issue[];
  } catch {
    configured = false;
  }

  return (
    <div className="page-shell">
      <span className="kicker">The archive</span>
      <h1>Every edition.<br/><em>A growing record.</em></h1>
      <p className="muted">Browse published editions of ORBIT &amp; ORIGIN.</p>
      {!configured && <p className="muted">The archive will connect to the publication database once Supabase is configured.</p>}
      {configured && (
        <>
          <form method="get" action="/issues" className="grid" style={{ gridTemplateColumns: "minmax(180px,2fr) minmax(160px,1fr) minmax(100px,.7fr) auto", alignItems: "end", marginTop: 28 }}>
            <label className="form-field">Search issue titles
              <input type="search" name="q" maxLength={100} defaultValue={search} placeholder="Search the archive"/>
            </label>
            <label className="form-field">Department
              <select name="department" defaultValue={department}>
                <option value="">All departments</option>
                {departments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="form-field">Year
              <input type="number" name="year" min={1900} max={2099} inputMode="numeric" defaultValue={year ?? ""} placeholder="Any year"/>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit">Filter</button>
              <Link className="primary-link" href="/issues">Clear</Link>
            </div>
          </form>
          {issues.length === 0 && <p className="muted" style={{ marginTop: 32 }}>No published editions match those filters.</p>}
        </>
      )}
      <div className="grid" style={{ marginTop: 40 }}>
        {issues.map((issue) => (
          <article className="story-card" key={issue.id}>
            <span className="kicker">ISSUE {String(issue.issue_number).padStart(3, "0")}</span>
            <h3>{issue.title}</h3>
            <p>{issue.description}</p>
            <p>{new Date(issue.publication_date).toLocaleDateString()}</p>
            <Link href={`/issues/${issue.issue_number}`}>Read edition ↗</Link>
          </article>
        ))}
      </div>
    </div>
  );
}
