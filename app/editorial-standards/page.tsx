export const metadata = { title: "Editorial Standards" };

export default function EditorialStandardsPage() {
  return (
    <main className="page-shell">
      <span className="kicker">How we work</span>
      <h1>Editorial standards.</h1>
      <p className="muted" style={{ maxWidth: 760 }}>Trust is earned through transparent sourcing, accurate language and a clear separation between established findings and emerging hypotheses.</p>
      <h2 style={{ marginTop: 40 }}>Research and sourcing</h2>
      <p className="muted">Scientific reporting should link to original papers, institutional releases or primary datasets wherever practical. Secondary sources may provide context but should not replace the original evidence for important claims.</p>
      <h2>Accuracy and uncertainty</h2>
      <p className="muted">We distinguish peer-reviewed results, preprints, observational evidence, theoretical proposals and speculation. Estimates, limitations and disagreements should be described honestly.</p>
      <h2>Images and attribution</h2>
      <p className="muted">Images must have a documented source, usage basis and credit. Scientific visualisations should be identified as illustrations when they are not direct observations or data products.</p>
      <h2>Corrections</h2>
      <p className="muted">Material errors should be corrected transparently. Significant corrections should identify what changed and when.</p>
      <h2>Independence</h2>
      <p className="muted">Editorial decisions should be guided by scientific relevance and reader value, not undisclosed sponsorship or sensational claims.</p>
    </main>
  );
}
