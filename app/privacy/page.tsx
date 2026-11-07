export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="page-shell">
      <span className="kicker">Reader privacy</span>
      <h1>Privacy policy.</h1>
      <p className="muted">This page describes the intended privacy practices for ORBIT & ORIGIN. It must be reviewed and updated with the actual hosting, analytics and email-provider details before public launch.</p>
      <h2 style={{ marginTop: 40 }}>Newsletter subscriptions</h2>
      <p className="muted">If you subscribe, the publication will use your email address and optional first name to send editions and subscription-related messages. A confirmation step should be completed before marketing or newsletter delivery begins.</p>
      <h2>Unsubscribing</h2>
      <p className="muted">Every newsletter should provide a clear unsubscribe link. Unsubscribing should stop future campaign delivery while retaining only the minimum record needed to honour that request.</p>
      <h2>Service providers</h2>
      <p className="muted">The planned platform uses Supabase for database and storage services and Resend for email delivery. Provider processing and retention details must be linked here after production configuration.</p>
      <h2>Data requests</h2>
      <p className="muted">For questions about subscription data, use the contact details on the Contact page.</p>
      <p className="muted">Last reviewed: 7 November 2026.</p>
    </main>
  );
}
