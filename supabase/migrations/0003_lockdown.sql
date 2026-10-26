-- Lock-down: no public table access. The site only talks to checked functions.
-- Mentors, students and admins get a one-time sign-in link by email.

-- 1. Remove public table access ------------------------------------------------
drop policy if exists "public read mentors" on public.mentors;
drop policy if exists "public write mentors" on public.mentors;
drop policy if exists "public read bookings" on public.bookings;
drop policy if exists "public write bookings" on public.bookings;
drop policy if exists "public read requests" on public.student_requests;
drop policy if exists "public write requests" on public.student_requests;
revoke all on public.mentors, public.bookings, public.student_requests from anon, authenticated;
alter publication supabase_realtime drop table public.mentors;
alter publication supabase_realtime drop table public.bookings;

alter table public.mentors add column if not exists deleted_at timestamptz;

-- 2. New tables ----------------------------------------------------------------
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);
insert into public.admins (email) values
  ('olearyds@vcu.edu'), ('jwadams@vcu.edu'), ('zeniaderekoleary@gmail.com')
on conflict do nothing;

create table if not exists public.access_tokens (
  token uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('mentor', 'student', 'admin')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours',
  sent_at timestamptz
);
create index if not exists access_tokens_email_idx on public.access_tokens (email, created_at);

create table if not exists public.rate_events (
  key text not null,
  at timestamptz not null default now()
);
create index if not exists rate_events_idx on public.rate_events (key, at);

create table if not exists public.app_secrets (key text primary key, value text not null);
insert into public.app_secrets (key, value) values ('notify_secret', gen_random_uuid()::text) on conflict do nothing;

alter table public.admins enable row level security;
alter table public.access_tokens enable row level security;
alter table public.rate_events enable row level security;
alter table public.app_secrets enable row level security;
revoke all on public.admins, public.access_tokens, public.rate_events, public.app_secrets from anon, authenticated;

-- 3. Internal helpers ----------------------------------------------------------
create or replace function public.vmd_notify(kind text, rec_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://bskdqzkcneuuqerhltrv.supabase.co/functions/v1/notify',
    body := jsonb_build_object('type', kind, 'id', rec_id),
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-vmd-secret', (select value from public.app_secrets where key = 'notify_secret'))
  );
end $$;

select cron.unschedule('vmd-reminders');
select cron.schedule('vmd-reminders', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://bskdqzkcneuuqerhltrv.supabase.co/functions/v1/notify',
    body := '{"type":"reminders"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-vmd-secret', (select value from public.app_secrets where key = 'notify_secret'))
  )
$cron$);

create or replace function public.vmd_rate_limit(p_key text, p_max int) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.rate_events where at < now() - interval '1 day';
  if (select count(*) from public.rate_events where key = p_key and at > now() - interval '1 hour') >= p_max then
    raise exception 'Too many attempts. Please wait a little while and try again.';
  end if;
  insert into public.rate_events (key) values (p_key);
end $$;

create or replace function public.vmd_token_email(p_token uuid, p_role text) returns text
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  select email into e from public.access_tokens where token = p_token and role = p_role and expires_at > now();
  if e is null then raise exception 'Your sign-in link has expired. Request a new one from the home page.'; end if;
  return e;
end $$;

create or replace function public.vmd_clean_email(p text) returns text
language sql immutable as $$ select lower(trim(p)) $$;

create or replace function public.vmd_valid_email(p text) returns boolean
language sql immutable as $$ select p ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(p) <= 254 $$;

create or replace function public.vmd_mentor_public(m public.mentors) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', m.id, 'name', m.name, 'occupation', m.occupation, 'organization', m.organization,
    'linkedin_url', m.linkedin_url, 'image_url', m.image_url, 'tracks', m.tracks, 'open_to', m.open_to,
    'topics', m.topics, 'available_times', m.available_times)
$$;

create or replace function public.vmd_booking_json(b public.bookings) returns jsonb
language sql immutable as $$ select to_jsonb(b) - 'confirmation_sent_at' - 'reminder_sent_at' - 'cancellation_sent_at' $$;

