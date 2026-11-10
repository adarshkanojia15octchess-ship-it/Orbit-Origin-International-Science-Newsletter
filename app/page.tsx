import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types";
import { isPublishedStorageAsset } from "@/src/editorial/asset-url";

export const metadata = {
  title: "ORBIT & ORIGIN — Exploring the Universe",
  description: "An independent science and astronomy publication. Open to curiosity. Committed to evidence.",
};

export default async function Home() {
  let issue002: Issue | null = null;
  let issue001: Issue | null = null;
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("issues")
      .select("*")
      .eq("issue_number", 2)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    issue002 = data as Issue | null;
    const inaugural = await db.from("issues").select("*").eq("issue_number", 1).eq("status", "published").maybeSingle();
    if (inaugural.error) throw inaugural.error;
    issue001 = inaugural.data as Issue | null;
  } catch {
    // Keep the editorial lead readable if the publication database is unavailable.
  }

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const cover = issue002?.cover_image_url && isPublishedStorageAsset(issue002.cover_image_url, projectUrl)
    ? issue002.cover_image_url
    : null;

  return (
    <>
      <section className="hero">
        <span className="kicker">An independent science &amp; astronomy publication</span>
        <h1>Exploring the Universe.<br /><em>Understanding Our Place.</em></h1>
        <p>Scientific discoveries, cosmic perspectives and the ideas shaping tomorrow — explored with curiosity and evidence.</p>
        <Link className="primary-link" href="/issues">Explore the publication ↗</Link>
      </section>

      <section className="lead-issue" aria-labelledby="lead-issue-title">
        <div className="lead-issue-copy">
          <span className="kicker">The lead editorial · Issue 002</span>
          <p className="lead-issue-date">14 November 2026</p>
          <h2 id="lead-issue-title">The Hidden Signal</h2>
          <p className="lead-issue-deck">Across exoplanetary astronomy, climate dynamics and microbiology, precise methods reveal quiet physical signals amid ambient noise — without overstating what the evidence proves.</p>
          {issue002 ? (
            <Link className="primary-link" href={"/reader/" + issue002.id}>Read Issue 002 ↗</Link>
          ) : (
            <div className="lead-issue-status" role="status">
              <span>Upcoming edition</span>
              <strong>Publication date: 14 November 2026</strong>
              <Link href="/issues">Browse the issue archive ↗</Link>
            </div>
          )}
          <p className="lead-issue-inaugural">The inaugural edition, {issue001 ? <Link href={"/reader/" + issue001.id}>Reading the Traces · Issue 001</Link> : <Link href="/issues">Reading the Traces · Issue 001</Link>}, belongs in the publication archive.</p>
        </div>
        <div
          className={"lead-issue-art" + (cover ? " has-cover" : "")}
          style={cover ? { backgroundImage: "linear-gradient(0deg,rgba(10,25,43,.12),rgba(10,25,43,.02)),url(" + JSON.stringify(cover) + ")" } : undefined}
          role="img"
          aria-label={cover ? "Cover artwork for ORBIT & ORIGIN Issue 002, The Hidden Signal" : "Typographic editorial artwork for Issue 002, The Hidden Signal"}
        >
          {!cover && (
            <>
              <span className="lead-art-masthead">ORBIT <i>&amp;</i> ORIGIN</span>
              <span className="lead-art-number">ISSUE 002</span>
              <strong>THE<br />HIDDEN<br /><em>SIGNAL</em></strong>
              <span className="lead-art-foot">OPEN TO CURIOSITY · COMMITTED TO EVIDENCE</span>
            </>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div><span className="kicker">The publication</span><h2>Three windows into discovery.</h2></div>
          <p className="muted">Science, carefully observed and beautifully told.</p>
        </div>
        <div className="grid">
          <article className="story-card"><span className="kicker">01 / Cosmos</span><h3>Tapestry of Worlds</h3><p>Astronomy, astrophysics, cosmology, planetary science and space exploration.</p></article>
          <article className="story-card"><span className="kicker">02 / Innovation</span><h3>Frontier Tech</h3><p>Engineering, scientific instruments, emerging technologies and discovery.</p></article>
          <article className="story-card"><span className="kicker">03 / Perspective</span><h3>The Universal Record</h3><p>Research announcements, scientific milestones and the record of discovery.</p></article>
        </div>
      </section>

      <section className="newsletter-band">
        <div><span className="kicker">The ORBIT &amp; ORIGIN dispatch</span><h2>Stay curious. Look further.</h2><p>Receive new editions and carefully selected scientific stories.</p></div>
        <Link className="primary-link" href="/subscribe">Join the readership ↗</Link>
      </section>
    </>
  );
}
