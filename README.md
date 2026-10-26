# VCU Robertson School Virtual Mentorship Day

Rebuild of the Spring 2026 mentorship-day site (originally on Lovable). Vite + React + TypeScript + Tailwind v4, backed by Supabase.

## Run locally
```bash
npm install
cp .env.example .env   # optional: override Supabase URL/key
npm run dev
```

## Live setup (Fall 2026)
- Hosting: Vercel (`vercel.json` handles page routes) and/or GitHub Pages (`.github/workflows/pages.yml`). No env vars needed.
- Database: Supabase project `bskdqzkcneuuqerhltrv` (migrations in `supabase/migrations`).
- Security: the browser never touches tables. Everything goes through checked database functions (`0003_lockdown.sql`).
  Mentors, students and admins sign in with a one-time link emailed to them (valid 12 hours). Admin emails live in the `admins` table and can be edited from the admin page.
- Emails: `supabase/functions/notify` sends mentor sign-up, booking confirmation (with calendar invite), 1-hour reminder, cancellation, and sign-in-link emails through Gmail. Database triggers call it automatically.
  Secrets in Supabase → Edge Functions → Secrets: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, optional `SITE_URL`, optional `NOTIFY_SECRET` (set it to the value of `select value from app_secrets where key='notify_secret'` to stop anyone else calling the function).
- Changing the event date: update `EVENT` in `src/lib/config.ts` **and** `EVENT_DATE` / `EVENT_LABEL` in `supabase/functions/notify/index.ts`.

## Opening / closing registration
Edit `src/lib/config.ts`: `mentorRegistrationOpen`, `studentBookingOpen`, plus event dates, contacts, tracks, topics, and time slots.

## Pages
- `/` home
- `/mentor-registration` → `/mentor-confirmation?id=`
- `/student-booking` → `/student-confirmation?id=`
- `/mentor-dashboard` (sign-in link required): manage slots, meeting link, view/cancel bookings
- `/student-dashboard` (sign-in link required): view/cancel sessions
- `/admin` (sign-in link required, admin emails only): bookings, mentors, students, waitlist matching, admins, CSV export

## Deploy
`npm run build` → static `dist/`. Works on Netlify, Vercel, or Cloudflare Pages. Add a SPA rewrite (all routes → `/index.html`).
