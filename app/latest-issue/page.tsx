import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types";

export const metadata = { title: "Latest Issue" };

export default async function LatestIssuePage() {
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("issues")
      .select("issue_number")
      .eq("status", "published")
      .order("publication_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const latest = data as Pick<Issue, "issue_number"> | null;
    if (!latest) notFound();
    redirect(`/issues/${latest.issue_number}`);
  } catch {
    return (
      <main className="page-shell">
        <span className="kicker">Latest edition</span>
        <h1>No published issue found.</h1>
        <p className="muted">The latest edition will appear here after an issue is published.</p>
      </main>
    );
  }
}
