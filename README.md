# Course Map Wizard (POC)

Production-shaped prototype for a course-map wizard:
- Magic-link auth (SMTP)
- Postgres via Prisma
- S3/R2 uploads via presigned URLs
- LLM step evaluation via OpenAI Responses API (JSON schema)

## Deploy to Vercel

### 1) Provision services
You need:
- Hosted Postgres (Neon/Supabase/Railway/etc.)
- SMTP credentials (SendGrid/Mailgun/Postmark/SES/etc.)
- S3-compatible storage (AWS S3 / Cloudflare R2 / MinIO)

### 2) Set Vercel Environment Variables
Set these for Production (and Preview if you want previews to work fully):

**App**
- `APP_URL` = your deployed URL (e.g. https://your-app.vercel.app)
- `APP_SECRET` = long random string
- `OPENAI_API_KEY` = OpenAI API key

**Database**
- `DATABASE_URL` = pooled serverless-safe URL if possible
- `DIRECT_URL` = direct DB URL for migrations (recommended)

**SMTP**
- `EMAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

**S3**
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- Optional: `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`

### 3) Run Prisma migrations against your hosted DB
From your machine (or CI), after setting env vars:
- `npm install`
- `npx prisma migrate dev` (or `npx prisma migrate deploy` in CI)

Vercel does not run migrations for you automatically.

## What works now
- Homepage lets you request a magic link.
- `/auth/verify` verifies the token and sets a session cookie.
- Authenticated APIs exist for:
  - `POST /api/session`
  - `POST /api/upload/url`
  - `POST /api/submit`

## What’s next
- Wizard UI: stepper + dynamic form renderer driven by config
- Seed rubrics into DB (Rubric table) so `/api/submit` evaluates steps
- Session viewer page `/w/[sessionId]`
