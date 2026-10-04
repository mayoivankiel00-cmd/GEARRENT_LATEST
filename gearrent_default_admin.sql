-- =====================================================================
-- GearRent — default administrator
-- Run this in the Supabase SQL Editor AFTER gearrent_security_update.sql.
-- It is idempotent: running it twice is safe.
--
-- One account is hard-wired as the default admin:
--   * it is made admin now (if it already exists) and on sign-up (if not),
--   * its admin role can never be revoked, by anyone.
-- The account is matched on the verified auth email (auth.users), not the
-- editable profiles.email column, so nobody can claim it by renaming.
--
-- To change the default admin, edit the email below, re-run this file, and
-- update DEFAULT_ADMIN_EMAIL in src/admin/adminAccounts.js to match.
-- =====================================================================

create or replace function public.gearrent_default_admin_email()
returns text
language sql
immutable
as $$
  select 'gearrent0@gmail.com'::text;
$$;

grant execute on function public.gearrent_default_admin_email() to anon, authenticated;


create or replace function public.gearrent_is_default_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
     where u.id = uid
       and lower(u.email) = lower(public.gearrent_default_admin_email())
  );
$$;

grant execute on function public.gearrent_is_default_admin(uuid) to authenticated;


-- Replaces the role guard from gearrent_security_update.sql, keeping its
-- rules and adding the default-admin ones.
create or replace function public.gearrent_guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if public.gearrent_is_default_admin(new.id) then
      new.role := 'admin';
    -- Sign-up metadata can never create any other admin.
    elsif new.role = 'admin' and not public.gearrent_is_admin() then
      new.role := 'customer';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    -- Applies to everyone, including the SQL editor.
    if old.role = 'admin' and public.gearrent_is_default_admin(old.id) then
      raise exception 'The default administrator account cannot lose admin access.'
        using errcode = '42501';
    end if;
    -- auth.uid() is null in the SQL editor / service-role context (trusted).
    if auth.uid() is not null and not public.gearrent_is_admin() then
      raise exception 'Only administrators can change account roles.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_guard_profile_role on public.profiles;
create trigger gearrent_guard_profile_role
  before insert or update on public.profiles
  for each row execute function public.gearrent_guard_profile_role();


-- Promote the account now if it already exists.
update public.profiles p
   set role = 'admin'
 where p.role is distinct from 'admin'
   and public.gearrent_is_default_admin(p.id);
