#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must point to a disposable PostgreSQL database}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -At)
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

"${PSQL[@]}" <<'SQL'
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
SQL
"${PSQL[@]}" -f "$ROOT/supabase/migrations/001_initial_schema.sql"
"${PSQL[@]}" -c "alter table public.issues add column if not exists scheduled_at timestamptz"
"${PSQL[@]}" -f "$ROOT/supabase/migrations/005_atomic_issue_publish_claims.sql"

insert_issue() {
  local id="$1" number="$2" status="$3" slug="$4"
  "${PSQL[@]}" -c "insert into public.issues
    (id, issue_number, title, slug, description, publication_date, departments, status,
     scheduled_at, pdf_url, cover_image_url)
    values ('$id', $number, 'Concurrency fixture $number', '$slug', 'PostgreSQL concurrency fixture',
      current_date, array['frontier-tech'], '$status',
      case when '$status' = 'scheduled' then now() - interval '1 minute' else null end,
      'issues/$number/source.pdf', 'issues/$number/source-cover.jpg')"
}
assert_eq() {
  [[ "$1" == "$2" ]] || { echo "FAIL: $3 (expected '$2', got '$1')" >&2; exit 1; }
  echo "PASS: $3"
}

ISSUE_A="10000000-0000-4000-8000-000000000001"
TOKEN_A="20000000-0000-4000-8000-000000000001"
TOKEN_B="20000000-0000-4000-8000-000000000002"
insert_issue "$ISSUE_A" 910001 scheduled pg-claim-race
"${PSQL[@]}" -c "select id from public.claim_due_scheduled_issues('$TOKEN_A', now(), 1)" > "$TMP/a" &
PA=$!
"${PSQL[@]}" -c "select id from public.claim_due_scheduled_issues('$TOKEN_B', now(), 1)" > "$TMP/b" &
PB=$!
wait "$PA"; wait "$PB"
CLAIMS=$(( $(wc -l < "$TMP/a") + $(wc -l < "$TMP/b") ))
assert_eq "$CLAIMS" "1" "two scheduled workers yield exactly one row claim"
WINNER="$("${PSQL[@]}" -c "select publish_claim_token from public.issues where id='$ISSUE_A'")"
"${PSQL[@]}" -c "update public.issues set publish_claimed_at=now()-interval '11 minutes' where id='$ISSUE_A'" >/dev/null
RECLAIM="20000000-0000-4000-8000-000000000003"
RECLAIMED="$("${PSQL[@]}" -c "select count(*) from public.claim_due_scheduled_issues('$RECLAIM', now(), 1) where id='$ISSUE_A'")"
assert_eq "$RECLAIMED" "1" "expired claim can be reclaimed"
STALE="$("${PSQL[@]}" -c "with changed as (update public.issues set status='published' where id='$ISSUE_A' and status='scheduled' and publish_claim_token='$WINNER' returning id) select count(*) from changed")"
assert_eq "$STALE" "0" "stale worker cannot commit after claim loss"
CURRENT="$("${PSQL[@]}" -c "with changed as (update public.issues set status='published', publish_claim_token=null, publish_claimed_at=null where id='$ISSUE_A' and status='scheduled' and publish_claim_token='$RECLAIM' returning id) select count(*) from changed")"
assert_eq "$CURRENT" "1" "current claim owner can commit"

ISSUE_B="10000000-0000-4000-8000-000000000002"
insert_issue "$ISSUE_B" 910002 draft pg-manual-race
MANUAL_SQL="with changed as (update public.issues set status='published', pdf_url='https://assets.invalid/op/edition.pdf', cover_image_url='https://assets.invalid/op/cover.jpg' where id='$ISSUE_B' and status in ('draft','scheduled') and pdf_url='issues/910002/source.pdf' and cover_image_url='issues/910002/source-cover.jpg' returning id) select count(*) from changed"
"${PSQL[@]}" -c "$MANUAL_SQL" > "$TMP/manual-a" & PA=$!
"${PSQL[@]}" -c "$MANUAL_SQL" > "$TMP/manual-b" & PB=$!
wait "$PA"; wait "$PB"
MANUAL_WINS=$(( $(cat "$TMP/manual-a") + $(cat "$TMP/manual-b") ))
assert_eq "$MANUAL_WINS" "1" "two manual publishers have one source-version winner"

ISSUE_C="10000000-0000-4000-8000-000000000003"
TOKEN_C="20000000-0000-4000-8000-000000000004"
insert_issue "$ISSUE_C" 910003 scheduled pg-manual-vs-cron
"${PSQL[@]}" -c "select id from public.claim_due_scheduled_issues('$TOKEN_C', now(), 1)" >/dev/null
MANUAL_WIN="$("${PSQL[@]}" -c "with changed as (update public.issues set status='published', pdf_url='https://assets.invalid/manual/edition.pdf', cover_image_url='https://assets.invalid/manual/cover.jpg', publish_claim_token=null, publish_claimed_at=null where id='$ISSUE_C' and status in ('draft','scheduled') and pdf_url='issues/910003/source.pdf' and cover_image_url='issues/910003/source-cover.jpg' returning id) select count(*) from changed")"
assert_eq "$MANUAL_WIN" "1" "manual publisher wins against scheduled worker"
CRON_STALE="$("${PSQL[@]}" -c "with changed as (update public.issues set status='published' where id='$ISSUE_C' and status='scheduled' and publish_claim_token='$TOKEN_C' and pdf_url='issues/910003/source.pdf' and cover_image_url='issues/910003/source-cover.jpg' returning id) select count(*) from changed")"
assert_eq "$CRON_STALE" "0" "scheduled worker cannot commit after manual winner"
echo "PostgreSQL publication concurrency suite passed."
