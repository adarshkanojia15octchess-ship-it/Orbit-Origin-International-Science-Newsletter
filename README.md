# ORBIT & ORIGIN

**Exploring the Universe, Understanding Our Place.**

An independent international science and astronomy publication.

## Stack
Next.js App Router, TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, Resend.

## Local development
1. Install Node.js 20.9+.
2. Copy .env.example to .env.local and configure Supabase.
3. Run npm install.
4. Apply supabase/migrations/001_initial_schema.sql in Supabase.
5. Run npm run dev.

## Security
Never expose the Supabase service-role key or Resend API key in browser code. Never commit real credentials.

## Current status
This branch establishes the Next.js application shell, editorial homepage, database-driven public issue archive, subscription entry page, and initial relational schema. It is a development foundation, not yet a production-ready mailing platform.

Remaining production work: administrator role enforcement and dashboard, secure PDF/image upload, confirmation and unsubscribe token endpoints, Resend templates and webhook reconciliation, background campaign queue, PDF.js reader, rate limiting/CAPTCHA, automated tests, and deployment configuration.

Only explicitly published database records appear in the public archive. Issue metadata must not be hardcoded into source code.