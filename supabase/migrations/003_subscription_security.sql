alter table public.subscribers
  add column if not exists confirmation_expires_at timestamptz,
  add column if not exists consent_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.subscribers
  alter column unsubscribe_token_hash drop default;

create unique index if not exists subscribers_confirmation_token_hash_idx
  on public.subscribers(confirmation_token_hash)
  where confirmation_token_hash is not null;

create unique index if not exists subscribers_unsubscribe_token_hash_idx
  on public.subscribers(unsubscribe_token_hash)
  where unsubscribe_token_hash is not null;

create table if not exists public.subscription_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.subscription_rate_limits enable row level security;

create or replace function public.consume_subscription_rate_limit(p_key_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  insert into public.subscription_rate_limits(key_hash, window_started_at, request_count)
  values (p_key_hash, now(), 1)
  on conflict (key_hash) do update
    set request_count = case
      when public.subscription_rate_limits.window_started_at < now() - interval '15 minutes' then 1
      else public.subscription_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.subscription_rate_limits.window_started_at < now() - interval '15 minutes' then now()
      else public.subscription_rate_limits.window_started_at
    end;

  select request_count <= 5 into allowed
  from public.subscription_rate_limits
  where key_hash = p_key_hash;

  return coalesce(allowed, false);
end;
$$;

revoke all on function public.consume_subscription_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_subscription_rate_limit(text) to service_role;

-- Subscriber data remains inaccessible to anonymous and authenticated browser clients.
