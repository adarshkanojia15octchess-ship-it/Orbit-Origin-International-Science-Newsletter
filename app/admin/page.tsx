import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/auth/admin";
import { cancelIssueSchedule, createIssue, publishIssue, scheduleIssue, unpublishIssue, updateIssue } from "./actions";
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
    upload: "The file upload failed. Check the issue-drafts and issue-public storage buckets and administrator policies.",
    duplicate: "That issue number or slug is already in use.",
    save: "The issue could not be saved.",
    publish: "The issue could not be published.",
    "publish-assets": "The issue files could not be copied into public storage. Check storage policies and available space.",
    issue: "The selected issue is invalid.",
    schedule: "Choose a valid future publication date and time.",
    "unpublish-assets": "Published files could not be safely moved back to private draft storage.",
    unpublish: "The issue could not be unpublished.",
  };

  return (
    <main className="page-shell">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div><span className="kicker">Authenticated workspace</span><h1>Publishing dashboard.</h1><p className="muted">Signed in as {user.email}</p></div>
        <form action={signOutAdmin}><button type="submit">Sign out</button></form>
      </div>

      {params.created && <p role="status">Draft created successfully.</p>}
      {params.published && <p role="status">Issue published. Newsletter delivery is not yet connected.</p>}
      {params.updated && <p role="status">Issue details updated.</p>}
      {params.scheduled && <p role="status">Issue scheduled for publication.</p>}
      {params.unscheduled && <p role="status">Issue schedule cancelled.</p>}
      {params.unpublished && <p role="status">Issue returned to draft and public assets removed.</p>}
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

      <section style={{ marginTop: 40 }}>
        <span className="kicker">Editorial content</span>
        <h2>Article studio</h2>
        <p className="muted">Create and manage article drafts, images, captions and references.</p>
        <Link className="primary-link" href="/admin/articles">Open editorial studio ↗</Link>
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
              <details style={{ marginTop: 14 }}>
                <summary>Edit issue details</summary>
                <form action={updateIssue} style={{ marginTop: 12 }}>
                  <input type="hidden" name="issue_id" value={issue.id}/>
                  <label className="form-field">Title<input name="title" required minLength={3} maxLength={160} defaultValue={issue.title}/></label>
                  <label className="form-field">Description<textarea name="description" required minLength={10} maxLength={2000} defaultValue={issue.description} rows={3}/></label>
                  <label className="form-field">Publication date<input type="date" name="publication_date" required defaultValue={issue.publication_date}/></label>
                  <button type="submit">Save issue details</button>
                </form>
              </details>
              {(issue.status === "draft" || issue.status === "scheduled") && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                  <form action={publishIssue}><input type="hidden" name="issue_id" value={issue.id}/><button type="submit">Publish now</button></form>
                  {issue.status === "draft" && <form action={scheduleIssue} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input type="hidden" name="issue_id" value={issue.id}/><input type="datetime-local" name="scheduled_at" required aria-label="Issue publication date and time" defaultValue={issue.issue_number === 2 ? "2026-11-14T00:00" : undefined}/><small style={{ alignSelf: "center", color: "var(--oo-muted)" }}>Times are India Standard Time (IST).</small><button type="submit">Schedule</button></form>}
                  {issue.status === "scheduled" && <form action={cancelIssueSchedule}><input type="hidden" name="issue_id" value={issue.id}/><button type="submit">Cancel schedule</button></form>}
                </div>
              )}
              {issue.status === "published" && <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}><Link href={`/issues/${issue.issue_number}`}>View public issue ↗</Link><form action={unpublishIssue}><input type="hidden" name="issue_id" value={issue.id}/><button type="submit">Unpublish issue</button></form></div>}
            </article>)}
          </div>
        )}
      </section>
    </main>
  );
}
