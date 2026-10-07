-- Gear Rent: members can't change the email on their profile.
--
-- The website no longer offers it, but a signed-in user could still send an
-- UPDATE to public.profiles straight through the API. This trigger rejects
-- any change to profiles.email unless it comes from an administrator or a
-- trusted context (the SQL editor / service role, where auth.uid() is null).
--
-- Safe to run more than once. Needs gearrent_security_update.sql first
-- (for public.gearrent_is_admin()).

create or replace function public.gearrent_guard_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email
     and auth.uid() is not null
     and not public.gearrent_is_admin() then
    raise exception 'Your sign-in email can''t be changed. Contact support if you need to update it.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_guard_profile_email on public.profiles;
create trigger gearrent_guard_profile_email
  before update on public.profiles
  for each row execute function public.gearrent_guard_profile_email();
