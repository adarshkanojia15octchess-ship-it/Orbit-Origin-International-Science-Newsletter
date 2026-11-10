import Link from "next/link";

export const metadata = { title: "About ORBIT & ORIGIN" };

export default function AboutPage() {
  return (
    <main className="page-shell">
      <span className="kicker">About the publication</span>
      <h1>Curiosity, guided by evidence.</h1>
      <p className="about-lede">
        ORBIT &amp; ORIGIN is an independent science and astronomy publication exploring the universe and the ideas that help us understand our place within it.
      </p>
      <p className="muted about-copy">
        Our aim is to make scientific work engaging without sacrificing accuracy. We connect discoveries, instruments, history and fundamental ideas through clear explanations, careful sourcing and a global perspective, including dedicated attention to science and research in India.
      </p>

      <section aria-labelledby="mission-heading" className="about-section">
        <span className="kicker">Our mission</span>
        <h2 id="mission-heading">Make discovery understandable.</h2>
        <p className="muted about-copy">
          We bring astronomy, physics, technology and the wider scientific record to curious readers. We explain what the evidence shows, where uncertainty remains and why new ideas matter.
        </p>
      </section>

      <section aria-labelledby="promise-heading" className="about-section">
        <h2 id="promise-heading">Our editorial promise</h2>
        <div className="grid">
          <article className="story-card"><h3>Evidence first</h3><p>Claims should be traceable to credible research, primary sources or authoritative institutions.</p></article>
          <article className="story-card"><h3>Clarity without distortion</h3><p>We explain difficult ideas accessibly without pretending uncertainty does not exist.</p></article>
          <article className="story-card"><h3>Curiosity without borders</h3><p>Science is international. We seek perspectives and work from across the research community.</p></article>
        </div>
      </section>

      <section aria-labelledby="standards-heading" className="about-section">
        <h2 id="standards-heading">Editorial standards</h2>
        <p className="muted about-copy">Our work distinguishes established findings from emerging ideas, evidence from interpretation, and scientific confidence from speculation.</p>
        <Link className="text-link" href="/editorial-standards">Read our editorial standards ↗</Link>
      </section>

      <section aria-labelledby="founder-heading" className="about-founder">
        <div>
          <span className="kicker">The person behind the publication</span>
          <h2 id="founder-heading">Meet the founder.</h2>
          <p className="muted">Learn about the publication’s founding vision, editorial approach and selected scientific writing.</p>
        </div>
        <Link className="primary-link" href="/about/founder">The Founder ↗</Link>
      </section>
    </main>
  );
}
