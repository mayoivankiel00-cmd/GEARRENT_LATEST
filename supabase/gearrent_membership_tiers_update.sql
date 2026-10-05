-- =====================================================================
-- GearRent — three membership tiers
-- Run in the Supabase SQL Editor AFTER gearrent_integrity_update.sql
-- (it replaces that file's tier guard and provider purchase, and reuses
-- gearrent_is_admin, gearrent_check_rate_limit, gearrent_notify_link and
-- gearrent_peso).
-- Idempotent: safe to run more than once.
--
--   Tier                 Level  Price / month   Can
--   Gear Rent Guest        0    free (default)  browse only
--   Gear Rent Renter       1    ₱499            rent gear
--   Gear Rent Provider     2    ₱699            rent gear + list gear
--                               (₱199 when upgrading from Renter)
--
-- Each tier includes everything below it. Members can't change their own
-- tier: paid tiers are granted by purchase_membership(), and admins can set
-- any account's tier with admin_set_user_tier() (section 7).
--
-- Existing accounts: 'Gear Provider' -> 'Gear Rent Provider'; everything
-- else (including the old free 'Gear Renter') -> 'Gear Rent Guest'.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tier names, levels and prices
-- ---------------------------------------------------------------------

-- 0 = Guest, 1 = Renter, 2 = Provider. Matches getTierLevel() in
-- src/lib/providerAccess.js. Unknown / legacy values count as Guest, except
-- anything containing "provider".
create or replace function public.gearrent_tier_level(p_tier text)
returns integer
language sql
immutable
as $$
  select case
    when coalesce(p_tier, '') ilike '%provider%' then 2
    when lower(trim(coalesce(p_tier, ''))) = 'gear rent renter' then 1
    else 0
  end;
$$;

create or replace function public.gearrent_tier_name(p_level integer)
returns text
language sql
immutable
as $$
  select case p_level
    when 2 then 'Gear Rent Provider'
    when 1 then 'Gear Rent Renter'
    else 'Gear Rent Guest'
  end;
$$;

-- Kept for anything that still calls it (gearrent_require_provider_listing).
create or replace function public.gearrent_is_provider_tier(p_tier text)
returns boolean
language sql
immutable
as $$ select public.gearrent_tier_level(p_tier) >= 2; $$;

-- What an account on p_current_tier pays to move up to p_target
-- ('renter' / 'provider'). Keep in sync with src/lib/pricing.js.
create or replace function public.gearrent_membership_fee(p_target text, p_current_tier text default null)
returns numeric
language sql
immutable
as $$
  select case lower(coalesce(p_target, ''))
    when 'renter' then 499::numeric
    when 'provider' then
      case when public.gearrent_tier_level(p_current_tier) = 1 then 199::numeric else 699::numeric end
  end;
$$;

grant execute on function public.gearrent_tier_level(text) to anon, authenticated;
grant execute on function public.gearrent_tier_name(integer) to anon, authenticated;
grant execute on function public.gearrent_membership_fee(text, text) to anon, authenticated;

-- Full Provider price, for anything that still calls the old function.
create or replace function public.gearrent_provider_membership_fee()
returns numeric
language sql
immutable
as $$ select 699::numeric; $$;


-- ---------------------------------------------------------------------
-- 2. profiles.tier: rename existing values, default, allowed values
-- ---------------------------------------------------------------------

-- Drop any earlier CHECK constraint on profiles.tier (the base schema may
-- have one listing the old names).
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%tier%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

-- Runs as the SQL editor user, so the tier guard below lets it through.
update public.profiles
   set tier = public.gearrent_tier_name(public.gearrent_tier_level(tier))
 where tier is distinct from public.gearrent_tier_name(public.gearrent_tier_level(tier));

-- Display-only copy of the tiers seeded by the original setup (the app
-- reads src/lib/pricing.js, not this table). Skipped if the table isn't there;
-- if its columns differ, a notice is shown and the rest of the file still runs.
do $$
begin
  if to_regclass('public.membership_tiers') is null then
    raise notice 'public.membership_tiers not found; skipped.';
    return;
  end if;
  delete from public.membership_tiers where id = 'basic';
  insert into public.membership_tiers (id, name, price, perks) values
    ('guest',    'Gear Rent Guest',    0,   '["Browse the full gear catalog", "View gear details and availability"]'::jsonb),
    ('renter',   'Gear Rent Renter',   499, '["Refundable security deposits", "Access to the full gear catalog and rent gear", "Member rental history"]'::jsonb),
    ('provider', 'Gear Rent Provider', 699, '["Everything in Gear Rent Renter", "List your own equipment", "Set your rates and availability", "Manage rental requests and earnings"]'::jsonb)
  on conflict (id) do update
    set name = excluded.name, price = excluded.price, perks = excluded.perks;
