"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInAdmin(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const allowedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!allowedEmail || email !== allowedEmail || !password || password.length > 256) {
    redirect("/admin/login?error=invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/admin/login?error=invalid");

  const { data } = await supabase.auth.getUser();
  if (!data.user || data.user.app_metadata?.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/admin/login?error=unauthorised");
  }

  redirect("/admin");
}

export async function signOutAdmin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
