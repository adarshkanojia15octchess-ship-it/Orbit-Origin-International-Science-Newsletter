export const metadata = { title: "Unsubscribe" };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const message = status === "success"
    ? "Your email address has been unsubscribed from future editions."
    : status === "invalid"
      ? "This unsubscribe link is invalid or expired. Contact the publication if you need assistance."
      : status === "error"
        ? "We could not process the request. Please try again later."
        : "Use the unsubscribe link included in an ORBIT & ORIGIN email to stop future editions.";

  return (
    <main className="page-shell">
      <span className="kicker">Reader preferences</span>
      <h1>Unsubscribe.</h1>
      <p className="muted" role="status">{message}</p>
    </main>
  );
}
