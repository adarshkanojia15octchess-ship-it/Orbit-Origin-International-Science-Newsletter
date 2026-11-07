import { createClient } from "@/lib/supabase/server";

export async function getAdminContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (
    error ||
    !user ||
    user.app_metadata?.role !== "admin" ||
    !configuredAdminEmail ||
    user.email?.toLowerCase() !== configuredAdminEmail
  ) {
    return null;
  }

  return { supabase, user };
}
