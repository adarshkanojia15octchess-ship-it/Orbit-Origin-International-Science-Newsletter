-- Administrator access is granted through Supabase Auth app_metadata.role = 'admin'.
-- Set this claim only through trusted Supabase administration, never from client-editable user metadata.

create policy "Administrators can manage issues"
on public.issues
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'issue-assets',
  'issue-assets',
  true,
  26214400,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read published issue assets"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'issue-assets');

create policy "Administrators can upload issue assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'issue-assets'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "Administrators can update issue assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'issue-assets'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
with check (
  bucket_id = 'issue-assets'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

create policy "Administrators can delete issue assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'issue-assets'
  and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);
