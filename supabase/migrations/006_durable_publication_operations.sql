-- Phase 2A: durable publication operation ledger.
-- Storage and PostgreSQL cannot participate in one transaction. This ledger
-- makes ownership and the database commit explicit; it deliberately does not
-- delete storage objects. A later cleanup worker must re-check ownership.
create table if not exists public.publication_operations (
  operation_id uuid primary key,
  issue_id uuid not null references public.issues(id) on delete restrict,
  issue_number integer not null,
  operation_kind text not null check (operation_kind in ('manual_publish', 'scheduled_publish', 'unpublish')),
  state text not null default 'active'
    check (state in ('active', 'committed', 'failed', 'abandoned', 'cleanup_pending', 'cleaned')),
  source_status text not null check (source_status in ('draft', 'scheduled', 'published')),
  source_pdf_url text not null,
  source_cover_url text not null,
  source_updated_at timestamptz not null,
  target_pdf_path text not null,
  target_cover_path text not null,
  target_pdf_url text not null,
  target_cover_url text not null,
  claim_token uuid,
  lease_expires_at timestamptz not null,
  failure_reason text,
  cleanup_status text not null default 'not_eligible'
    check (cleanup_status in ('not_eligible', 'pending', 'complete')),
  source_cleanup_status text not null default 'not_required'
    check (source_cleanup_status in ('not_required', 'pending', 'complete')),
  recovery_attempts integer not null default 0 check (recovery_attempts >= 0),
  last_recovery_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  db_committed_at timestamptz,
  reconciled_at timestamptz,
  constraint publication_operation_target_paths_distinct
    check (target_pdf_path <> target_cover_path),
  constraint publication_operation_claim_kind
    check ((operation_kind = 'scheduled_publish' and claim_token is not null)
        or (operation_kind <> 'scheduled_publish' and claim_token is null))
);

create unique index if not exists publication_operations_one_active_per_issue
  on public.publication_operations(issue_id) where state = 'active';
create index if not exists publication_operations_recovery_idx
  on public.publication_operations(state, lease_expires_at, created_at);
create index if not exists publication_operations_issue_idx
  on public.publication_operations(issue_id, created_at desc);

alter table public.publication_operations enable row level security;
revoke all on public.publication_operations from public, anon, authenticated;
grant select on public.publication_operations to service_role;

