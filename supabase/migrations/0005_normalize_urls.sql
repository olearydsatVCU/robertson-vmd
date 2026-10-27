-- Accept web links typed without https:// (e.g. "linkedin.com/in/name", "www.zoom.us/j/123")
-- and fix them before saving. Also refuse non-web links (javascript:, data:, mailto: ...)
-- so nothing unsafe can end up behind a link on the site or in an email.

create or replace function public.vmd_normalize_url(u text, label text) returns text
language plpgsql immutable set search_path = public as $$
declare v text := regexp_replace(coalesce(u, ''), '\s', '', 'g');
begin
  if v = '' then return null; end if;
  if v ~* '^https?://' then
    v := regexp_replace(v, '^https?://', 'https://', 'i'); -- also upgrades http:// to https://
  elsif v ~ '^//' then
    v := 'https:' || v;
  elsif v ~* '^[a-z][a-z0-9+.-]*:' and v !~* '^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#]|$)' then
    raise exception 'The % doesn''t look like a web link. Try something like %.', label,
      case when label ilike '%linkedin%' then 'linkedin.com/in/yourname' else 'zoom.us/j/123456789' end;
  else
    v := 'https://' || v;
  end if;
  if coalesce(lower(substring(v from '^https?://([^/?#:]+)')), '') !~ '^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    raise exception 'The % doesn''t look like a web link. Check for typos.', label;
  end if;
  return left(v, 300);
end $$;
revoke all on function public.vmd_normalize_url(text, text) from public, anon, authenticated;

create or replace function public.vmd_normalize_mentor_urls() returns trigger
language plpgsql set search_path = public as $$
begin
  new.linkedin_url := public.vmd_normalize_url(new.linkedin_url, 'LinkedIn link');
  new.meeting_url := public.vmd_normalize_url(new.meeting_url, 'meeting link');
  new.image_url := public.vmd_normalize_url(new.image_url, 'headshot image link');
  return new;
end $$;

create or replace function public.vmd_normalize_booking_urls() returns trigger
language plpgsql set search_path = public as $$
begin
  new.portfolio_url := public.vmd_normalize_url(new.portfolio_url, 'portfolio / LinkedIn link');
  new.meeting_url := public.vmd_normalize_url(new.meeting_url, 'meeting link');
  return new;
end $$;
revoke all on function public.vmd_normalize_mentor_urls() from public, anon, authenticated;
revoke all on function public.vmd_normalize_booking_urls() from public, anon, authenticated;

-- Runs before every insert/update, whichever page or function saves the row.
-- Named so it runs after vmd_before_booking (triggers fire in name order).
drop trigger if exists vmd_normalize_urls on public.mentors;
create trigger vmd_normalize_urls before insert or update of linkedin_url, meeting_url, image_url on public.mentors
  for each row execute function public.vmd_normalize_mentor_urls();
drop trigger if exists vmd_normalize_urls on public.bookings;
create trigger vmd_normalize_urls before insert or update of portfolio_url, meeting_url on public.bookings
  for each row execute function public.vmd_normalize_booking_urls();
