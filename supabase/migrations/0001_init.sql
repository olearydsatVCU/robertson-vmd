-- Virtual Mentorship Day schema
create extension if not exists pgcrypto;

create table if not exists public.mentors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  occupation text,
  organization text,
  linkedin_url text,
  image_url text,
  meeting_url text,
  tracks text[] not null default '{}',
  open_to text[] not null default '{}',
  topics text[] not null default '{}',
  available_times text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentors(id) on delete cascade,
  student_name text not null,
  student_email text not null,
  specializations text[] not null default '{}',
  graduation_date text,
  discussion_topics text[] not null default '{}',
  portfolio_url text,
  specific_topics text,
  selected_time text not null,
  created_at timestamptz not null default now(),
  unique (mentor_id, selected_time)
);

create table if not exists public.student_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  class_level text,
  goals text,
  status text not null default 'unmatched' check (status in ('unmatched','matched')),
  created_at timestamptz not null default now()
);

-- Realtime for the booking page
alter publication supabase_realtime add table public.mentors;
alter publication supabase_realtime add table public.bookings;

-- Row level security: the app uses the anon key; keep it open like the original app,
-- tighten later by moving writes behind edge functions if needed.
alter table public.mentors enable row level security;
alter table public.bookings enable row level security;
alter table public.student_requests enable row level security;
create policy "public read mentors" on public.mentors for select using (true);
create policy "public write mentors" on public.mentors for all using (true) with check (true);
create policy "public read bookings" on public.bookings for select using (true);
create policy "public write bookings" on public.bookings for all using (true) with check (true);
create policy "public read requests" on public.student_requests for select using (true);
create policy "public write requests" on public.student_requests for all using (true) with check (true);
