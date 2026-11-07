#!/usr/bin/env bash
set -euo pipefail
: "$DATABASE_URL"
PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -At)
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

"\${PSQL[@]}" <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
SQL
"\${PSQL[@]}" -f supabase/migrations/001_initial_schema.sql
"\${PSQL[@]}" -c "alter table public.issues add column if not exists scheduled_at timestamptz"
"\${PSQL[@]}" -f supabase/migrations/005_atomic_issue_publish_claims.sql
"\${PSQL[@]}" -f supabase/migrations/006_durable_publication_operations.sql

assert_eq() {
  [[ "$1" == "$2" ]] || { echo "FAIL: $3 (expected '$2', got '$1')" >&2; exit 1; }
  echo "PASS: $3"
}
insert_issue() {
  local id="$1" number="$2" status="$3" slug="$4"
  "\${PSQL[@]}" -c "insert into public.issues
    (id, issue_number, title, slug, description, publication_date, departments, status,
     scheduled_at, pdf_url, cover_image_url)
    values ('$id', $number, 'Registry fixture $number', '$slug', 'Registry integration fixture',
      current_date, array['frontier-tech'], '$status',
      case when '$status' = 'scheduled' then now() - interval '1 minute' else null end,
      'issues/$number/source.pdf', 'issues/$number/source-cover.jpg')" >/dev/null
}

ISSUE_A="30000000-0000-4000-8000-000000000001"
OP_A="40000000-0000-4000-8000-000000000001"
OP_B="40000000-0000-4000-8000-000000000002"
insert_issue "$ISSUE_A" 920001 draft registry-competing-publish
SOURCE_UPDATED="$("\${PSQL[@]}" -c "select updated_at from public.issues where id='$ISSUE_A'")"
BEGIN_SQL_A="select public.begin_publication_operation('$OP_A','$ISSUE_A','manual_publish','draft','issues/920001/source.pdf','issues/920001/source-cover.jpg','$SOURCE_UPDATED','issues/920001/published/$OP_A/edition.pdf','issues/920001/published/$OP_A/cover.jpg','https://storage.invalid/issues/920001/published/$OP_A/edition.pdf','https://storage.invalid/issues/920001/published/$OP_A/cover.jpg',null,600)"
BEGIN_SQL_B="select public.begin_publication_operation('$OP_B','$ISSUE_A','manual_publish','draft','issues/920001/source.pdf','issues/920001/source-cover.jpg','$SOURCE_UPDATED','issues/920001/published/$OP_B/edition.pdf','issues/920001/published/$OP_B/cover.jpg','https://storage.invalid/issues/920001/published/$OP_B/edition.pdf','https://storage.invalid/issues/920001/published/$OP_B/cover.jpg',null,600)"
"\${PSQL[@]}" -c "$BEGIN_SQL_A" > "$TMP/a" & PA=$!
"\${PSQL[@]}" -c "$BEGIN_SQL_B" > "$TMP/b" & PB=$!
wait "$PA"; wait "$PB"
WINNERS=$(( $(grep -E -c "$OP_A|$OP_B" "$TMP/a" "$TMP/b" || true) ))
assert_eq "$WINNERS" "1" "competing publication sessions have one operation owner"
WINNER="$(cat "$TMP/a" "$TMP/b" | grep -E "$OP_A|$OP_B" | head -n1)"
COMPLETED="$("\${PSQL[@]}" -c "select public.complete_publication_operation('$WINNER')")"
assert_eq "$COMPLETED" "t" "winning publication commits atomically"
RETRY="$("\${PSQL[@]}" -c "select public.complete_publication_operation('$WINNER')")"
assert_eq "$RETRY" "t" "ambiguous completion retry resolves idempotently"
STATE="$("\${PSQL[@]}" -c "select state from public.publication_operations where operation_id='$WINNER'")"
assert_eq "$STATE" "committed" "committed operation is durably distinguishable"
ISSUE_STATUS="$("\${PSQL[@]}" -c "select status from public.issues where id='$ISSUE_A'")"
assert_eq "$ISSUE_STATUS" "published" "issue and operation commit in one database transaction"
COMMITTED_CLEANUP="$("\${PSQL[@]}" -c "select public.mark_publication_cleanup_pending('$WINNER',0)")"
assert_eq "$COMMITTED_CLEANUP" "f" "committed publication assets are protected"

