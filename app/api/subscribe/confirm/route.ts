import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") || "";
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.redirect(new URL("/subscribe?status=invalid-token", request.url));
  }

  try {
    const admin = createAdminClient();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: subscriber, error } = await admin
      .from("subscribers")
      .select("id, subscription_status, confirmation_expires_at")
      .eq("confirmation_token_hash", tokenHash)
      .eq("subscription_status", "pending")
      .maybeSingle();

    if (error || !subscriber || !subscriber.confirmation_expires_at || new Date(subscriber.confirmation_expires_at).getTime() < Date.now()) {
      return NextResponse.redirect(new URL("/subscribe?status=invalid-token", request.url));
    }

    const { error: updateError } = await admin
      .from("subscribers")
      .update({
        subscription_status: "active",
        confirmed_at: new Date().toISOString(),
        confirmation_token_hash: null,
        confirmation_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriber.id)
      .eq("subscription_status", "pending");

    if (updateError) return NextResponse.redirect(new URL("/subscribe?status=error", request.url));
    return NextResponse.redirect(new URL("/subscribe?status=confirmed", request.url));
  } catch {
    return NextResponse.redirect(new URL("/subscribe?status=error", request.url));
  }
}
