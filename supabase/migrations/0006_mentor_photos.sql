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
