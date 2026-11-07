export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="page-shell">
      <span className="kicker">About the publication</span>
      <h1>Curiosity, guided by evidence.</h1>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 24, maxWidth: 760 }}>ORBIT & ORIGIN is an independent science and astronomy publication exploring the universe and the ideas that help us understand our place within it.</p>
      <p className="muted" style={{ maxWidth: 760 }}>Our aim is to make scientific work engaging without sacrificing accuracy. We connect discoveries, instruments, history and fundamental ideas through clear explanations, careful sourcing and a global perspective, including dedicated attention to science and research in India.</p>
      <h2 style={{ marginTop: 48 }}>Our editorial promise</h2>
      <div className="grid">
        <article className="story-card"><h3>Evidence first</h3><p>Claims should be traceable to credible research, primary sources or authoritative institutions.</p></article>
        <article className="story-card"><h3>Clarity without distortion</h3><p>We explain difficult ideas accessibly without pretending uncertainty does not exist.</p></article>
        <article className="story-card"><h3>Curiosity without borders</h3><p>Science is international. We seek perspectives and work from across the research community.</p></article>
      </div>
    </main>
  );
}
