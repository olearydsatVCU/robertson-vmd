# VCU Robertson School Virtual Mentorship Day

Rebuild of the Spring 2026 mentorship-day site (originally on Lovable). Vite + React + TypeScript + Tailwind v4, backed by Supabase.

## Run locally
```bash
npm install
cp .env.example .env   # then fill in Supabase URL/anon key + admin password
npm run dev
```

## Live setup (Fall 2026)
- Hosting: Vercel (imports this repo; `vercel.json` handles page routes). No env vars needed except `VITE_ADMIN_PASSWORD`.
- Database: Supabase project `sepkrzmipcnbwmlalraf` (migrations in `supabase/migrations`).
- Emails: `supabase/functions/notify` sends mentor sign-up, booking confirmation (with calendar invite), 1-hour reminder, and cancellation emails through Gmail. Database triggers call it automatically.
  Secrets in Supabase → Edge Functions → Secrets: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, optional `SITE_URL`.
- Changing the event date: update `EVENT` in `src/lib/config.ts` **and** `EVENT_DATE` / `EVENT_LABEL` in `supabase/functions/notify/index.ts`.

## Supabase setup
1. Create a project at supabase.com.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Copy the project URL and anon key into `.env`.
4. (Optional, for emails) deploy the edge function:
   ```bash
   supabase functions deploy send-booking-email
   supabase secrets set RESEND_API_KEY=... FROM_EMAIL="VMD <noreply@yourdomain>"
   ```

## Opening / closing registration
Edit `src/lib/config.ts`: `mentorRegistrationOpen`, `studentBookingOpen`, plus event dates, contacts, tracks, topics, and time slots.

## Pages
- `/` home
- `/mentor-registration` → `/mentor-confirmation?id=`
- `/student-booking` → `/student-confirmation?id=`
- `/mentor-dashboard?email=` and `/mentor-schedule?id=` (manage slots, view bookings)
- `/student-dashboard?email=` and `/student-schedule?email=`
- `/admin` (password from `VITE_ADMIN_PASSWORD`): bookings, mentors, students, waitlist matching, CSV export

## Deploy
`npm run build` → static `dist/`. Works on Netlify, Vercel, or Cloudflare Pages. Add a SPA rewrite (all routes → `/index.html`).
