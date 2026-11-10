import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "The Founder",
  description:
    "Meet Adarsh Kanojia, Founder and Editor-in-Chief of ORBIT & ORIGIN, and explore selected scientific writing.",
};

export default function FounderPage() {
  return (
    <main className="founder-page">
      <header className="founder-intro">
        <div className="founder-intro-copy">
          <span className="kicker">About ORBIT &amp; ORIGIN</span>
          <p className="founder-overline">The Founder</p>
          <h1>Adarsh Kanojia</h1>
          <p className="founder-role">Founder &amp; Editor-in-Chief, ORBIT &amp; ORIGIN</p>
          <p className="founder-deck">Student · Independent Science Writer · Science Communicator</p>
        </div>
        <figure className="founder-portrait">
          <Image
            src="/images/founder-portrait.webp"
            alt="Portrait of Adarsh Kanojia against a vivid cosmic nebula background"
            width={400}
            height={509}
            priority
            unoptimized
            sizes="(max-width: 760px) 78vw, 360px"
          />
          <figcaption>Adarsh Kanojia · Founder &amp; Editor-in-Chief</figcaption>
        </figure>
      </header>

      <section className="founder-biography" aria-labelledby="biography-heading">
        <div className="founder-section-label">
          <span className="kicker">01 / Profile</span>
          <h2 id="biography-heading">A curiosity shaped by questions.</h2>
        </div>
        <div className="founder-prose">
          <p>
            Adarsh Kanojia is a student science communicator and independent writer with a deep interest in astronomy, astrophysics, cosmology and fundamental physics.
          </p>
          <p>
            His interest in science begins with questions about how the universe works: how we learn what distant stars and planets are made of, how observations help reconstruct the histories of other worlds, and how evidence shapes the scientific picture of nature. He is drawn to the process behind discovery as much as to the discoveries themselves.
          </p>
          <p>
            His work includes independent scientific writing and educational projects that explore complex scientific subjects. He is also a primary author of <em>Tapestry of Worlds: Beyond Solar System and Universe</em>, written with co-author Rishi K. Pal.
          </p>
          <p>
            Adarsh founded ORBIT &amp; ORIGIN to build an accessible, internationally oriented publication for astronomy, science, technology and significant scientific developments. Its editorial approach places curiosity alongside accuracy, evidence alongside imagination, and accessibility alongside intellectual depth.
          </p>
          <p>
            He believes science communication should do more than announce discoveries. It should explain why they matter, what evidence supports them, what remains uncertain and which questions deserve to be asked next.
          </p>
          <blockquote className="founder-principle">
            Science advances not by making the universe seem simple, but by helping us understand its complexity.
          </blockquote>
        </div>
      </section>

      <section className="selected-work" aria-labelledby="selected-work-heading">
        <div className="founder-section-label">
          <span className="kicker">02 / Selected work</span>
          <h2 id="selected-work-heading">A book about our cosmic neighbourhood and beyond.</h2>
        </div>
        <article className="work-card">
          <div className="work-index" aria-hidden="true">01</div>
          <div className="work-details">
            <p className="work-type">Selected publication · Paperback</p>
            <h3>
              <a
                href="https://store.pothi.com/book/adarsh-kanojia-tapestry-worlds-beyond-solar-system-and-universe/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Tapestry of Worlds: Beyond Solar System and Universe
              </a>
            </h3>
            <p className="work-authors">Primary author: Adarsh Kanojia · Co-author: Rishi K. Pal</p>
            <dl className="work-metadata">
              <div><dt>Format</dt><dd>Paperback</dd></div>
              <div><dt>Language</dt><dd>English</dd></div>
              <div><dt>Length</dt><dd>269 pages</dd></div>
            </dl>
            <a
              className="work-link"
              href="https://store.pothi.com/book/adarsh-kanojia-tapestry-worlds-beyond-solar-system-and-universe/"
              target="_blank"
              rel="noopener noreferrer"
            >
              View publication ↗
              <span className="sr-only"> (opens the Pothi listing in a new tab)</span>
            </a>
          </div>
        </article>
      </section>

      <section className="founder-message" aria-labelledby="message-heading">
        <div className="founder-section-label">
          <span className="kicker">03 / A note to readers</span>
          <h2 id="message-heading">A message from the Founder.</h2>
        </div>
        <div className="founder-prose">
          <p>
            When I first became fascinated by the universe, I found myself surrounded by questions. How do we know what distant stars and planets are made of? How can we reconstruct the history of worlds we have never visited? What does a scientific discovery actually tell us, and where does the evidence stop?
          </p>
          <p>
            The more I explored science, the more I realised that curiosity needs to be accompanied by reliable information, careful reasoning, critical thinking and a willingness to acknowledge uncertainty.
          </p>
          <p>
            That realisation helped inspire ORBIT &amp; ORIGIN. I wanted to create a publication that brings together astronomy, scientific discoveries, technological innovation and the stories behind humanity’s expanding understanding of nature—not simply repeating headlines, but explaining the science, examining the evidence and communicating its significance.
          </p>
          <p>
            Through <em>Tapestry of Worlds</em>, we explore the universe and our place within it. Through <em>Frontier Tech</em>, we examine technologies and innovations shaping what comes next. Through <em>The Universal Record</em>, we document discoveries, milestones and moments that contribute to the history of science.
          </p>
          <p>
            My ambition is to make ORBIT &amp; ORIGIN accessible to curious readers across generations and geographical boundaries. We will strive to distinguish established findings from emerging ideas, evidence from interpretation, and scientific confidence from speculation. Science is a collective human endeavour; no individual publication has all the answers, and no discovery should be beyond examination.
          </p>
          <p>
            I hope this publication encourages readers to question, investigate, learn and remain curious. The universe is vast. Our understanding of it is still growing. There is always more to discover.
          </p>
          <p className="founder-signoff">Welcome to ORBIT &amp; ORIGIN.</p>
          <p className="founder-signature"><strong>Adarsh Kanojia</strong><span>Founder &amp; Editor-in-Chief</span></p>
        </div>
      </section>

      <nav className="founder-backlinks" aria-label="Related publication pages">
        <Link href="/about">About the publication</Link>
        <Link href="/editorial-standards">Editorial standards</Link>
      </nav>
    </main>
  );
}