create or replace function public.begin_publication_operation(
  p_operation_id uuid,
  p_issue_id uuid,
  p_operation_kind text,
  p_source_status text,
  p_source_pdf_url text,
  p_source_cover_url text,
  p_source_updated_at timestamptz,
  p_target_pdf_path text,
  p_target_cover_path text,
  p_target_pdf_url text,
  p_target_cover_url text,
  p_claim_token uuid default null,
  p_lease_seconds integer default 600
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issue public.issues%rowtype;
begin
  if p_operation_kind not in ('manual_publish', 'scheduled_publish', 'unpublish')
     or p_lease_seconds < 1 or p_lease_seconds > 3600
     or p_target_pdf_path is null or p_target_cover_path is null
     or p_target_pdf_url is null or p_target_cover_url is null
     or p_target_pdf_path = p_target_cover_path then
    return null;
  end if;
  if (p_operation_kind = 'scheduled_publish' and (p_claim_token is null or p_source_status <> 'scheduled'))
     or (p_operation_kind = 'manual_publish' and p_source_status not in ('draft', 'scheduled'))
     or (p_operation_kind = 'unpublish' and p_source_status <> 'published') then
    return null;
  end if;

  select * into v_issue from public.issues where id = p_issue_id for update;
  if not found
     or v_issue.status <> p_source_status
     or v_issue.pdf_url is distinct from p_source_pdf_url
     or v_issue.cover_image_url is distinct from p_source_cover_url
     or v_issue.updated_at is distinct from p_source_updated_at
     or (p_operation_kind = 'scheduled_publish'
         and (v_issue.publish_claim_token is distinct from p_claim_token
           or v_issue.publish_claimed_at is null
           or v_issue.publish_claimed_at <= now() - interval '10 minutes')) then
    return null;
  end if;

  begin
    insert into public.publication_operations (
      operation_id, issue_id, issue_number, operation_kind, source_status,
      source_pdf_url, source_cover_url, source_updated_at,
      target_pdf_path, target_cover_path, target_pdf_url, target_cover_url,
      claim_token, lease_expires_at
    ) values (
      p_operation_id, p_issue_id, v_issue.issue_number, p_operation_kind, p_source_status,
      p_source_pdf_url, p_source_cover_url, p_source_updated_at,
      p_target_pdf_path, p_target_cover_path, p_target_pdf_url, p_target_cover_url,
      p_claim_token, now() + make_interval(secs => p_lease_seconds)
    );
  exception when unique_violation then
    return null;
  end;
  return p_operation_id;
end;
$$;

create or replace function public.heartbeat_publication_operation(
  p_operation_id uuid,
  p_lease_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_lease_seconds < 1 or p_lease_seconds > 3600 then return false; end if;
  update public.publication_operations
     set lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         updated_at = now()
   where operation_id = p_operation_id
     and state = 'active'
     and lease_expires_at > now();
  return found;
end;
$$;

create or replace function public.complete_publication_operation(p_operation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op public.publication_operations%rowtype;
  v_issue public.issues%rowtype;
begin
  select * into v_op from public.publication_operations
   where operation_id = p_operation_id for update;
  if not found then return false; end if;
  -- Idempotent response recovery: an ambiguous RPC result can be resolved by
  -- retrying or reading this committed row; never re-run a committed transition.
  if v_op.state = 'committed' then return true; end if;
  if v_op.state <> 'active' or v_op.lease_expires_at <= now() then return false; end if;

  select * into v_issue from public.issues where id = v_op.issue_id for update;
  if not found
     or v_issue.status <> v_op.source_status
     or v_issue.pdf_url is distinct from v_op.source_pdf_url
     or v_issue.cover_image_url is distinct from v_op.source_cover_url
     or v_issue.updated_at is distinct from v_op.source_updated_at
     or (v_op.operation_kind = 'scheduled_publish'
         and (v_issue.publish_claim_token is distinct from v_op.claim_token
           or v_issue.publish_claimed_at is null
           or v_issue.publish_claimed_at <= now() - interval '10 minutes')) then
    return false;
  end if;

  if v_op.operation_kind = 'unpublish' then
    update public.issues set
      pdf_url = v_op.target_pdf_url,
      cover_image_url = v_op.target_cover_url,
      status = 'draft',
      scheduled_at = null,
      publish_claim_token = null,
      publish_claimed_at = null,
      updated_at = now()
    where id = v_op.issue_id;
  else
    update public.issues set
      pdf_url = v_op.target_pdf_url,
      cover_image_url = v_op.target_cover_url,
      status = 'published',
      scheduled_at = null,
      publish_claim_token = null,
      publish_claimed_at = null,
      updated_at = now()
    where id = v_op.issue_id;
  end if;

  update public.publication_operations set
    state = 'committed',
    source_cleanup_status = 'pending',
    db_committed_at = now(),
    updated_at = now()
  where operation_id = p_operation_id and state = 'active';
  return found;
end;
$$;

create or replace function public.fail_publication_operation(
  p_operation_id uuid,
  p_failure_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.publication_operations set
    state = 'failed',
    failure_reason = left(coalesce(p_failure_reason, 'Unspecified failure'), 1000),
    updated_at = now()
  where operation_id = p_operation_id and state = 'active';
  return found;
end;
$$;

create or replace function public.abandon_expired_publication_operation(
  p_operation_id uuid,
  p_grace_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_grace_seconds < 0 or p_grace_seconds > 604800 then return false; end if;
  update public.publication_operations set
    state = 'abandoned',
    failure_reason = coalesce(failure_reason, 'Lease expired; marked abandoned after recovery grace period'),
    recovery_attempts = recovery_attempts + 1,
    last_recovery_at = now(),
    updated_at = now()
  where operation_id = p_operation_id
    and state = 'active'
    and lease_expires_at <= now() - make_interval(secs => p_grace_seconds);
  return found;
end;
$$;

create or replace function public.mark_publication_cleanup_pending(
  p_operation_id uuid,
  p_grace_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op public.publication_operations%rowtype;
begin
  if p_grace_seconds < 0 or p_grace_seconds > 604800 then return false; end if;
  select * into v_op from public.publication_operations
   where operation_id = p_operation_id for update;
  if not found then return false; end if;
  if v_op.state = 'cleanup_pending' then return true; end if;
  if v_op.state not in ('failed', 'abandoned')
     or v_op.lease_expires_at > now() - make_interval(secs => p_grace_seconds) then
    return false;
  end if;
  -- Check authoritative issue references before making an operation eligible
  -- for a future cleanup worker. This function never deletes storage objects.
  lock table public.issues in share mode;
  if exists (
    select 1 from public.issues i
     where i.pdf_url in (v_op.target_pdf_url, v_op.target_cover_url, v_op.target_pdf_path, v_op.target_cover_path)
        or i.cover_image_url in (v_op.target_pdf_url, v_op.target_cover_url, v_op.target_pdf_path, v_op.target_cover_path)
  ) then
    return false;
  end if;
  update public.publication_operations set
    state = 'cleanup_pending',
    cleanup_status = 'pending',
    recovery_attempts = recovery_attempts + 1,
    last_recovery_at = now(),
    updated_at = now()
  where operation_id = p_operation_id;
  return true;
end;
$$;

create or replace function public.read_publication_operation(p_operation_id uuid)
returns setof public.publication_operations
language sql
security definer
set search_path = public
as $$
  select * from public.publication_operations where operation_id = p_operation_id;
$$;

revoke all on function public.begin_publication_operation(uuid, uuid, text, text, text, text, timestamptz, text, text, text, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.heartbeat_publication_operation(uuid, integer) from public, anon, authenticated;
revoke all on function public.complete_publication_operation(uuid) from public, anon, authenticated;
revoke all on function public.fail_publication_operation(uuid, text) from public, anon, authenticated;
revoke all on function public.abandon_expired_publication_operation(uuid, integer) from public, anon, authenticated;
revoke all on function public.mark_publication_cleanup_pending(uuid, integer) from public, anon, authenticated;
revoke all on function public.read_publication_operation(uuid) from public, anon, authenticated;
grant execute on function public.begin_publication_operation(uuid, uuid, text, text, text, text, timestamptz, text, text, text, text, uuid, integer) to service_role;
grant execute on function public.heartbeat_publication_operation(uuid, integer) to service_role;
grant execute on function public.complete_publication_operation(uuid) to service_role;
grant execute on function public.fail_publication_operation(uuid, text) to service_role;
grant execute on function public.abandon_expired_publication_operation(uuid, integer) to service_role;
grant execute on function public.mark_publication_cleanup_pending(uuid, integer) to service_role;
grant execute on function public.read_publication_operation(uuid) to service_role;

create or replace function public.mark_publication_operation_cleaned(p_operation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op public.publication_operations%rowtype;
begin
  select * into v_op from public.publication_operations
   where operation_id = p_operation_id for update;
  if not found then return false; end if;
  if v_op.state = 'cleaned' then return true; end if;
  if v_op.state <> 'cleanup_pending' or v_op.cleanup_status <> 'pending' then return false; end if;
  -- Recheck every issue immediately before recording cleanup completion.
  lock table public.issues in share mode;
  if exists (
    select 1 from public.issues i
     where i.pdf_url in (v_op.target_pdf_url, v_op.target_cover_url, v_op.target_pdf_path, v_op.target_cover_path)
        or i.cover_image_url in (v_op.target_pdf_url, v_op.target_cover_url, v_op.target_pdf_path, v_op.target_cover_path)
  ) then
    return false;
  end if;
  update public.publication_operations set
    state = 'cleaned',
    cleanup_status = 'complete',
    reconciled_at = now(),
    updated_at = now()
  where operation_id = p_operation_id;
  return true;
end;
$$;

revoke all on function public.mark_publication_operation_cleaned(uuid) from public, anon, authenticated;
grant execute on function public.mark_publication_operation_cleaned(uuid) to service_role;

create or replace function public.mark_publication_source_assets_cleaned(p_operation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op public.publication_operations%rowtype;
begin
  select * into v_op from public.publication_operations
   where operation_id = p_operation_id for update;
  if not found then return false; end if;
  if v_op.state <> 'committed' then return false; end if;
  if v_op.source_cleanup_status in ('pending', 'complete') then return true; end if;
  if v_op.source_cleanup_status <> 'pending' then return false; end if;
  lock table public.issues in share mode;
  if exists (
    select 1 from public.issues i
     where i.pdf_url in (v_op.source_pdf_url, v_op.source_cover_url)
        or i.cover_image_url in (v_op.source_pdf_url, v_op.source_cover_url)
  ) then
    return false;
  end if;
  update public.publication_operations set
    source_cleanup_status = 'complete',
    reconciled_at = now(),
    updated_at = now()
  where operation_id = p_operation_id;
  return true;
end;
$$;

revoke all on function public.mark_publication_source_assets_cleaned(uuid) from public, anon, authenticated;
grant execute on function public.mark_publication_source_assets_cleaned(uuid) to service_role;

-- Once an operation's objects are eligible for or have completed cleanup,
-- reject any later attempt to make an issue reference those retired objects.
create or replace function public.guard_retired_publication_assets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
      from public.publication_operations op
     where (
       op.state in ('cleanup_pending', 'cleaned')
       and (
         new.pdf_url in (op.target_pdf_url, op.target_cover_url, op.target_pdf_path, op.target_cover_path)
         or new.cover_image_url in (op.target_pdf_url, op.target_cover_url, op.target_pdf_path, op.target_cover_path)
       )
     ) or (
       op.source_cleanup_status = 'complete'
       and (
         new.pdf_url in (op.source_pdf_url, op.source_cover_url)
         or new.cover_image_url in (op.source_pdf_url, op.source_cover_url)
       )
     )
  ) then
    raise exception 'Issue cannot reference an asset retired by publication recovery'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists issues_guard_retired_publication_assets on public.issues;
create trigger issues_guard_retired_publication_assets
before insert or update of pdf_url, cover_image_url on public.issues
for each row execute function public.guard_retired_publication_assets();
