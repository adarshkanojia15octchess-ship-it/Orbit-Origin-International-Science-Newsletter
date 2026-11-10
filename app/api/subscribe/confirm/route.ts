import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { confirmPendingSubscription } from "@/lib/subscription/confirmation.mjs";

export const runtime = "nodejs";

function confirmationPage(token: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Confirm ORBIT &amp; ORIGIN</title>
</head>
<body style="margin:0;padding:40px 16px;background:#f4f7f9;color:#14263a;font:16px/1.6 Arial,sans-serif">
  <main style="max-width:560px;margin:48px auto;padding:32px;background:#fff;border:1px solid #dce4eb">
    <p style="letter-spacing:3px;font-size:12px">ORBIT &amp; ORIGIN</p>
    <h1 style="font-family:Georgia,serif;font-weight:normal">Confirm your subscription</h1>
    <p>Press the button below to confirm that you want to receive science and astronomy editions by email.</p>
    <form method="post" action="/api/subscribe/confirm">
      <input type="hidden" name="token" value="${token}">
      <button type="submit" style="border:0;padding:14px 20px;background:#0d2942;color:#fff;font-size:15px;cursor:pointer">Confirm subscription</button>
    </form>
    <p style="font-size:13px;color:#64748b">If you did not request this subscription, you can close this page.</p>
  </main>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.redirect(new URL("/subscribe?status=invalid-token", request.url));
  }

  // Mail scanners may visit links; GET deliberately performs no database write.
  return new NextResponse(confirmationPage(token), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; form-action 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.redirect(new URL("/subscribe?status=invalid-token", request.url));
  }

  const token = String(form.get("token") || "");
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.redirect(new URL("/subscribe?status=invalid-token", request.url));
  }

  try {
    const admin = createAdminClient();
    const result = await confirmPendingSubscription({
      token,
      activatePendingByHash: async (tokenHash, now) => {
        const { data, error } = await admin
          .from("subscribers")
          .update({
            subscription_status: "active",
            confirmed_at: now.toISOString(),
            confirmation_token_hash: null,
            confirmation_expires_at: null,
            updated_at: now.toISOString(),
          })
          .eq("confirmation_token_hash", tokenHash)
          .eq("subscription_status", "pending")
          .gt("confirmation_expires_at", now.toISOString())
          .select("id")
          .maybeSingle();

        if (error) throw error;
        return Boolean(data);
      },
    });

    if (result !== "confirmed") {
      return NextResponse.redirect(new URL("/subscribe?status=invalid-token", request.url));
    }
    return NextResponse.redirect(new URL("/subscribe?status=confirmed", request.url));
  } catch {
    return NextResponse.redirect(new URL("/subscribe?status=error", request.url));
  }
}
