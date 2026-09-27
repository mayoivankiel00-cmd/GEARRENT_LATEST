-- =====================================================================
-- GearRent — membership, booking and admin-data integrity
-- Run in the Supabase SQL Editor AFTER gearrent_notifications_update.sql
-- (it reuses gearrent_is_admin, gearrent_check_rate_limit,
-- gearrent_session_active, gearrent_notify_link and gearrent_peso).
-- Idempotent: safe to run more than once.
--
-- Fixes three holes:
--   1. Anyone could make themselves a Gear Provider by writing
--      profiles.tier from the browser (and could publish listings without
--      being one). The provider tier is now only granted by
--      purchase_provider_membership(), and only providers/admins can list.
--   2. The same product could be rented by several people at once. A
--      product with an active rental can no longer be checked out, and
--      products.status follows the rental (booked <-> available).
--   3. The admin dashboard read legacy localStorage data. It now reads
--      admin_dashboard_snapshot(), which only admins can call.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Provider tier can't be self-assigned
-- ---------------------------------------------------------------------

create or replace function public.gearrent_is_provider_tier(p_tier text)
returns boolean
language sql
immutable
as $$ select coalesce(p_tier, '') ilike '%provider%'; $$;

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
    -- Sign-up metadata can never create a provider.
    if public.gearrent_is_provider_tier(new.tier) and not public.gearrent_is_admin() then
      new.tier := 'Gear Renter';
    end if;
    return new;
  end if;

  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.tier is distinct from old.tier
     and public.gearrent_is_provider_tier(new.tier)
     and not public.gearrent_is_admin() then
    raise exception 'The Gear Provider membership has to be purchased on the Memberships page.'
      using errcode = '42501', hint = 'membership_required';
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_guard_profile_tier on public.profiles;
create trigger gearrent_guard_profile_tier
  before insert or update on public.profiles
  for each row execute function public.gearrent_guard_profile_tier();


-- Only providers (and admins) can publish listings.
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
    raise exception 'Only Gear Providers can list equipment. Upgrade on the Memberships page.'
      using errcode = '42501', hint = 'membership_required';
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_require_provider_listing on public.products;
create trigger gearrent_require_provider_listing
  before insert on public.products
  for each row execute function public.gearrent_require_provider_listing();


-- ---------------------------------------------------------------------
-- 2. Provider membership purchase
-- ---------------------------------------------------------------------

create or replace function public.gearrent_provider_membership_fee()
returns numeric
language sql
immutable
as $$ select 499::numeric; $$;

grant execute on function public.gearrent_provider_membership_fee() to anon, authenticated;

create table if not exists public.membership_payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  tier text not null,
  amount numeric(12, 2) not null,
  card_last4 text check (card_last4 ~ '^[0-9]{4}$'),
  period_start timestamptz not null default now(),
  period_end timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists membership_payments_user_idx on public.membership_payments (user_id, created_at desc);

alter table public.membership_payments enable row level security;
revoke all on public.membership_payments from anon, authenticated;
grant select on public.membership_payments to authenticated;

drop policy if exists "Users read own membership payments" on public.membership_payments;
create policy "Users read own membership payments"
  on public.membership_payments for select
  to authenticated
  using (user_id = auth.uid() or (select public.gearrent_is_admin()));
-- No insert/update/delete policies: only purchase_provider_membership writes.

drop policy if exists "gearrent_active_session_required" on public.membership_payments;
create policy "gearrent_active_session_required"
  on public.membership_payments
  as restrictive for all to authenticated
  using ((select public.gearrent_session_active()))
  with check ((select public.gearrent_session_active()));


-- NOTE: the card form is still simulated, so this trusts the page. When a
-- real payment provider is added, run this from its confirmed-payment
-- webhook (or verify the payment inside it) instead of from the page.
create or replace function public.purchase_provider_membership(p_card_last4 text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_fee numeric := public.gearrent_provider_membership_fee();
  v_tier text;
  v_name text;
  v_payment record;
begin
  if uid is null then
    raise exception 'Please sign in to upgrade.' using errcode = '42501';
  end if;
  if p_card_last4 is not null and p_card_last4 !~ '^[0-9]{4}$' then
    raise exception 'Invalid card number.' using errcode = '22023';
  end if;

  perform public.gearrent_check_rate_limit('membership:' || uid::text, 5, interval '1 hour');

  select tier, coalesce(nullif(name, ''), email, 'A member') into v_tier, v_name
    from public.profiles where id = uid for update;
  if not found then
    raise exception 'Account not found.' using errcode = 'P0002';
  end if;
  if public.gearrent_is_provider_tier(v_tier) then
    raise exception 'You are already a Gear Provider.' using errcode = 'P0001', hint = 'already_provider';
  end if;

  insert into public.membership_payments (user_id, tier, amount, card_last4, period_end)
  values (uid, 'Gear Provider', v_fee, p_card_last4, now() + interval '1 month')
  returning id, amount, period_end into v_payment;

  update public.profiles set tier = 'Gear Provider' where id = uid;

  perform public.gearrent_notify_link(uid,
    'Payment of ' || public.gearrent_peso(v_fee) || ' confirmed. Your Gear Provider membership is active — you can now list equipment.',
    'success', false, '/provider-gear');
  perform public.gearrent_notify_link(null,
    v_name || ' upgraded to Gear Provider (' || public.gearrent_peso(v_fee) || ').',
    'info', true, '/admin/users');

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'tier', 'Gear Provider',
    'amount', v_payment.amount,
    'period_end', v_payment.period_end
  );
