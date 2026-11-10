export const metadata = { title: "Subscribe" };

const messages: Record<string, string> = {
  "check-email": "Check your inbox for a confirmation link. Your subscription will become active only after you confirm.",
  confirmed: "Your email address is confirmed. You are now subscribed to future editions.",
  requested: "If this address can be subscribed, instructions will be sent to it.",
  "not-configured": "Subscriptions are temporarily unavailable because the email service has not been configured.",
  "email-error": "We could not send the confirmation email. Please try again later.",
  "rate-limited": "Too many attempts. Please wait before trying again.",
  "invalid-token": "That confirmation link is invalid or expired. Request a fresh subscription.",
  invalid: "Please enter a valid email address and accept the subscription consent.",
  error: "We could not process your request. Please try again later.",
};

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  return (
    <main className="page-shell">
      <span className="kicker">Join the readership</span>
      <h1>
        Stay curious.
        <br />
        <em>Explore further.</em>
      </h1>
      <p className="muted">
        Receive new editions directly in your inbox. Your subscription remains
        pending until you confirm your email address.
      </p>

      {status && (
        <p className="muted" role="status" style={{ marginTop: 24 }}>
          {messages[status] || "Your request has been received."}
        </p>
      )}

      <form action="/api/subscribe" method="post" style={{ marginTop: 36, maxWidth: 480 }}>
        <label className="form-field">
          Email address
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>

        <label className="form-field">
          First name <span className="muted">(optional)</span>
          <input
            type="text"
            name="first_name"
            maxLength={80}
            autoComplete="given-name"
            placeholder="Your first name"
          />
        </label>

        <div
          aria-hidden="true"
          style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}
        >
          <label>
            Leave this field empty
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, color: "var(--muted)" }}>
          <input type="checkbox" name="consent" value="yes" required style={{ marginTop: 5 }} />
          <span>
            I agree to receive ORBIT &amp; ORIGIN email editions and understand I
            can unsubscribe at any time. See the{" "}
            <a href="/privacy" style={{ textDecoration: "underline" }}>privacy policy</a>.
          </span>
        </label>

        <button type="submit" style={{ marginTop: 22 }}>Request subscription</button>
      </form>
    </main>
  );
}
