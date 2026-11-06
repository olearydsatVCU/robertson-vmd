-- Admin access by username + password instead of emailed links.
-- The password is stored only as a bcrypt hash. Set or change it with:
--   select public.vmd_set_admin_password('USERNAME', 'NEW PASSWORD');   (run in the SQL editor; not callable from the website)
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_accounts (
  username text primary key,
  password_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.admin_accounts enable row level security;
revoke all on public.admin_accounts from anon, authenticated;

create or replace function public.vmd_set_admin_password(p_username text, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if length(coalesce(p_password, '')) < 6 then raise exception 'Use at least 6 characters.'; end if;
  insert into public.admin_accounts (username, password_hash)
  values (lower(trim(p_username)), extensions.crypt(p_password, extensions.gen_salt('bf', 10)))
  on conflict (username) do update set password_hash = excluded.password_hash, updated_at = now();
  -- Changing the password signs everyone out of the admin page.
  delete from public.access_tokens where role = 'admin';
end $$;
revoke all on function public.vmd_set_admin_password(text, text) from public, anon, authenticated;

-- Log in: returns a 12-hour admin key, or null for a wrong username/password. Limited to 5 tries per
-- username per hour and 30 per hour overall, so passwords can't be guessed quickly.
-- (A wrong password returns null instead of raising an error, so the failed try is still counted.)
create or replace function public.admin_login(p_username text, p_password text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare u text := lower(trim(coalesce(p_username, ''))); h text; t uuid;
begin
  perform public.vmd_rate_limit('adminlogin:' || u, 5);
  perform public.vmd_rate_limit('adminlogin', 30);
  select password_hash into h from public.admin_accounts where username = u;
  if h is null or extensions.crypt(coalesce(p_password, ''), h) <> h then
    return null;
  end if;
  delete from public.rate_events where key = 'adminlogin:' || u; -- reset tries after a good login
  insert into public.access_tokens (email, role, sent_at) values ('admin:' || u, 'admin', now()) returning token into t;
  return t;
end $$;
revoke all on function public.admin_login(text, text) from public;
grant execute on function public.admin_login(text, text) to anon, authenticated;

-- Admin links by email are switched off.
create or replace function public.request_access_link(p_email text, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := public.vmd_clean_email(p_email); ok boolean; t uuid;
begin
  if not public.vmd_valid_email(e) then raise exception 'Please enter a valid email address.'; end if;
  if p_role not in ('mentor', 'student') then raise exception 'Admins sign in with a username and password.'; end if;
  perform public.vmd_rate_limit('link:' || e, 4);
  perform public.vmd_rate_limit('link', 200);
  ok := case p_role
    when 'mentor' then exists (select 1 from public.mentors where email = e and deleted_at is null)
    else exists (select 1 from public.bookings where student_email = e) end;
  if not ok then return; end if;
  insert into public.access_tokens (email, role) values (e, p_role) returning token into t;
  perform public.vmd_notify('access_link', t);
end $$;

-- Old emailed admin links stop working.
delete from public.access_tokens where role = 'admin' and email not like 'admin:%';

-- The email-based admin list is no longer used.
revoke all on function public.admin_set_admins(uuid, text[]) from public, anon, authenticated;