-- 4. Public functions (no sign-in) --------------------------------------------
create or replace function public.list_mentors() returns jsonb
language sql security definer stable set search_path = public as $$
  select coalesce(jsonb_agg(public.vmd_mentor_public(m) order by m.name), '[]'::jsonb)
  from public.mentors m where m.deleted_at is null
$$;

create or replace function public.register_mentor(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := public.vmd_clean_email(p->>'email'); m public.mentors;
begin
  if coalesce(trim(p->>'name'), '') = '' then raise exception 'Please enter your name.'; end if;
  if not public.vmd_valid_email(e) then raise exception 'Please enter a valid email address.'; end if;
  perform public.vmd_rate_limit('register:' || e, 3);
  perform public.vmd_rate_limit('register', 100);
  if exists (select 1 from public.mentors where email = e and deleted_at is null) then
    raise exception 'This email is already registered. Use "Check Mentor Schedule" on the home page to get your sign-in link.';
  end if;
  insert into public.mentors (name, email, occupation, organization, linkedin_url, meeting_url, image_url, tracks, open_to, topics, available_times)
  values (left(trim(p->>'name'), 120), e, left(nullif(trim(p->>'occupation'), ''), 120), left(nullif(trim(p->>'organization'), ''), 120),
    left(nullif(trim(p->>'linkedin_url'), ''), 300), left(nullif(trim(p->>'meeting_url'), ''), 300), left(nullif(trim(p->>'image_url'), ''), 300),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'tracks') x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'open_to') x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'topics') x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'available_times') x where x ~ '^\d{1,2}:\d{2} (AM|PM)$'), '{}'))
  returning * into m;
  return public.vmd_mentor_public(m) || jsonb_build_object('email', m.email, 'meeting_url', m.meeting_url);
end $$;

create or replace function public.book_session(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := public.vmd_clean_email(p->>'student_email'); b public.bookings; m public.mentors;
begin
  if coalesce(trim(p->>'student_name'), '') = '' then raise exception 'Please enter your name.'; end if;
  if not public.vmd_valid_email(e) then raise exception 'Please enter a valid email address.'; end if;
  perform public.vmd_rate_limit('book:' || e, 6);
  perform public.vmd_rate_limit('book', 300);
  select * into m from public.mentors where id = (p->>'mentor_id')::uuid and deleted_at is null;
  if m.id is null then raise exception 'Mentor not found.'; end if;
  if exists (select 1 from public.bookings where student_email = e and mentor_id = m.id and cancelled_at is null) then
    raise exception 'You already have a session booked with this mentor.';
  end if;
  insert into public.bookings (mentor_id, student_name, student_email, graduation_date, discussion_topics, portfolio_url, specific_topics, selected_time)
  values (m.id, left(trim(p->>'student_name'), 120), e, left(nullif(trim(p->>'graduation_date'), ''), 60),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p->'discussion_topics') x), '{}'),
    left(nullif(trim(p->>'portfolio_url'), ''), 300), left(nullif(trim(p->>'specific_topics'), ''), 2000), p->>'selected_time')
  returning * into b;
  return public.vmd_booking_json(b) || jsonb_build_object('mentor', public.vmd_mentor_public(m));
end $$;

