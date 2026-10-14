# VCU Robertson School Virtual Mentorship Day

Rebuild of the Spring 2026 mentorship-day site (originally on Lovable). Vite + React + TypeScript + Tailwind v4, backed by Supabase.

## Run locally
```bash
npm install
cp .env.example .env   # then fill in Supabase URL/anon key + admin password
npm run dev
```

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
