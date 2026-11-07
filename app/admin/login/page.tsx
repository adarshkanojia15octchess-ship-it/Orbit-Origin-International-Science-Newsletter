import { signInAdmin } from "./actions";

export const metadata = { title: "Administrator Sign In" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="page-shell" style={{ maxWidth: 620 }}>
      <span className="kicker">Restricted area</span>
      <h1>Editorial administration.</h1>
      <p className="muted">Sign in with the authorised publication administrator account.</p>
      {error && <p role="alert" className="muted">Sign-in failed. Check the authorised account and password.</p>}
      <form action={signInAdmin} style={{ marginTop: 32 }}>
        <label className="form-field">Administrator email<input type="email" name="email" autoComplete="username" required maxLength={254}/></label>
        <label className="form-field">Password<input type="password" name="password" autoComplete="current-password" required maxLength={256}/></label>
        <button type="submit">Sign in securely</button>
      </form>
    </main>
  );
}