create or replace function public.request_access_link(p_email text, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := public.vmd_clean_email(p_email); ok boolean; t uuid;
begin
  if not public.vmd_valid_email(e) then raise exception 'Please enter a valid email address.'; end if;
  if p_role not in ('mentor', 'student', 'admin') then raise exception 'Unknown role.'; end if;
  perform public.vmd_rate_limit('link:' || e, 4);
  perform public.vmd_rate_limit('link', 200);
  ok := case p_role
    when 'mentor' then exists (select 1 from public.mentors where email = e and deleted_at is null)
    when 'student' then exists (select 1 from public.bookings where student_email = e)
    else exists (select 1 from public.admins where email = e) end;
  if not ok then return; end if; -- say nothing, so emails can't be guessed
  insert into public.access_tokens (email, role) values (e, p_role) returning token into t;
  perform public.vmd_notify('access_link', t);
end $$;

-- 5. Mentor functions (need a mentor sign-in link) -----------------------------
create or replace function public.get_mentor_schedule(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := public.vmd_token_email(p_token, 'mentor'); m public.mentors;
begin
  select * into m from public.mentors where email = e and deleted_at is null;
  if m.id is null then raise exception 'No mentor found for this link.'; end if;
  return jsonb_build_object(
    'mentor', to_jsonb(m) - 'welcome_sent_at',
    'bookings', coalesce((select jsonb_agg(public.vmd_booking_json(b)) from public.bookings b where b.mentor_id = m.id and b.cancelled_at is null), '[]'::jsonb));
end $$;

create or replace function public.mentor_update(p_token uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare e text := public.vmd_token_email(p_token, 'mentor');
begin
  update public.mentors set
    available_times = case when p ? 'available_times' then coalesce((select array_agg(x) from jsonb_array_elements_text(p->'available_times') x where x ~ '^\d{1,2}:\d{2} (AM|PM)$'), '{}') else available_times end,
    meeting_url = case when p ? 'meeting_url' then left(nullif(trim(p->>'meeting_url'), ''), 300) else meeting_url end,
    linkedin_url = case when p ? 'linkedin_url' then left(nullif(trim(p->>'linkedin_url'), ''), 300) else linkedin_url end
  where email = e and deleted_at is null;
end $$;

create or replace function public.mentor_cancel(p_token uuid, p_booking_id uuid, p_reopen boolean) returns void
language plpgsql security definer set search_path = public as $$
declare e text := public.vmd_token_email(p_token, 'mentor');
begin
  if not exists (select 1 from public.bookings b join public.mentors m on m.id = b.mentor_id where b.id = p_booking_id and m.email = e) then
    raise exception 'Booking not found.';
  end if;
  perform public.cancel_booking(p_booking_id, 'mentor', p_reopen);
end $$;

-- 6. Student functions ---------------------------------------------------------
create or replace function public.get_student_schedule(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e text := public.vmd_token_email(p_token, 'student');
begin
  return jsonb_build_object('email', e, 'bookings', coalesce((
    select jsonb_agg(public.vmd_booking_json(b) || jsonb_build_object('mentor', public.vmd_mentor_public(m)))
    from public.bookings b join public.mentors m on m.id = b.mentor_id
    where b.student_email = e and b.cancelled_at is null), '[]'::jsonb));
end $$;

create or replace function public.student_cancel(p_token uuid, p_booking_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e text := public.vmd_token_email(p_token, 'student');
begin
  if not exists (select 1 from public.bookings where id = p_booking_id and student_email = e) then raise exception 'Booking not found.'; end if;
  perform public.cancel_booking(p_booking_id, 'student', true);
end $$;

-- 7. Admin functions -----------------------------------------------------------
create or replace function public.admin_get_all(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.vmd_token_email(p_token, 'admin');
  return jsonb_build_object(
    'mentors', coalesce((select jsonb_agg(to_jsonb(m) - 'welcome_sent_at' order by m.name) from public.mentors m where m.deleted_at is null), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(public.vmd_booking_json(b) order by b.created_at desc) from public.bookings b where b.cancelled_at is null), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.student_requests r), '[]'::jsonb),
    'admins', (select jsonb_agg(email order by email) from public.admins));
end $$;

create or replace function public.admin_cancel_booking(p_token uuid, p_booking_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.vmd_token_email(p_token, 'admin');
  perform public.cancel_booking(p_booking_id, 'admin', true);
end $$;

create or replace function public.admin_delete_mentor(p_token uuid, p_mentor_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b record;
begin
  perform public.vmd_token_email(p_token, 'admin');
  for b in select id from public.bookings where mentor_id = p_mentor_id and cancelled_at is null loop
    perform public.cancel_booking(b.id, 'admin', false);
  end loop;
  update public.mentors set deleted_at = now(), available_times = '{}', email = email || '.deleted.' || extract(epoch from now())::bigint where id = p_mentor_id;
end $$;

create or replace function public.admin_update_mentor(p_token uuid, p_mentor_id uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare arr text[];
begin
  perform public.vmd_token_email(p_token, 'admin');
  update public.mentors set
    name = coalesce(left(nullif(trim(p->>'name'), ''), 120), name),
    email = case when p ? 'email' and public.vmd_valid_email(public.vmd_clean_email(p->>'email')) then public.vmd_clean_email(p->>'email') else email end,
    occupation = case when p ? 'occupation' then left(nullif(trim(p->>'occupation'), ''), 120) else occupation end,
    organization = case when p ? 'organization' then left(nullif(trim(p->>'organization'), ''), 120) else organization end,
    linkedin_url = case when p ? 'linkedin_url' then left(nullif(trim(p->>'linkedin_url'), ''), 300) else linkedin_url end,
    meeting_url = case when p ? 'meeting_url' then left(nullif(trim(p->>'meeting_url'), ''), 300) else meeting_url end,
    tracks = case when p ? 'tracks' then coalesce((select array_agg(x) from jsonb_array_elements_text(p->'tracks') x), '{}') else tracks end,
    open_to = case when p ? 'open_to' then coalesce((select array_agg(x) from jsonb_array_elements_text(p->'open_to') x), '{}') else open_to end,
    topics = case when p ? 'topics' then coalesce((select array_agg(x) from jsonb_array_elements_text(p->'topics') x), '{}') else topics end,
    available_times = case when p ? 'available_times' then coalesce((select array_agg(x) from jsonb_array_elements_text(p->'available_times') x where x ~ '^\d{1,2}:\d{2} (AM|PM)$'), '{}') else available_times end
  where id = p_mentor_id and deleted_at is null;
end $$;

create or replace function public.admin_match(p_token uuid, p_request_id uuid, p_mentor_id uuid, p_time text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.student_requests;
begin
  perform public.vmd_token_email(p_token, 'admin');
  select * into r from public.student_requests where id = p_request_id;
  if r.id is null then raise exception 'Request not found.'; end if;
  insert into public.bookings (mentor_id, student_name, student_email, graduation_date, specific_topics, selected_time)
  values (p_mentor_id, r.name, r.email, r.class_level, r.goals, p_time);
  update public.student_requests set status = 'matched' where id = p_request_id;
end $$;

create or replace function public.admin_delete_student(p_token uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := public.vmd_clean_email(p_email); b record;
begin
  perform public.vmd_token_email(p_token, 'admin');
  for b in select id from public.bookings where student_email = e and cancelled_at is null loop
    perform public.cancel_booking(b.id, 'admin', true);
  end loop;
  delete from public.student_requests where email = e;
end $$;

create or replace function public.admin_set_admins(p_token uuid, p_emails text[]) returns void
language plpgsql security definer set search_path = public as $$
declare me text := public.vmd_token_email(p_token, 'admin');
begin
  delete from public.admins where email <> me and not (email = any(p_emails));
  insert into public.admins (email) select public.vmd_clean_email(x) from unnest(p_emails) x where public.vmd_valid_email(public.vmd_clean_email(x)) on conflict do nothing;
end $$;

-- 8. Permissions: nothing is callable unless listed here ------------------------
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
grant execute on function
  public.list_mentors(), public.register_mentor(jsonb), public.book_session(jsonb), public.request_access_link(text, text),
  public.get_mentor_schedule(uuid), public.mentor_update(uuid, jsonb), public.mentor_cancel(uuid, uuid, boolean),
  public.get_student_schedule(uuid), public.student_cancel(uuid, uuid),
  public.admin_get_all(uuid), public.admin_cancel_booking(uuid, uuid), public.admin_delete_mentor(uuid, uuid),
  public.admin_update_mentor(uuid, uuid, jsonb), public.admin_match(uuid, uuid, uuid, text), public.admin_delete_student(uuid, text),
  public.admin_set_admins(uuid, text[])
to anon, authenticated;
