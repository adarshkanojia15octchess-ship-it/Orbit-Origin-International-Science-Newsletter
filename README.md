# ORBIT & ORIGIN

**Exploring the Universe, Understanding Our Place.**

An independent international science and astronomy publication.

## Technology

- Next.js App Router and React
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL, Auth and Storage
- Resend (planned for the newsletter delivery phase)

## Local development

Requirements: Node.js 20.9+ and npm.

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and configure the public Supabase project URL and anon key.

3. Apply migrations in order from `supabase/migrations/` using the Supabase SQL editor or Supabase CLI.

4. Start the application:

   ```bash
   npm run dev
   ```

5. Run the current quality checks:

   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```

## Supabase setup

Create a Supabase project and configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ADMIN_EMAIL` (the one authorised administrator email)

Apply `001_initial_schema.sql`, then `002_admin_and_issue_storage.sql`.

### Provision the administrator

1. Create the administrator user through Supabase Authentication.
2. In a trusted Supabase administration interface, set that user's **app_metadata** claim to `{"role":"admin"}`. Do not set this in user-editable `user_metadata`.
3. Set `ADMIN_EMAIL` to the same account email in the deployment environment.
4. Sign in at `/admin/login`.

The dashboard checks both the trusted app-metadata role and the configured administrator email. Database and Storage RLS policies independently enforce the administrator role.

### Issue asset handling

- Draft PDFs and cover images are uploaded to the private `issue-drafts` bucket.
- The server validates file type signatures and enforces 25 MB PDF / 8 MB cover limits.
- Publishing copies approved assets into the public, read-only `issue-public` bucket and only then changes the issue status to published.
- Public archive queries only return published issue records.

## Current platform scope

Implemented on the Phase 2 feature branch:

- Editorial homepage and responsive site shell.
- Public archive backed by Supabase.
- Department landing pages, About, Editorial Standards, Contact and Privacy pages.
- Latest issue redirect and issue-specific reading route.
- Browser-native embedded PDF reader with open/download fallback.
- Administrator sign-in, role/email checks, issue draft creation, PDF/cover upload, draft listing and immediate publication.
- Private draft storage and public published-asset storage policies.
- GitHub Actions workflow for TypeScript, ESLint and Next.js production build.

Not yet implemented or not yet verified:

- Double opt-in subscription endpoint and confirmation email.
- Subscriber management and unsubscribe endpoint.
- Complete article-level HTML issue editor and reviewed PDF-to-HTML conversion.
- Resend campaign delivery, test sends, webhooks, bounce handling, retries and idempotent background queue.
- Scheduled publishing, issue editing/replacement workflow and full publication audit history.
- PDF.js-specific reader controls (the current reader uses the browser's built-in PDF viewer).
- Searchable article archive and filters.
- Automated end-to-end tests and production deployment verification.

Do not use this repository for real subscriber campaigns until the missing consent, unsubscribe, email-delivery and operational safeguards are implemented and tested.

## Environment variables

See `.env.example`. Never commit real credentials.

- Supabase anon key is used by the browser-safe server client.
- Supabase service-role keys, if added for later server-only tasks, must never be exposed to client bundles.
- Resend credentials must remain server-side.
- `NEXT_PUBLIC_CONTACT_EMAIL` controls the public editorial contact address.

## Security notes

- Admin role must be assigned through trusted Supabase Auth app metadata.
- Draft assets are private; published assets are public.
- Never grant public access to subscriber, campaign or delivery tables.
- The Privacy page is a publication template and must be reviewed against the actual production providers and retention practices before launch.

## Deployment

The application is intended for Vercel or another Next.js-compatible host. Configure all required environment variables in the host, apply migrations to the production Supabase project, provision the administrator and verify the production domain before publishing.

External provider configuration and a live deployment have not yet been verified.
