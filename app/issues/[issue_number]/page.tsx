import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Issue } from "@/lib/types";

type Props = { params: Promise<{ issue_number: string }> };

export default async function IssueNumberRedirect({ params }: Props) {
  const { issue_number } = await params;
  const number = Number(issue_number);
  if (!Number.isSafeInteger(number) || number < 1) notFound();
  const db = await createClient();
  const { data, error } = await db.from("issues").select("id").eq("issue_number", number).eq("status", "published").maybeSingle();
  if (error || !data) notFound();
  redirect("/reader/" + (data as Pick<Issue, "id">).id);
}
