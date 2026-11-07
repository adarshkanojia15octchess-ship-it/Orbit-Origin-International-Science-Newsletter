import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/005_atomic_issue_publish_claims.sql", import.meta.url),
  "utf8",
);
const worker = await readFile(
  new URL("../app/api/cron/publish-scheduled/route.ts", import.meta.url),
  "utf8",
);
const adminActions = await readFile(
  new URL("../app/admin/actions.ts", import.meta.url),
  "utf8",
);

test("scheduled issue claims use row locks with SKIP LOCKED", () => {
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /publish_claim_token/);
  assert.match(migration, /publish_claimed_at/);
  assert.match(migration, /interval '10 minutes'/i);
});

test("claim RPC is restricted to the server service role", () => {
  assert.match(migration, /revoke all on function public\.claim_due_scheduled_issues/i);
  assert.match(migration, /grant execute on function public\.claim_due_scheduled_issues[\s\S]*to service_role/i);
});

test("cron worker claims rows and commits only with its own claim token", () => {
  assert.match(worker, /rpc\(\s*"claim_due_scheduled_issues"/);
  assert.match(worker, /\.eq\("publish_claim_token", claimToken\)/);
  assert.match(worker, /publish_claim_token: null/);
});

test("cron worker verifies public copies before changing issue status", () => {
  assert.match(worker, /pdfVerification/);
  assert.match(worker, /coverVerification/);
  assert.match(worker, /pdfVerification\.data\.size !== pdfResult\.data\.size/);
  assert.match(worker, /coverVerification\.data\.size !== coverResult\.data\.size/);
});

test("failed competing publication transitions never delete shared public assets", () => {
  assert.doesNotMatch(worker, /issue-public"\)\.remove\(\[publicPdfPath, publicCoverPath\]\)/);
  const publishFailure = worker.split("if (publishError || !published)")[1]?.split("await admin.storage.from(\"issue-drafts\")")[0] ?? "";
  assert.doesNotMatch(publishFailure, /\.remove\(/);
});

test("admin publishing preserves public assets when its conditional update loses", () => {
  const publishAction = adminActions.split("export async function publishIssue")[1]?.split("const issueEditSchema")[0] ?? "";
  const failureBranch = publishAction.split("if (updateError || !published)")[1]?.split("await supabase.storage.from(\"issue-drafts\")")[0] ?? "";
  assert.match(publishAction, /\.select\("id"\)\s*\.maybeSingle\(\)/);
  assert.doesNotMatch(failureBranch, /issue-public[\s\S]*\.remove\(/);
});
