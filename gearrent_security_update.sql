-- =====================================================================
-- GearRent — security & moderation update
-- Run this in the Supabase SQL Editor AFTER the existing schema files
-- (gearrent_supabase_schema.sql, ..._part2_seed.sql, ..._storage_setup.sql).
-- It is idempotent: running it twice is safe.
--
-- What it adds
--   1. Role protection  — nobody can make themselves an admin; only an
--      existing admin can grant / revoke the admin role (RPCs below).
--   2. Product review   — provider listings start as `pending` and are
--      hidden from the catalog until an admin approves them.
--   3. Token revocation — every RLS-protected table now requires that the
--      caller's JWT belongs to a session that still exists. A global
--      sign-out deletes the sessions, so already-issued access tokens stop
--      working immediately instead of living until they expire.
--   4. Rate limits      — publishing listings and admin role changes are
--      throttled server-side.
--
-- BOOTSTRAP: the very first admin has to be set by hand (the SQL editor
-- runs without a user JWT, so the role guard lets it through):
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------

create or replace function public.gearrent_is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select uid is not null
     and exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin');
$$;

grant execute on function public.gearrent_is_admin(uuid) to anon, authenticated;


-- True when the JWT on the current request belongs to a session that has
-- not been signed out / revoked. Requests without a user (anon key, SQL
-- editor, service role) are not affected.
create or replace function public.gearrent_session_active()
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  sid text := auth.jwt() ->> 'session_id';
begin
  if auth.uid() is null then
    return true;
  end if;
  if sid is null or sid = '' then
    -- Tokens minted before sessions were tracked. Every login from a current
    -- Supabase Auth server includes session_id, so this is compatibility only.
    return true;
  end if;
  return exists (
    select 1
    from auth.sessions s
    where s.id = sid::uuid
      and s.user_id = auth.uid()
      and (s.not_after is null or s.not_after > now())
  );
end;
$$;

grant execute on function public.gearrent_session_active() to anon, authenticated;


-- Simple sliding-window rate limiter used by the triggers / RPCs below.
create table if not exists public.gearrent_rate_limits (
  id bigint generated always as identity primary key,
  bucket text not null,
  hit_at timestamptz not null default now()
);
create index if not exists gearrent_rate_limits_bucket_idx
  on public.gearrent_rate_limits (bucket, hit_at desc);
alter table public.gearrent_rate_limits enable row level security;
-- (no policies on purpose: only security-definer functions touch it)

