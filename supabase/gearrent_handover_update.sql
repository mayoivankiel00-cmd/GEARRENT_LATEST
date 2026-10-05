-- =====================================================================
-- GearRent: the rental clock starts at handover, not at payment
-- Run in the Supabase SQL Editor AFTER gearrent_returns_update.sql.
-- Idempotent: safe to run more than once.
--
-- Before: checkout set rented_at = now and return_at = now + days, so the
-- renter's time was already running while they waited to receive the gear.
-- Now:
--   1. Checkout reserves the gear (the rental is 'active' and the product is
--      booked) but leaves rented_at / return_at empty.
--   2. The owner (the provider, or an admin for Gear Rent's own gear; admins
--      can start any rental) hands the gear over and calls start_rental().
--      That sets rented_at = now and return_at = now + days.
--   3. Everything that already uses those columns (due/overdue alerts, late
--      fees, early-return refunds, the renter's countdown) now counts from
--      the handover. A rental that hasn't started can't be returned yet.
-- Rentals that were already running when this file is run keep their dates.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------

do $$
begin
  alter table public.rentals alter column rented_at drop not null;
  alter table public.rentals alter column return_at drop not null;
exception when undefined_column then
  raise notice 'rentals.rented_at / return_at not found; check the base schema.';
end $$;

alter table public.rentals add column if not exists handed_over_by uuid references auth.users (id) on delete set null;


-- ---------------------------------------------------------------------
-- 2. New rentals wait for the handover
-- ---------------------------------------------------------------------

create or replace function public.gearrent_wait_for_handover()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_renter text;
begin
  if new.status is distinct from 'active' then
    return new;
  end if;

  new.rented_at := null;
  new.return_at := null;

  select name, provider_id into v_product from public.products where id = new.product_id;
  select coalesce(nullif(name, ''), email, 'A renter') into v_renter from public.profiles where id = new.user_id;

  -- Tell whoever has the gear that it is waiting to be handed over.
  if v_product.provider_id is not null then
    perform public.gearrent_notify_link(v_product.provider_id,
      v_renter || ' paid for ' || coalesce(v_product.name, 'your gear') || '. Hand it over and press Start rental in Provider Gear; their rental time starts then.',
      'info', false, '/provider-gear');
  else
    perform public.gearrent_notify_link(null,
      v_renter || ' paid for ' || coalesce(v_product.name, 'gear') || '. Hand it over and press Start rental on the Returns page.',
      'info', true, '/admin/returns');
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_wait_for_handover on public.rentals;
create trigger gearrent_wait_for_handover
  before insert on public.rentals
  for each row execute function public.gearrent_wait_for_handover();


-- A rental that hasn't been handed over can't be returned yet.
create or replace function public.gearrent_require_started_rental()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.return_requested_at is not null
     and old.return_requested_at is null
     and old.rented_at is null then
    raise exception 'This rental has not started yet. It starts when the owner hands you the gear.'
      using errcode = 'P0001', hint = 'not_started';
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_require_started_rental on public.rentals;
create trigger gearrent_require_started_rental
  before update of return_requested_at on public.rentals
  for each row execute function public.gearrent_require_started_rental();


-- ---------------------------------------------------------------------
-- 3. Owner / admin: rentals waiting to be handed over
-- ---------------------------------------------------------------------

create or replace function public.list_pending_handovers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_admin boolean := public.gearrent_is_admin();
begin
  if uid is null then
    raise exception 'Please sign in.' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'rental_id', rt.id::text,
      'product_id', p.id,
      'product_name', p.name,
      'images', to_jsonb(p.images),
      'renter_name', coalesce(nullif(rp.name, ''), rp.email, 'Renter'),
      'renter_email', rp.email,
      'renter_phone', rp.phone,
      'owner_name', case when p.provider_id is null then 'Gear Rent' else coalesce(nullif(pp.name, ''), pp.email) end,
      'days', rt.days,
      'paid_at', rt.paid_at,
      'security_deposit', coalesce(rt.security_deposit, 0)
    ) order by rt.paid_at), '[]'::jsonb)
      from public.rentals rt
      join public.products p on p.id = rt.product_id
      left join public.profiles rp on rp.id = rt.user_id
      left join public.profiles pp on pp.id = p.provider_id
    where rt.status = 'active'
      and rt.rented_at is null
      and (v_admin or p.provider_id = uid)
  );
end;
$$;

revoke all on function public.list_pending_handovers() from public, anon;
grant execute on function public.list_pending_handovers() to authenticated;


-- ---------------------------------------------------------------------
-- 4. Owner / admin: hand the gear over and start the clock
-- ---------------------------------------------------------------------

create or replace function public.start_rental(p_rental_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r record;
  v_now timestamptz := now();
  v_return timestamptz;
begin
  if uid is null then
    raise exception 'Please sign in.' using errcode = '42501';
  end if;

  perform public.gearrent_check_rate_limit('handover:' || uid::text, 60, interval '1 hour');

  select rt.id, rt.user_id, rt.days, rt.status, rt.rented_at, p.name, p.provider_id
    into r
    from public.rentals rt
    join public.products p on p.id = rt.product_id
   where rt.id::text = p_rental_id
     for update of rt;

  if not found then
    raise exception 'Rental not found.' using errcode = 'P0002';
  end if;
  if not (public.gearrent_is_admin() or r.provider_id = uid) then
    raise exception 'Only the owner of this gear can start the rental.' using errcode = '42501';
  end if;
  if r.status is distinct from 'active' then
    raise exception 'This rental has already been closed.' using errcode = 'P0001', hint = 'already_closed';
  end if;
  if r.rented_at is not null then
    raise exception 'This rental has already started.' using errcode = 'P0001', hint = 'already_started';
  end if;

  v_return := v_now + make_interval(days => greatest(r.days, 1));
  update public.rentals
     set rented_at = v_now, return_at = v_return, handed_over_by = uid
   where id = r.id;

  perform public.gearrent_notify_link(r.user_id,
    'Your rental of ' || r.name || ' has started. Please return it by '
      || to_char(v_return at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM') || '.',
    'success', false, '/my-gears');

  return jsonb_build_object('rental_id', p_rental_id, 'rented_at', v_now, 'return_at', v_return);
end;
$$;

revoke all on function public.start_rental(text) from public, anon;
grant execute on function public.start_rental(text) to authenticated;
