-- Phase 2A: lease scheduled issue publication work so overlapping cron
-- invocations cannot process the same issue at the same time.
alter table public.issues
  add column if not exists publish_claim_token uuid,
  add column if not exists publish_claimed_at timestamptz;

create index if not exists issues_publish_claim_lease_idx
  on public.issues(publish_claimed_at)
  where status = 'scheduled';

create or replace function public.claim_due_scheduled_issues(
  p_claim_token uuid,
  p_now timestamptz,
  p_limit integer default 20
)
returns table (
  id uuid,
  issue_number integer,
  pdf_url text,
  cover_image_url text
)
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select i.id
    from public.issues as i
    where i.status = 'scheduled'
      and i.scheduled_at <= p_now
      and (
        i.publish_claimed_at is null
        or i.publish_claimed_at < p_now - interval '10 minutes'
      )
    order by i.scheduled_at asc
    for update skip locked
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ),
  claimed as (
    update public.issues as i
    set publish_claim_token = p_claim_token,
        publish_claimed_at = p_now
    from candidates as c
    where i.id = c.id
    returning i.id, i.issue_number, i.pdf_url, i.cover_image_url
  )
  select claimed.id, claimed.issue_number, claimed.pdf_url, claimed.cover_image_url
  from claimed;
$$;

revoke all on function public.claim_due_scheduled_issues(uuid, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_issues(uuid, timestamptz, integer)
  to service_role;
