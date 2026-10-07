-- Gear Rent: keep account details private.
-- Run in the Supabase SQL Editor AFTER gearrent_security_update.sql.
-- Safe to run more than once.
--
-- The profiles table was readable by anyone holding the public (anon) key,
-- which ships inside the website, so every account's email, phone, address
-- and balance could be listed without signing in. After this:
--   * people can read only their own profile; administrators can read all;
--   * everyone can still see each provider's display name through the
--     provider_names table (the catalog shows "Listed by <name>").
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

-- Display names for product cards ("Listed by <name>"), only for people who
-- have listed gear. A plain table rather than a view that skips the rules
-- above, so Supabase's linter has nothing to flag. Triggers keep it in step
-- with profiles and products; nobody can write to it through the API.
drop view if exists public.profile_names;

create table if not exists public.provider_names (
  id uuid primary key references public.profiles (id) on delete cascade,
  name text
);

alter table public.provider_names enable row level security;

drop policy if exists "gearrent_provider_names_public_read" on public.provider_names;
create policy "gearrent_provider_names_public_read"
  on public.provider_names
  for select
  using (true);

revoke all on public.provider_names from public, anon, authenticated;
grant select on public.provider_names to anon, authenticated;

-- Someone lists gear: add (or refresh) their name.
create or replace function public.gearrent_sync_provider_name_from_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.provider_id is not null then
    insert into public.provider_names (id, name)
    select p.id, p.name from public.profiles p where p.id = new.provider_id
    on conflict (id) do update set name = excluded.name;
  end if;
  return new;
end;
$$;

revoke all on function public.gearrent_sync_provider_name_from_product() from public, anon, authenticated;

drop trigger if exists gearrent_sync_provider_name on public.products;
create trigger gearrent_sync_provider_name
  after insert or update of provider_id on public.products
  for each row execute function public.gearrent_sync_provider_name_from_product();

-- A provider renames themselves on My Profile.
create or replace function public.gearrent_sync_provider_name_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.provider_names set name = new.name where id = new.id;
  return new;
end;
$$;

revoke all on function public.gearrent_sync_provider_name_from_profile() from public, anon, authenticated;

drop trigger if exists gearrent_sync_provider_name on public.profiles;
create trigger gearrent_sync_provider_name
  after update of name on public.profiles
  for each row execute function public.gearrent_sync_provider_name_from_profile();

-- Fill it in for everyone who already has listings.
insert into public.provider_names (id, name)
select distinct p.id, p.name
  from public.profiles p
  join public.products pr on pr.provider_id = p.id
on conflict (id) do update set name = excluded.name;

-- Let the API see the changes straight away.
notify pgrst, 'reload schema';