end;
$$;

revoke all on function public.purchase_provider_membership(text) from public, anon;
grant execute on function public.purchase_provider_membership(text) to authenticated;


-- ---------------------------------------------------------------------
-- 3. One active rental per product
-- ---------------------------------------------------------------------
-- checkout_cart() locks the product rows (FOR UPDATE), so two checkouts of
-- the same product run one after the other and the second one sees the
-- first one's rental here.

create or replace function public.gearrent_prevent_double_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if new.status = 'active' and exists (
    select 1 from public.rentals
     where product_id = new.product_id and status = 'active'
  ) then
    select name into v_name from public.products where id = new.product_id;
    raise exception '% is currently booked.', coalesce(v_name, 'This item')
      using errcode = 'P0001', hint = 'unavailable';
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_prevent_double_booking on public.rentals;
create trigger gearrent_prevent_double_booking
  before insert on public.rentals
  for each row execute function public.gearrent_prevent_double_booking();

-- Keeps products.status in step with rentals so the catalog shows
-- "Booked". The trigger above is the real guard; if the base schema limits
-- products.status to other values, the status just isn't updated.
create or replace function public.gearrent_sync_product_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if tg_op = 'INSERT' and new.status = 'active' then
      update public.products set status = 'booked'
       where id = new.product_id and status = 'available';
    elsif tg_op = 'UPDATE' and old.status = 'active' and new.status is distinct from 'active' then
      update public.products set status = 'available'
       where id = new.product_id and status = 'booked'
         and not exists (
           select 1 from public.rentals
            where product_id = new.product_id and status = 'active' and id <> new.id
         );
    end if;
  exception when check_violation then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists gearrent_sync_product_status on public.rentals;
create trigger gearrent_sync_product_status
  after insert or update of status on public.rentals
  for each row execute function public.gearrent_sync_product_status();

-- Database-level backstop. Only created when existing data allows it (if
-- a product already has two active rentals, close one and re-run).
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'rentals_one_active_per_product') then
    if exists (
      select product_id from public.rentals where status = 'active'
       group by product_id having count(*) > 1
    ) then
      raise notice 'Some products already have more than one active rental; unique index rentals_one_active_per_product was NOT created.';
    else
      create unique index rentals_one_active_per_product on public.rentals (product_id) where status = 'active';
    end if;
  end if;
end $$;

-- Backfill: products currently out on rental show as booked.
do $$
begin
  update public.products p set status = 'booked'
   where p.status = 'available'
     and exists (select 1 from public.rentals r where r.product_id = p.id and r.status = 'active');
exception when check_violation then
  raise notice 'products.status does not accept ''booked''; catalog badges will not show bookings.';
end $$;


-- ---------------------------------------------------------------------
-- 4. Admin dashboard data
-- ---------------------------------------------------------------------

create or replace function public.admin_dashboard_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.gearrent_is_admin() then
    raise exception 'Administrators only.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'accounts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'email', p.email, 'name', p.name, 'tier', p.tier, 'role', p.role,
        'balance', p.balance, 'created_at', p.created_at
      ) order by p.created_at desc), '[]'::jsonb)
      from public.profiles p
    ),
    'rentals', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'user_id', r.user_id, 'email', u.email, 'product_id', r.product_id,
        'product_name', pr.name, 'category_id', pr.category_id, 'days', r.days, 'status', r.status,
        'rented_at', r.rented_at, 'paid_at', r.paid_at, 'return_at', r.return_at, 'finished_at', r.finished_at,
        'rental_amount', r.rental_amount, 'security_deposit', r.security_deposit,
        'deposit_status', r.deposit_status, 'service_fee', r.service_fee
      ) order by coalesce(r.paid_at, r.rented_at) desc nulls last), '[]'::jsonb)
      from public.rentals r
      left join public.products pr on pr.id = r.product_id
      left join public.profiles u on u.id = r.user_id
    ),
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', pr.id, 'name', pr.name, 'price', pr.price, 'status', pr.status,
        'category_id', pr.category_id, 'provider_id', pr.provider_id, 'provider_email', pv.email,
        'approval_status', pr.approval_status
      ) order by pr.name), '[]'::jsonb)
      from public.products pr
      left join public.profiles pv on pv.id = pr.provider_id
    ),
    'membership_revenue', (
      select coalesce(sum(amount), 0) from public.membership_payments
    )
  );
end;
$$;

revoke all on function public.admin_dashboard_snapshot() from public, anon;
grant execute on function public.admin_dashboard_snapshot() to authenticated;
