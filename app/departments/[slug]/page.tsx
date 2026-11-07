import Link from "next/link";
import { notFound } from "next/navigation";

const departments = {
  "tapestry-of-worlds": {
    number: "01",
    title: "Tapestry of Worlds",
    subtitle: "The universe, observed and understood.",
    description: "Astronomy, astrophysics, cosmology, planetary science and space exploration. We follow evidence from our Solar System to the distant universe, placing new observations in their scientific context.",
    themes: ["Astronomy & observing", "Stars, galaxies & black holes", "Cosmology & fundamental physics", "Planetary science & exploration"],
  },
  "frontier-tech": {
    number: "02",
    title: "Frontier Tech",
    subtitle: "The instruments and ideas shaping tomorrow.",
    description: "Scientific innovation, engineering, emerging technologies, research instruments and computing. We examine how new tools are built, what they can measure and where their limits lie.",
    themes: ["Spaceflight & aerospace", "Scientific instruments", "Computing & simulation", "Engineering & emerging research"],
  },
  "universal-record": {
    number: "03",
    title: "The Universal Record",
    subtitle: "A considered record of scientific progress.",
    description: "Discoveries, research announcements, historical milestones, awards and important events. Every story should lead back to its original evidence and clearly distinguish results from interpretation.",
    themes: ["Research announcements", "Scientific history", "Milestones & awards", "Events and the research calendar"],
  },
} as const;

export async function generateStaticParams() {
  return Object.keys(departments).map((slug) => ({ slug }));
}

export default async function DepartmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in departments)) notFound();
  const department = departments[slug as keyof typeof departments];
  return (
    <main className="page-shell">
      <span className="kicker">{department.number} / Editorial department</span>
      <h1>{department.title}</h1>
      <p style={{ fontFamily: "Georgia, serif", fontSize: 24 }}>{department.subtitle}</p>
      <p className="muted" style={{ maxWidth: 760 }}>{department.description}</p>
      <div className="grid" style={{ marginTop: 40 }}>
        {department.themes.map((theme) => <article className="story-card" key={theme}><span className="kicker">Coverage</span><h3>{theme}</h3></article>)}
      </div>
      <p style={{ marginTop: 36 }}><Link href="/issues">Explore published editions ↗</Link></p>
    </main>
  );
}
