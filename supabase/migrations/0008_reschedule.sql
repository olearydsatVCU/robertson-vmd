-- Admins can move a booking to a different time. The old time goes back on the mentor's open list,
-- the new time is taken, and both people get a "time changed" email with an updated calendar invite.
alter table public.bookings
  add column if not exists invite_sequence int not null default 0,
  add column if not exists previous_time text,
  add column if not exists reschedule_sent_at timestamptz;

create or replace function public.reschedule_booking(p_booking_id uuid, p_new_time text) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings; m public.mentors;
begin
  if p_new_time !~ '^\d{1,2}:\d{2} (AM|PM)$' then raise exception 'Pick a time like 9:30 AM.'; end if;
  select * into b from public.bookings where id = p_booking_id and cancelled_at is null for update;
  if b.id is null then raise exception 'Booking not found (it may have been cancelled).'; end if;
  if b.selected_time = p_new_time then raise exception 'The booking is already at %.', p_new_time; end if;
  select * into m from public.mentors where id = b.mentor_id for update;
  if exists (select 1 from public.bookings where mentor_id = b.mentor_id and selected_time = p_new_time and cancelled_at is null) then
    raise exception '% already has a student booked at %.', m.name, p_new_time;
  end if;
  -- Free the old time, take the new one (admins may pick a time the mentor didn't list).
  update public.mentors set available_times =
      array_append(array_remove(available_times, p_new_time), b.selected_time)
    where id = m.id;
  update public.mentors set available_times = (select array_agg(distinct x) from unnest(available_times) x) where id = m.id;
  update public.bookings set
      previous_time = b.selected_time, selected_time = p_new_time,
      invite_sequence = b.invite_sequence + 1, reschedule_sent_at = null, reminder_sent_at = null
    where id = b.id;
  perform public.vmd_notify('reschedule', b.id);
end $$;
revoke all on function public.reschedule_booking(uuid, text) from public, anon, authenticated;

create or replace function public.admin_reschedule_booking(p_token uuid, p_booking_id uuid, p_new_time text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.vmd_token_email(p_token, 'admin');
  perform public.reschedule_booking(p_booking_id, p_new_time);
end $$;
revoke all on function public.admin_reschedule_booking(uuid, uuid, text) from public;
grant execute on function public.admin_reschedule_booking(uuid, uuid, text) to anon, authenticated;

-- Keep the extra columns out of what the site sees.
create or replace function public.vmd_booking_json(b public.bookings) returns jsonb
language sql immutable set search_path = public as $$
  select to_jsonb(b) - 'confirmation_sent_at' - 'reminder_sent_at' - 'cancellation_sent_at' - 'reschedule_sent_at' - 'invite_sequence'
$$;
