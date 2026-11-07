import { createHash, createHmac, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email().max(254),
  first_name: z.string().trim().max(80).optional().default(""),
  consent: z.literal("yes"),
  website: z.string().max(0).optional().default(""),
});

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}

function redirectTo(request: NextRequest, status: string) {
  const url = new URL("/subscribe", request.url);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirectTo(request, "invalid");
  }

  const parsed = schema.safeParse({
    email: form.get("email"),
    first_name: form.get("first_name") || "",
    consent: form.get("consent"),
    website: form.get("website") || "",
  });
  if (!parsed.success) return redirectTo(request, "invalid");
  if (parsed.data.website) return redirectTo(request, "requested");

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const rateSecret = process.env.SUBSCRIPTION_RATE_LIMIT_SECRET;
  const unsubscribeSecret = process.env.UNSUBSCRIBE_SECRET;
  if (!apiKey || !from || !siteUrl || !rateSecret || !unsubscribeSecret) {
    return redirectTo(request, "not-configured");
  }

  // Vercel overwrites its client-IP headers at the edge to prevent spoofing.
  // On other hosts, do not trust arbitrary forwarded headers: share the
  // conservative "unknown" bucket until a trusted-proxy adapter is configured.
  const remoteAddress = process.env.VERCEL === "1"
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "unknown";
  const rateKey = createHmac("sha256", rateSecret).update(remoteAddress).digest("hex");

  try {
    const admin = createAdminClient();
    const { data: allowed, error: rateError } = await admin.rpc("consume_subscription_rate_limit", { p_key_hash: rateKey });
    if (rateError || allowed !== true) return redirectTo(request, "rate-limited");

    const email = parsed.data.email.toLowerCase();
    const confirmationToken = randomBytes(32).toString("hex");
    const confirmationHash = hash(confirmationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: existing, error: lookupError } = await admin
      .from("subscribers")
      .select("id, subscription_status")
      .eq("email", email)
      .maybeSingle();
    if (lookupError) return redirectTo(request, "error");

    let subscriberId: string;
    if (existing) {
      if (existing.subscription_status === "active") return redirectTo(request, "requested");
      const { data, error } = await admin
        .from("subscribers")
        .update({
          first_name: parsed.data.first_name || null,
          subscription_status: "pending",
          confirmation_token_hash: confirmationHash,
          confirmation_expires_at: expiresAt,
          consent_at: new Date().toISOString(),
          confirmed_at: null,
          unsubscribed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error || !data) return redirectTo(request, "error");
      subscriberId = data.id;
    } else {
      const { data, error } = await admin
        .from("subscribers")
        .insert({
          email,
          first_name: parsed.data.first_name || null,
          subscription_status: "pending",
          confirmation_token_hash: confirmationHash,
          confirmation_expires_at: expiresAt,
          consent_at: new Date().toISOString(),
          unsubscribe_token_hash: hash(createHmac("sha256", unsubscribeSecret).update("pending:" + email).digest("hex")),
        })
        .select("id")
        .single();
      if (error || !data) {
        if (error?.code === "23505") return redirectTo(request, "requested");
        return redirectTo(request, "error");
      }
      subscriberId = data.id;
    }

    const unsubscribeToken = createHmac("sha256", unsubscribeSecret).update(subscriberId).digest("hex");
    const { error: tokenError } = await admin
      .from("subscribers")
      .update({ unsubscribe_token_hash: hash(unsubscribeToken), updated_at: new Date().toISOString() })
      .eq("id", subscriberId);
    if (tokenError) return redirectTo(request, "error");

    const confirmationUrl = new URL("/api/subscribe/confirm", siteUrl);
    confirmationUrl.searchParams.set("token", confirmationToken);
    const firstName = parsed.data.first_name ? ` ${escapeHtml(parsed.data.first_name)}` : "";
    const resend = new Resend(apiKey);
    const { error: sendError } = await resend.emails.send({
      from,
      to: [email],
      subject: "Confirm your ORBIT & ORIGIN subscription",
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#14263a;line-height:1.6"><p style="letter-spacing:3px">ORBIT &amp; ORIGIN</p><h1 style="font-family:Georgia,serif;font-weight:normal">One last step${firstName}.</h1><p>Confirm your email address to receive future science and astronomy editions.</p><p><a href="${confirmationUrl.toString()}" style="display:inline-block;padding:13px 20px;background:#0d2942;color:#fff;text-decoration:none">Confirm subscription</a></p><p style="font-size:13px;color:#64748b">This link expires in 24 hours. If you did not request this subscription, you can ignore this email.</p></div>`,
    });
    if (sendError) return redirectTo(request, "email-error");
    return redirectTo(request, "check-email");
  } catch {
    return redirectTo(request, "error");
  }
}
