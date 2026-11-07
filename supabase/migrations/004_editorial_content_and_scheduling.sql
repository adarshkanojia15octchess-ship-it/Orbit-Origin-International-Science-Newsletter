alter table public.issues
  add column if not exists scheduled_at timestamptz;

create index if not exists issues_scheduled_at_idx
  on public.issues(status, scheduled_at)
  where status = 'scheduled';

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.issues(id) on delete set null,
  slug text not null unique,
  headline text not null check (char_length(headline) between 5 and 220),
  author text not null check (char_length(author) between 2 and 120),
  department text not null check (department in ('tapestry-of-worlds', 'frontier-tech', 'universal-record')),
  body_markdown text not null check (char_length(body_markdown) between 1 and 100000),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  source_references jsonb not null default '[]'::jsonb check (jsonb_typeof(source_references) = 'array'),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_status_published_idx
  on public.articles(status, published_at desc);

create index if not exists articles_department_status_idx
  on public.articles(department, status);

alter table public.articles enable row level security;

create policy "Public can read published articles"
  on public.articles
  for select
  to anon, authenticated
  using (status = 'published');

create policy "Administrators can manage articles"
  on public.articles
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
