export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <main className="page-shell">
      <span className="kicker">Get in touch</span>
      <h1>Conversations start with curiosity.</h1>
      <p className="muted" style={{ maxWidth: 680 }}>For editorial feedback, corrections, research suggestions, image-credit questions or collaboration enquiries, contact the publication team.</p>
      <p style={{ marginTop: 28 }}>Email: <a href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || "editor@orbitandorigin.org"}`} style={{ textDecoration: "underline" }}>{process.env.NEXT_PUBLIC_CONTACT_EMAIL || "editor@orbitandorigin.org"}</a></p>
      <p className="muted">Please include source links for scientific corrections or research suggestions.</p>
    </main>
  );
}
