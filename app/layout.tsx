import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ORBIT & ORIGIN — Exploring the Universe",
    template: "%s | ORBIT & ORIGIN",
  },
  description: "An independent science and astronomy publication.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
};

const nav = [
  ["Issues", "/issues"],
  ["Articles", "/articles"],
  ["Tapestry of Worlds", "/departments/tapestry-of-worlds"],
  ["Frontier Tech", "/departments/frontier-tech"],
  ["The Universal Record", "/departments/universal-record"],
  ["About", "/about"],
  ["Founder", "/about/founder"],
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "adarshkanojia15octchess@gmail.com";
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link className="wordmark" href="/">
            ORBIT <span>&amp;</span> ORIGIN
          </Link>
          <nav aria-label="Main navigation">
            {nav.map(([label, href]) => (
              <Link key={href} href={href}>{label}</Link>
            ))}
          </nav>
          <Link className="subscribe-link" href="/subscribe">Subscribe ↗</Link>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div>
            <Link className="wordmark" href="/">ORBIT <span>&amp;</span> ORIGIN</Link>
            <p>Exploring the Universe, Understanding Our Place.</p>
            <p className="footer-founder">Founded and edited by Adarsh Kanojia.</p>
            <p className="footer-contact"><a href={"mailto:" + contactEmail}>{contactEmail}</a></p>
          </div>
          <div className="footer-links">
            <Link href="/about">About</Link>
            <Link href="/about/founder">Founder</Link>
            <Link href="/editorial-standards">Editorial Standards</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/subscribe">Subscribe</Link>
          </div>
          <small>
            © 2026 Adarsh Kanojia. All rights reserved.
            <span>Independent science publishing. Accuracy before sensationalism.</span>
          </small>
        </footer>
      </body>
    </html>
  );
}
