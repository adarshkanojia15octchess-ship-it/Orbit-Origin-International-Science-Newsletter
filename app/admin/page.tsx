import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/admin";
import { createIssue, publishIssue } from "./actions";
import { signOutAdmin } from "./login/actions";
import type { Issue } from "@/lib/types";

export const metadata = { title: "Publishing Dashboard" };

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const context = await getAdminContext();
  if (!context) redirect("/admin/login");
  const { supabase, user } = context;
  const params = await searchParams;
  const { data, error } = await supabase.from("issues").select("*").order("created_at", { ascending: false });
  if (error) throw new Error("Could not load publication records.");
  const issues = (data || []) as Issue[];

  const messages: Record<string, string> = {
    details: "Check the issue number, title, description, date and selected departments.",
    pdf: "Upload a valid PDF file no larger than 25 MB.",
    cover: "Upload a JPEG, PNG or WebP cover image no larger than 8 MB.",
    upload: "The file upload failed. Check the issue-assets storage bucket and its administrator policies.",
    duplicate: "That issue number or slug is already in use.",
    save: "The issue could not be saved.",
    publish: "The issue could not be published.",
    issue: "The selected issue is invalid.",
  };

  return (
    <main className="page-shell">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div><span className="kicker">Authenticated workspace</span><h1>Publishing dashboard.</h1><p className="muted">Signed in as {user.email}</p></div>
        <form action={signOutAdmin}><button type="submit">Sign out</button></form>
      </div>

      {params.created && <p role="status">Draft created successfully.</p>}
      {params.published && <p role="status">Issue published. Newsletter delivery is not yet connected.</p>}
      {params.error && <p role="alert" className="muted">{messages[params.error] || "The requested action could not be completed."}</p>}

      <section style={{ marginTop: 48 }}>
        <span className="kicker">New edition</span>
        <h2>Create an issue draft</h2>
        <p className="muted">Files are validated before upload. New issues remain drafts until an administrator publishes them.</p>
        <form action={createIssue} encType="multipart/form-data" style={{ maxWidth: 720, marginTop: 24 }}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <label className="form-field">Issue number<input name="issue_number" type="number" min="1" max="999999" required/></label>
            <label className="form-field">Publication date<input name="publication_date" type="date" required/></label>
          </div>
          <label className="form-field">Issue title<input name="title" type="text" minLength={3} maxLength={160} required/></label>
          <label className="form-field">Short description<textarea name="description" rows={4} maxLength={2000} required style={{ padding: 12, background: "#f4f7f9", color: "#071321" }}/></label>
          <fieldset style={{ border: "1px solid var(--line)", padding: 18, margin: "18px 0" }}>
            <legend>Editorial departments</legend>
            {[
              ["tapestry-of-worlds", "Tapestry of Worlds"],
              ["frontier-tech", "Frontier Tech"],
              ["universal-record", "The Universal Record"],
            ].map(([value, label]) => <label key={value} style={{ display: "block", margin: "10px 0" }}><input type="checkbox" name="departments" value={value} style={{ marginRight: 10 }}/>{label}</label>)}
          </fieldset>
          <label className="form-field">Issue PDF (PDF, maximum 25 MB)<input type="file" name="pdf" accept="application/pdf" required/></label>
          <label className="form-field">Cover image (JPEG, PNG or WebP, maximum 8 MB)<input type="file" name="cover" accept="image/jpeg,image/png,image/webp" required/></label>
          <button type="submit">Upload and save draft</button>
        </form>
      </section>

      <section style={{ marginTop: 64 }}>
        <span className="kicker">Publication records</span>
        <h2>Issue management</h2>
        {issues.length === 0 ? <p className="muted">No issues have been created yet.</p> : (
          <div className="grid" style={{ marginTop: 20 }}>
            {issues.map((issue) => <article className="story-card" key={issue.id}>
              <span className="kicker">ISSUE {String(issue.issue_number).padStart(3, "0")} / {issue.status}</span>
              <h3>{issue.title}</h3>
              <p>{issue.description}</p>
              <p className="muted">{new Date(issue.publication_date).toLocaleDateString()}</p>
              {issue.status === "draft" && <form action={publishIssue}><input type="hidden" name="issue_id" value={issue.id}/><button type="submit">Publish issue</button></form>}
              {issue.status === "published" && <Link href={`/issues/${issue.issue_number}`}>View public issue ↗</Link>}
            </article>)}
          </div>
        )}
      </section>
    </main>
  );
}
