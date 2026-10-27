-- Public bucket for mentor headshots found automatically (LinkedIn, then Gravatar).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('headshots', 'headshots', true, 2097152, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

-- When a mentor has no photo, look one up from their LinkedIn (or Gravatar) after signup
-- or when their LinkedIn link changes.
create or replace function public.vmd_after_mentor_photo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.image_url is null and new.deleted_at is null then
    perform public.vmd_notify('mentor_photo', new.id);
  end if;
  return new;
end $$;
revoke all on function public.vmd_after_mentor_photo() from public, anon, authenticated;

drop trigger if exists vmd_after_mentor_photo on public.mentors;
create trigger vmd_after_mentor_photo after insert or update of linkedin_url, image_url on public.mentors
  for each row execute function public.vmd_after_mentor_photo();

-- Mentors may upload a headshot (max 2 MB, images only) into headshots/uploads/. No listing, changing or deleting.
drop policy if exists "vmd upload headshot" on storage.objects;
create policy "vmd upload headshot" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'headshots' and (storage.foldername(name))[1] = 'uploads');

-- Let mentors change their photo from the dashboard.
create or replace function public.mentor_update(p_token uuid, p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare e text := public.vmd_token_email(p_token, 'mentor');
begin
  update public.mentors set
    available_times = case when p ? 'available_times' then coalesce((select array_agg(x) from jsonb_array_elements_text(p->'available_times') x where x ~ '^\d{1,2}:\d{2} (AM|PM)$'), '{}') else available_times end,
    meeting_url = case when p ? 'meeting_url' then left(nullif(trim(p->>'meeting_url'), ''), 300) else meeting_url end,
    linkedin_url = case when p ? 'linkedin_url' then left(nullif(trim(p->>'linkedin_url'), ''), 300) else linkedin_url end,
    image_url = case when p ? 'image_url' then left(nullif(trim(p->>'image_url'), ''), 300) else image_url end
  where email = e and deleted_at is null;
end $$;
