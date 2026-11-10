import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/005_atomic_issue_publish_claims.sql", import.meta.url),
  "utf8",
);
const operationMigration = await readFile(
  new URL("../supabase/migrations/006_durable_publication_operations.sql", import.meta.url),
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

test("failed competing publication transitions never delete operation-owned public assets", () => {
  assert.doesNotMatch(worker, /issue-public"\)\.remove\(/);
  assert.match(worker, /fail_publication_operation/);
  assert.match(worker, /read_publication_operation/);
});

test("admin publishing resolves losing or ambiguous transitions through the registry", () => {
  const publishAction = adminActions.split("export async function publishIssue")[1]?.split("const issueEditSchema")[0] ?? "";
  assert.match(publishAction, /begin_publication_operation/);
  assert.match(publishAction, /complete_publication_operation/);
  assert.match(publishAction, /read_publication_operation/);
  assert.match(publishAction, /fail_publication_operation/);
  const failureBranch = publishAction.split("if (!operationCommitted)")[1]?.split("const sourceCleanup")[0] ?? "";
  assert.doesNotMatch(failureBranch, /\.remove\(/);
});

test("scheduled attempts use unique operation-owned paths and retain claim ownership", () => {
  assert.match(worker, /published\/\$\{operationId\}/);
  assert.match(worker, /p_operation_kind: "scheduled_publish"/);
  assert.match(worker, /p_claim_token: claimToken/);
  assert.match(worker, /complete_publication_operation/);
  assert.match(worker, /read_publication_operation/);
});

test("manual publication records its source version and operation-owned destination", () => {
  const publishAction = adminActions.split("export async function publishIssue")[1]?.split("const issueEditSchema")[0] ?? "";
  assert.match(publishAction, /published\/\$\{publicationOperation\}/);
  assert.match(publishAction, /p_source_pdf_url: pdfPath/);
  assert.match(publishAction, /p_source_cover_url: coverPath/);
  assert.match(publishAction, /p_source_updated_at: issue\.updated_at/);
});

test("unpublish commits through the registry before deleting old public assets", () => {
  const unpublishAction = adminActions.split("export async function unpublishIssue")[1] ?? "";
  const transitionIndex = unpublishAction.indexOf('"complete_publication_operation"');
  const cleanupIndex = unpublishAction.indexOf('from("issue-public").remove([publicPdfPath, publicCoverPath])');
  assert.ok(transitionIndex >= 0 && cleanupIndex > transitionIndex);
  assert.match(unpublishAction, /mark_publication_source_assets_cleaned/);
});

test("operation registry persists source and target ownership plus lifecycle state", () => {
  for (const field of [
    "operation_id", "issue_id", "operation_kind", "source_status",
    "source_pdf_url", "source_cover_url", "source_updated_at",
    "target_pdf_path", "target_cover_path", "claim_token",
    "lease_expires_at", "state", "db_committed_at",
    "source_cleanup_status", "cleanup_status", "recovery_attempts",
  ]) assert.match(operationMigration, new RegExp(field));
  assert.match(operationMigration, /publication_operations_one_active_per_issue/);
});

test("database completion atomically checks ownership and records the issue transition", () => {
  assert.match(operationMigration, /complete_publication_operation/);
  assert.match(operationMigration, /for update/i);
  assert.match(operationMigration, /v_issue\.updated_at is distinct from v_op\.source_updated_at/);
  assert.match(operationMigration, /state = 'committed'/);
  assert.match(operationMigration, /db_committed_at = now\(\)/);
});

test("recovery requires expired lease, grace period, and global reference checks", () => {
  assert.match(operationMigration, /abandon_expired_publication_operation/);
  assert.match(operationMigration, /lease_expires_at <= now\(\) - make_interval/);
  assert.match(operationMigration, /mark_publication_cleanup_pending/);
  assert.match(operationMigration, /lock table public\.issues in share mode/i);
  assert.match(operationMigration, /guard_retired_publication_assets/);
  assert.doesNotMatch(operationMigration, /storage\.from\(|delete from storage/);
});

test("committed operations retain source cleanup state until verified", () => {
  assert.match(operationMigration, /source_cleanup_status = 'pending'/);
  assert.match(operationMigration, /mark_publication_source_assets_cleaned/);
  assert.match(operationMigration, /source_cleanup_status = 'complete'/);
});
