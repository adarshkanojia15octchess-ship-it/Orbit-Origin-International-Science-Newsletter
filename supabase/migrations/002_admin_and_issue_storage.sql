-- Administrator access is granted through Supabase Auth app_metadata.role = 'admin'.
-- Set this claim only through trusted Supabase administration, never from client-editable user metadata.

create policy "Administrators can manage issues"
on public.issues
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Draft files remain private. Publishing copies approved assets into a public read-only bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('issue-drafts', 'issue-drafts', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('issue-public', 'issue-public', true, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Administrators can read draft assets"
on storage.objects
for select
to authenticated
using (bucket_id = 'issue-drafts' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Administrators can upload draft assets"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'issue-drafts' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Administrators can delete draft assets"
on storage.objects
for delete
to authenticated
using (bucket_id = 'issue-drafts' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Public can read published issue assets"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'issue-public');

create policy "Administrators can publish issue assets"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'issue-public' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Administrators can remove published issue assets"
on storage.objects
for delete
to authenticated
using (bucket_id = 'issue-public' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
