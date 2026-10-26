-- Emails, meeting links, cancellations and reminders.
-- Emails are sent by the `notify` edge function, called from the database
-- (pg_net) so every signup / booking / cancellation emails people automatically.
create extension if not exists pg_net;
create extension if not exists pg_cron;

alter table public.bookings
  add column if not exists meeting_url text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text,
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists cancellation_sent_at timestamptz;
alter table public.mentors add column if not exists welcome_sent_at timestamptz;

-- A cancelled slot can be booked again.
alter table public.bookings drop constraint if exists bookings_mentor_id_selected_time_key;
create unique index if not exists bookings_active_slot
  on public.bookings (mentor_id, selected_time) where cancelled_at is null;

-- Call the notify edge function.
create or replace function public.vmd_notify(kind text, rec_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://bskdqzkcneuuqerhltrv.supabase.co/functions/v1/notify',
    body := jsonb_build_object('type', kind, 'id', rec_id),
    headers := '{"Content-Type":"application/json"}'::jsonb
  );
end $$;

-- Before a booking: make sure the slot is open, set the meeting link, take the slot.
create or replace function public.vmd_before_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare m public.mentors;
begin
  select * into m from public.mentors where id = new.mentor_id for update;
  if m.id is null then raise exception 'Mentor not found'; end if;
  if not (new.selected_time = any(m.available_times)) then
    raise exception 'That time slot is no longer available. Please pick another.';
  end if;
  new.student_email := lower(trim(new.student_email));
  new.meeting_url := coalesce(
    nullif(trim(m.meeting_url), ''),
    'https://meet.jit.si/RobertsonVMD-' || substr(replace(new.id::text, '-', ''), 1, 12)
  );
  update public.mentors set available_times = array_remove(available_times, new.selected_time) where id = m.id;
  return new;
end $$;

create or replace function public.vmd_after_booking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.vmd_notify('booking', new.id);
  return new;
end $$;

create or replace function public.vmd_after_mentor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.vmd_notify('mentor_signup', new.id);
  return new;
end $$;

drop trigger if exists vmd_before_booking on public.bookings;
create trigger vmd_before_booking before insert on public.bookings
  for each row execute function public.vmd_before_booking();
drop trigger if exists vmd_after_booking on public.bookings;
create trigger vmd_after_booking after insert on public.bookings
  for each row execute function public.vmd_after_booking();
drop trigger if exists vmd_after_mentor on public.mentors;
create trigger vmd_after_mentor after insert on public.mentors
  for each row execute function public.vmd_after_mentor();

-- Cancel a booking (students reopen the slot; mentors usually don't).
create or replace function public.cancel_booking(
  p_booking_id uuid, p_cancelled_by text default 'student', p_reopen_slot boolean default true
) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  update public.bookings set cancelled_at = now(), cancelled_by = p_cancelled_by
    where id = p_booking_id and cancelled_at is null
    returning * into b;
  if b.id is null then return; end if;
  if p_reopen_slot then
    update public.mentors set available_times = array_append(available_times, b.selected_time)
      where id = b.mentor_id and not (b.selected_time = any(available_times));
  end if;
  perform public.vmd_notify('cancel', b.id);
end $$;
grant execute on function public.cancel_booking(uuid, text, boolean) to anon, authenticated;
revoke execute on function public.vmd_notify(text, uuid) from public, anon, authenticated;

-- Reminder check every 10 minutes.
select cron.schedule('vmd-reminders', '*/10 * * * *', $cron$
  select net.http_post(
    url := 'https://bskdqzkcneuuqerhltrv.supabase.co/functions/v1/notify',
    body := '{"type":"reminders"}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb
  )
$cron$);
