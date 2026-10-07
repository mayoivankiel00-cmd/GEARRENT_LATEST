-- Gear Rent: keep account details private.
-- Run in the Supabase SQL Editor AFTER gearrent_security_update.sql.
-- Safe to run more than once.
--
-- The profiles table was readable by anyone holding the public (anon) key,
-- which ships inside the website, so every account's email, phone, address
-- and balance could be listed without signing in. After this:
--   * people can read only their own profile; administrators can read all;
--   * everyone can still see each provider's display name through the
--     profile_names view (the catalog shows "Listed by <name>").
-- Sign-up, tier changes, handovers and returns already go through security
-- definer functions, so they are not affected.

alter table public.profiles enable row level security;

-- Start from a clean slate: drop every existing rule on profiles (the
-- original schema's names aren't known here, and some allowed everything),
-- then add back only the two below. Creating profiles happens in the
-- sign-up trigger and admin changes in functions, so neither needs a rule.
do $$
declare
  p record;
begin
  for p in
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', p.policyname);
  end loop;
end;
$$;

create policy "gearrent_profiles_read_own_or_admin"
  on public.profiles
  for select
  using (id = auth.uid() or (select public.gearrent_is_admin()));

-- Editing your own profile (My Profile page). The email, role and tier
-- triggers still decide which columns may change.
drop policy if exists "gearrent_profiles_update_own" on public.profiles;
create policy "gearrent_profiles_update_own"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Display names only, for product cards, and only for people who have listed
-- gear. The view runs as its owner so it can skip the rules above; that is
-- deliberate, which is why Supabase's linter reports it as a "Security
-- Definer View". It exposes nothing besides id and name.
create or replace view public.profile_names
  with (security_invoker = false)
as
  select p.id, p.name
    from public.profiles p
   where exists (select 1 from public.products pr where pr.provider_id = p.id);

revoke all on public.profile_names from public, anon, authenticated;
grant select on public.profile_names to anon, authenticated;

-- Let the API see the new view straight away.
notify pgrst, 'reload schema';
