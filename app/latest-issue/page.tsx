import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types";

export const metadata = { title: "Latest Issue" };

export default async function LatestIssuePage() {
  let issueNumber: number | null = null;
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
    issueNumber = latest?.issue_number ?? null;
  } catch {
    return (
      <main className="page-shell">
        <span className="kicker">Latest edition</span>
        <h1>Publication database unavailable.</h1>
        <p className="muted">The latest edition cannot be loaded at the moment.</p>
        <Link href="/issues">Browse the archive ↗</Link>
      </main>
    );
  }

  if (!issueNumber) notFound();
  redirect(`/issues/${issueNumber}`);
}