create or replace function public.gearrent_check_rate_limit(p_bucket text, p_max integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hits integer;
begin
  delete from public.gearrent_rate_limits
   where bucket = p_bucket and hit_at < now() - p_window;

  select count(*) into hits
    from public.gearrent_rate_limits
   where bucket = p_bucket and hit_at >= now() - p_window;

  if hits >= p_max then
    raise exception 'Too many requests. Please wait a few minutes and try again.'
      using errcode = 'P0001', hint = 'rate_limited';
  end if;

  insert into public.gearrent_rate_limits (bucket) values (p_bucket);
end;
$$;

revoke all on function public.gearrent_check_rate_limit(text, integer, interval) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 1. Role protection on profiles
-- ---------------------------------------------------------------------

create or replace function public.gearrent_guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Sign-up metadata can never create an admin.
    if new.role = 'admin' and not public.gearrent_is_admin() then
      new.role := 'customer';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
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


-- Admin-only: grant or revoke the admin role for an existing account.
create or replace function public.admin_set_user_role(p_email text, p_role text)
returns table (id uuid, email text, name text, role text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  target public.profiles%rowtype;
  admin_count integer;
begin
  if not public.gearrent_is_admin() then
    raise exception 'Only administrators can manage administrator accounts.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'customer') then
    raise exception 'Unsupported role: %', p_role using errcode = '22023';
  end if;

  perform public.gearrent_check_rate_limit('role:' || auth.uid()::text, 20, interval '1 hour');

  select * into target from public.profiles p where lower(p.email) = lower(trim(p_email));
  if not found then
    raise exception 'No account exists for %.', p_email using errcode = 'P0002';
  end if;

  if p_role <> 'admin' and target.role = 'admin' then
    if target.id = auth.uid() then
      raise exception 'You cannot remove your own administrator access.' using errcode = '42501';
    end if;
    select count(*) into admin_count from public.profiles p where p.role = 'admin';
    if admin_count <= 1 then
      raise exception 'At least one administrator must remain.' using errcode = '42501';
    end if;
  end if;

  update public.profiles p set role = p_role where p.id = target.id;

  begin
    insert into public.notifications (message, type, is_admin_channel)
    values (
      case when p_role = 'admin'
        then coalesce(nullif(target.name, ''), target.email) || ' was granted administrator access.'
        else coalesce(nullif(target.name, ''), target.email) || ' is no longer an administrator.'
      end,
      'info',
      true
    );
  exception when others then null; -- notifications are best-effort
  end;

  return query select target.id, target.email, target.name, p_role;
end;
$$;

grant execute on function public.admin_set_user_role(text, text) to authenticated;


create or replace function public.admin_list_admins()
returns table (id uuid, email text, name text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.gearrent_is_admin() then
    raise exception 'Only administrators can view administrator accounts.' using errcode = '42501';
  end if;
  return query
    select p.id, p.email, p.name, p.created_at
      from public.profiles p
     where p.role = 'admin'
     order by p.created_at nulls last;
end;
$$;

grant execute on function public.admin_list_admins() to authenticated;


-- ---------------------------------------------------------------------
-- 2. Product review workflow
-- ---------------------------------------------------------------------

-- Existing rows are back-filled as 'approved' so the current catalog stays
-- visible; the default then flips to 'pending' for everything new.
alter table public.products add column if not exists approval_status text not null default 'approved';
alter table public.products alter column approval_status set default 'pending';
alter table public.products add column if not exists review_note text;
alter table public.products add column if not exists reviewed_by uuid references auth.users (id) on delete set null;
alter table public.products add column if not exists reviewed_at timestamptz;
alter table public.products add column if not exists submitted_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_approval_status_check'
  ) then
    alter table public.products
      add constraint products_approval_status_check
      check (approval_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists products_approval_status_idx on public.products (approval_status);


create or replace function public.gearrent_guard_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean := public.gearrent_is_admin();
begin
  -- Trusted context (SQL editor / service role / seed scripts).
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if is_admin then
      new.approval_status := 'approved';
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    else
      if new.provider_id is distinct from auth.uid() then
        raise exception 'You can only publish listings under your own account.' using errcode = '42501';
      end if;
      perform public.gearrent_check_rate_limit('publish:' || auth.uid()::text, 10, interval '1 hour');
      new.approval_status := 'pending';
      new.review_note := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
    end if;
    new.submitted_at := now();
    return new;
  end if;

  -- UPDATE
  if is_admin then
    return new;
  end if;

  if new.approval_status is distinct from old.approval_status
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.review_note is distinct from old.review_note then
    raise exception 'Only administrators can review listings.' using errcode = '42501';
  end if;

  -- Editing what renters see sends the listing back for review, so an
  -- approved listing can't be swapped for something else afterwards.
  if row(new.name, new.price, new.blurb, new.description, new.specs, new.features, new.images, new.category_id)
     is distinct from
     row(old.name, old.price, old.blurb, old.description, old.specs, old.features, old.images, old.category_id) then
    new.approval_status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.submitted_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists gearrent_guard_product on public.products;
create trigger gearrent_guard_product
  before insert or update on public.products
  for each row execute function public.gearrent_guard_product();


-- Tell admins when something lands in the review queue.
create or replace function public.gearrent_notify_pending_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.approval_status = 'pending'
     and (tg_op = 'INSERT' or old.approval_status is distinct from 'pending') then
    begin
      insert into public.notifications (message, type, is_admin_channel)
      values ('New listing awaiting review: ' || coalesce(new.name, 'Untitled gear'), 'info', true);
    exception when others then null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_notify_pending_product on public.products;
create trigger gearrent_notify_pending_product
  after insert or update on public.products
  for each row execute function public.gearrent_notify_pending_product();


-- Non-approved listings are only visible to their owner and to admins.
-- RESTRICTIVE = AND-ed with whatever SELECT policies already exist.
drop policy if exists "gearrent_products_visible_when_approved" on public.products;
create policy "gearrent_products_visible_when_approved"
  on public.products
  as restrictive
  for select
  using (
    approval_status = 'approved'
    or provider_id = auth.uid()
    or (select public.gearrent_is_admin())
  );


create or replace function public.admin_review_product(p_product_id text, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider uuid;
  v_name text;
begin
  if not public.gearrent_is_admin() then
    raise exception 'Only administrators can review listings.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and coalesce(trim(p_note), '') = '' then
    raise exception 'Add a short reason so the provider knows what to fix.' using errcode = '22023';
  end if;

  update public.products
     set approval_status = p_decision,
         review_note = nullif(trim(p_note), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id::text = p_product_id
  returning provider_id, name into v_provider, v_name;

  if not found then
    raise exception 'Listing not found.' using errcode = 'P0002';
  end if;

  if v_provider is not null then
    begin
      insert into public.notifications (message, type, recipient_user_id, is_admin_channel)
      values (
        case when p_decision = 'approved'
          then v_name || ' was approved and is now live in the catalog.'
          else v_name || ' was not approved: ' || trim(p_note)
        end,
        case when p_decision = 'approved' then 'success' else 'warning' end,
        v_provider,
        false
      );
    exception when others then null;
    end;
  end if;
end;
$$;

grant execute on function public.admin_review_product(text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Revoked sessions lose database access immediately
-- ---------------------------------------------------------------------
-- Adds a RESTRICTIVE policy to every RLS-enabled table in `public`, for the
-- `authenticated` role only (anonymous catalog browsing is unaffected).
-- Re-run this block if you add new tables later.
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity
  loop
    execute format('drop policy if exists "gearrent_active_session_required" on public.%I', t.relname);
    execute format(
      'create policy "gearrent_active_session_required" on public.%I
         as restrictive for all to authenticated
         using ((select public.gearrent_session_active()))
         with check ((select public.gearrent_session_active()))',
      t.relname
    );
  end loop;
end $$;

-- Same protection for uploads.
drop policy if exists "gearrent_active_session_required" on storage.objects;
create policy "gearrent_active_session_required"
  on storage.objects
  as restrictive
  for all
  to authenticated
  using ((select public.gearrent_session_active()))
  with check ((select public.gearrent_session_active()));
