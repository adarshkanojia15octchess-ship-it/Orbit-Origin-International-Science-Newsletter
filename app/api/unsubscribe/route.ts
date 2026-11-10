import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const token = String(form.get("token") || "");
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.redirect(new URL("/unsubscribe?status=invalid", request.url));
  }

  try {
    const admin = createAdminClient();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: subscriber, error } = await admin
      .from("subscribers")
      .select("id, subscription_status")
      .eq("unsubscribe_token_hash", tokenHash)
      .maybeSingle();

    if (error || !subscriber) {
      return NextResponse.redirect(new URL("/unsubscribe?status=invalid", request.url));
    }
    if (subscriber.subscription_status === "unsubscribed") {
      return NextResponse.redirect(new URL("/unsubscribe?status=success", request.url));
    }

    const { error: updateError } = await admin
      .from("subscribers")
      .update({
        subscription_status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriber.id);

    if (updateError) return NextResponse.redirect(new URL("/unsubscribe?status=error", request.url));
    return NextResponse.redirect(new URL("/unsubscribe?status=success", request.url));
  } catch {
    return NextResponse.redirect(new URL("/unsubscribe?status=error", request.url));
  }
}
