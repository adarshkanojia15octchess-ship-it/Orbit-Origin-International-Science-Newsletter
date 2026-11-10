export const metadata = { title: "Contact", description: "Contact ORBIT & ORIGIN for editorial feedback, corrections and research suggestions." };

const contactEmail = "adarshkanojia15octchess@gmail.com";

export default function ContactPage() {
  return (
    <main className="page-shell">
      <span className="kicker">Get in touch</span>
      <h1>Conversations start with curiosity.</h1>
      <p className="muted" style={{ maxWidth: 680 }}>For editorial feedback, corrections, research suggestions, image-credit questions or collaboration enquiries, contact the publication team.</p>
      <p style={{ marginTop: 28 }}>Email: <a href={"mailto:" + contactEmail} style={{ textDecoration: "underline" }}>{contactEmail}</a></p>
      <p className="muted">Please include source links for scientific corrections or research suggestions.</p>
    </main>
  );
}