ISSUE_B="30000000-0000-4000-8000-000000000002"
OP_C="40000000-0000-4000-8000-000000000003"
insert_issue "$ISSUE_B" 920002 draft registry-interrupted-upload
SOURCE_UPDATED_B="$("\${PSQL[@]}" -c "select updated_at from public.issues where id='$ISSUE_B'")"
"\${PSQL[@]}" -c "select public.begin_publication_operation('$OP_C','$ISSUE_B','manual_publish','draft','issues/920002/source.pdf','issues/920002/source-cover.jpg','$SOURCE_UPDATED_B','issues/920002/published/$OP_C/edition.pdf','issues/920002/published/$OP_C/cover.jpg','https://storage.invalid/issues/920002/published/$OP_C/edition.pdf','https://storage.invalid/issues/920002/published/$OP_C/cover.jpg',null,1)" >/dev/null
sleep 1.2
EXPIRED_COMPLETE="$("\${PSQL[@]}" -c "select public.complete_publication_operation('$OP_C')")"
assert_eq "$EXPIRED_COMPLETE" "f" "expired operation cannot complete"
ABANDON="$("\${PSQL[@]}" -c "select public.abandon_expired_publication_operation('$OP_C',0)")"
assert_eq "$ABANDON" "t" "expired operation requires explicit abandonment"
STALE_COMPLETE="$("\${PSQL[@]}" -c "select public.complete_publication_operation('$OP_C')")"
assert_eq "$STALE_COMPLETE" "f" "abandoned stale worker cannot commit"
CLEANUP_PENDING="$("\${PSQL[@]}" -c "select public.mark_publication_cleanup_pending('$OP_C',0)")"
assert_eq "$CLEANUP_PENDING" "t" "unreferenced abandoned operation becomes cleanup candidate"
CLEANUP_RETRY="$("\${PSQL[@]}" -c "select public.mark_publication_cleanup_pending('$OP_C',0)")"
assert_eq "$CLEANUP_RETRY" "t" "recovery eligibility is idempotent"

ISSUE_C="30000000-0000-4000-8000-000000000003"
OP_D="40000000-0000-4000-8000-000000000004"
OP_E="40000000-0000-4000-8000-000000000005"
insert_issue "$ISSUE_C" 920003 published registry-unpublish-race
"\${PSQL[@]}" -c "update public.issues set pdf_url='https://storage.invalid/live/edition.pdf', cover_image_url='https://storage.invalid/live/cover.jpg' where id='$ISSUE_C'" >/dev/null
SOURCE_UPDATED_C="$("\${PSQL[@]}" -c "select updated_at from public.issues where id='$ISSUE_C'")"
UNPUBLISH="$("\${PSQL[@]}" -c "select public.begin_publication_operation('$OP_D','$ISSUE_C','unpublish','published','https://storage.invalid/live/edition.pdf','https://storage.invalid/live/cover.jpg','$SOURCE_UPDATED_C','issues/920003/drafts/$OP_D/edition.pdf','issues/920003/drafts/$OP_D/cover.jpg','issues/920003/drafts/$OP_D/edition.pdf','issues/920003/drafts/$OP_D/cover.jpg',null,600)")"
assert_eq "$UNPUBLISH" "$OP_D" "unpublish obtains exclusive operation ownership"
COMPETING_PUBLISH="$("\${PSQL[@]}" -c "select public.begin_publication_operation('$OP_E','$ISSUE_C','manual_publish','published','https://storage.invalid/live/edition.pdf','https://storage.invalid/live/cover.jpg','$SOURCE_UPDATED_C','issues/920003/published/$OP_E/edition.pdf','issues/920003/published/$OP_E/cover.jpg','https://storage.invalid/issues/920003/published/$OP_E/edition.pdf','https://storage.invalid/issues/920003/published/$OP_E/cover.jpg',null,600)")"
assert_eq "$COMPETING_PUBLISH" "" "publish cannot race an active unpublish operation"
UNPUBLISH_COMMIT="$("\${PSQL[@]}" -c "select public.complete_publication_operation('$OP_D')")"
assert_eq "$UNPUBLISH_COMMIT" "t" "unpublish transition commits with operation ledger"
UNPUBLISHED_STATUS="$("\${PSQL[@]}" -c "select status from public.issues where id='$ISSUE_C'")"
assert_eq "$UNPUBLISHED_STATUS" "draft" "unpublish moves issue to draft atomically"

echo "Durable publication operation PostgreSQL suite passed."
