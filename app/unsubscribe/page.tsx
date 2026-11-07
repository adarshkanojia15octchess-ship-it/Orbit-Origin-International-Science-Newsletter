export const metadata = { title: "Unsubscribe" };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ status?: string; token?: string }> }) {
  const { status, token } = await searchParams;
  const message = status === "success"
    ? "Your email address has been unsubscribed from future editions."
    : status === "invalid"
      ? "This unsubscribe link is invalid. Contact the publication if you need assistance."
      : status === "error"
        ? "We could not process the request. Please try again later."
        : "Confirm below to stop future ORBIT & ORIGIN editions.";

  return (
    <main className="page-shell">
      <span className="kicker">Reader preferences</span>
      <h1>Unsubscribe.</h1>
      <p className="muted" role="status">{message}</p>
      {token && status !== "success" && (
        <form action="/api/unsubscribe" method="post" style={{ marginTop: 28 }}>
          <input type="hidden" name="token" value={token} />
          <button type="submit">Confirm unsubscribe</button>
        </form>
      )}
    </main>
  );
}