exception when others then
  raise notice 'public.membership_tiers was not updated: %', sqlerrm;
end $$;

alter table public.profiles alter column tier set default 'Gear Rent Guest';
alter table public.profiles alter column tier set not null;
alter table public.profiles add constraint profiles_tier_check
  check (tier in ('Gear Rent Guest', 'Gear Rent Renter', 'Gear Rent Provider'));


-- ---------------------------------------------------------------------
-- 3. Tiers can't be self-assigned
-- ---------------------------------------------------------------------
-- Deliberately NOT security definer: current_user tells a direct browser
-- write ('authenticated' / 'anon') apart from a trusted function or the
-- SQL editor.
create or replace function public.gearrent_guard_profile_tier()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Every new account starts as a Guest (sign-up metadata can't change that).
    if public.gearrent_is_admin() then
      new.tier := public.gearrent_tier_name(public.gearrent_tier_level(new.tier));
    else
      new.tier := 'Gear Rent Guest';
    end if;
    return new;
  end if;

  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.tier is distinct from old.tier then
    new.tier := public.gearrent_tier_name(public.gearrent_tier_level(new.tier));
    -- Members can't change their own tier in either direction: moving up
    -- needs a payment (purchase_membership) and moving down is not offered.
    -- Admins change tiers with admin_set_user_tier().
    if new.tier is distinct from old.tier and not public.gearrent_is_admin() then
      raise exception 'Memberships can only be changed by purchasing one on the Memberships page, or by an administrator.'
        using errcode = '42501', hint = 'membership_required';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_guard_profile_tier on public.profiles;
create trigger gearrent_guard_profile_tier
  before insert or update on public.profiles
  for each row execute function public.gearrent_guard_profile_tier();


-- ---------------------------------------------------------------------
-- 4. Guests can't rent
-- ---------------------------------------------------------------------
-- Checked on the cart (so the page gets a clear message) and on rentals
-- (so checkout_cart refuses a Guest even with an old cart). Admins exempt.

create or replace function public.gearrent_require_renter_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.gearrent_is_admin() then
    return new;
  end if;
  if not exists (
    select 1 from public.profiles
     where id = new.user_id and public.gearrent_tier_level(tier) >= 1
  ) then
    raise exception 'Gear Rent Guests can only browse. Become a Gear Rent Renter on the Memberships page to rent gear.'
      using errcode = 'P0001', hint = 'membership_required';
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_require_renter_tier on public.cart_items;
create trigger gearrent_require_renter_tier
  before insert or update on public.cart_items
  for each row execute function public.gearrent_require_renter_tier();

drop trigger if exists gearrent_require_renter_tier on public.rentals;
create trigger gearrent_require_renter_tier
  before insert on public.rentals
  for each row execute function public.gearrent_require_renter_tier();


-- ---------------------------------------------------------------------
-- 5. Buying a membership
-- ---------------------------------------------------------------------
-- membership_payments (from gearrent_integrity_update.sql) records every
-- purchase; its tier column now holds the new names.

-- NOTE: the card form is still simulated, so this trusts the page. When a
-- real payment provider is added, run this from its confirmed-payment
-- webhook (or verify the payment inside it) instead of from the page.
create or replace function public.purchase_membership(p_tier text, p_card_last4 text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_target text := lower(trim(coalesce(p_tier, '')));
  v_target_level integer;
  v_target_name text;
  v_current text;
  v_fee numeric;
  v_name text;
  v_payment record;
begin
  if uid is null then
    raise exception 'Please sign in to upgrade.' using errcode = '42501';
  end if;
  if v_target not in ('renter', 'provider') then
    raise exception 'Choose the Renter or Provider membership.' using errcode = '22023';
  end if;
  if p_card_last4 is not null and p_card_last4 !~ '^[0-9]{4}$' then
    raise exception 'Invalid card number.' using errcode = '22023';
  end if;

  perform public.gearrent_check_rate_limit('membership:' || uid::text, 5, interval '1 hour');

  select tier, coalesce(nullif(name, ''), email, 'A member') into v_current, v_name
    from public.profiles where id = uid for update;
  if not found then
    raise exception 'Account not found.' using errcode = 'P0002';
  end if;

  v_target_level := case v_target when 'provider' then 2 else 1 end;
  v_target_name := public.gearrent_tier_name(v_target_level);
  if public.gearrent_tier_level(v_current) >= v_target_level then
    raise exception 'Your current plan already includes %.', v_target_name
      using errcode = 'P0001', hint = 'already_member';
  end if;

  v_fee := public.gearrent_membership_fee(v_target, v_current);

  insert into public.membership_payments (user_id, tier, amount, card_last4, period_end)
  values (uid, v_target_name, v_fee, p_card_last4, now() + interval '1 month')
  returning id, amount, period_end into v_payment;

  update public.profiles set tier = v_target_name where id = uid;

  perform public.gearrent_notify_link(uid,
    'Payment of ' || public.gearrent_peso(v_fee) || ' confirmed. Your ' || v_target_name || ' membership is active. '
      || case when v_target_level = 2 then 'You can now list equipment.' else 'You can now rent gear.' end,
    'success', false, case when v_target_level = 2 then '/provider-gear' else '/catalog' end);
  perform public.gearrent_notify_link(null,
    v_name || ' upgraded to ' || v_target_name || ' (' || public.gearrent_peso(v_fee) || ').',
    'info', true, '/admin/users');

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'tier', v_target_name,
    'amount', v_payment.amount,
    'period_end', v_payment.period_end
  );
end;
$$;

revoke all on function public.purchase_membership(text, text) from public, anon;
grant execute on function public.purchase_membership(text, text) to authenticated;

-- Old entry point, kept so an out-of-date page still works.
create or replace function public.purchase_provider_membership(p_card_last4 text default null)
returns jsonb
language sql
security definer
set search_path = public
as $$ select public.purchase_membership('provider', p_card_last4); $$;

revoke all on function public.purchase_provider_membership(text) from public, anon;
grant execute on function public.purchase_provider_membership(text) to authenticated;


-- ---------------------------------------------------------------------
-- 6. Listing rule
-- ---------------------------------------------------------------------
-- gearrent_require_provider_listing() (gearrent_integrity_update.sql)
-- already uses gearrent_is_provider_tier(), which now means level 2, so
-- only Gear Rent Providers (and admins) can list. Only its message changes.
create or replace function public.gearrent_require_provider_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.gearrent_is_admin() then
    return new;
  end if;
  if not exists (
    select 1 from public.profiles
     where id = auth.uid() and public.gearrent_is_provider_tier(tier)
  ) then
    raise exception 'Only Gear Rent Providers can list equipment. Upgrade on the Memberships page.'
      using errcode = '42501', hint = 'membership_required';
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Admins can change any member's tier
-- ---------------------------------------------------------------------
-- Used by Admin → Members → (account) → Membership. No payment is recorded:
-- this is a manual change (a complimentary upgrade, a correction, or
-- removing a membership). The member gets a notification.
create or replace function public.admin_set_user_tier(p_user_id uuid, p_tier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target text := lower(trim(coalesce(p_tier, '')));
  v_new_tier text;
  v_old_tier text;
  v_name text;
begin
  if not public.gearrent_is_admin() then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;

  -- Accept the short ids the app uses or the full tier names.
  v_new_tier := case
    when v_target in ('guest', 'gear rent guest') then 'Gear Rent Guest'
    when v_target in ('renter', 'gear rent renter') then 'Gear Rent Renter'
    when v_target in ('provider', 'gear rent provider') then 'Gear Rent Provider'
  end;
  if v_new_tier is null then
    raise exception 'Choose Guest, Renter or Provider.' using errcode = '22023';
  end if;

  perform public.gearrent_check_rate_limit('admin-tier:' || auth.uid()::text, 30, interval '1 hour');

  select tier, coalesce(nullif(name, ''), email, 'This member') into v_old_tier, v_name
    from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Account not found.' using errcode = 'P0002';
  end if;

  if v_old_tier is distinct from v_new_tier then
    update public.profiles set tier = v_new_tier where id = p_user_id;
    perform public.gearrent_notify_link(p_user_id,
      'An administrator changed your membership to ' || v_new_tier || '.',
      'info', false, '/memberships');
  end if;

  return jsonb_build_object('user_id', p_user_id, 'tier', v_new_tier, 'previous_tier', v_old_tier);
end;
$$;

revoke all on function public.admin_set_user_tier(uuid, text) from public, anon;
grant execute on function public.admin_set_user_tier(uuid, text) to authenticated;
