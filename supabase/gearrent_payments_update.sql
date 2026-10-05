-- =====================================================================
-- GearRent — server-side money handling
-- Run in the Supabase SQL Editor AFTER gearrent_security_update.sql
-- (it reuses gearrent_check_rate_limit and gearrent_session_active).
-- Idempotent: safe to run more than once.
--
-- Before this file the browser calculated prices, deposits and refunds and
-- wrote them straight into `rentals` and `profiles.balance`. Now:
--   * checkout_cart()        prices the caller's cart from the products table,
--                            creates the rentals, pays providers, empties cart
--   * return_rental(id)      refunds unused days + deposit (computed here)
--   * finish_rental(id)      refunds the deposit
--   * request_withdrawal(n)  moves money out of the caller's balance
--   * every balance change is recorded in balance_transactions
--   * clients can no longer write profiles.balance, insert rentals, or change
--     a rental's money/status fields directly
--   * credit_user_balance() is no longer callable from the browser
--
-- Pricing rules (unchanged from the original app):
--   rental amount    = daily price x days
--   security deposit = max(100, price x 2% rounded up to the next 100)
--   service fee      = 500 per checkout
--   return refund    = unused days x daily rate + deposit
--   finish refund    = deposit
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Pricing helpers (single source of truth)
-- ---------------------------------------------------------------------

create or replace function public.gearrent_security_deposit(p_price numeric)
returns numeric
language sql
immutable
as $$
  select greatest(100, ceil((coalesce(p_price, 0) * 0.02) / 100) * 100);
$$;

create or replace function public.gearrent_service_fee()
returns numeric
language sql
immutable
as $$ select 500::numeric; $$;

create or replace function public.gearrent_peso(p_amount numeric)
returns text
language sql
immutable
as $$
  select '₱' || case
    when p_amount = trunc(p_amount) then to_char(p_amount, 'FM999,999,999,990')
    else to_char(p_amount, 'FM999,999,999,990.00')
  end;
$$;

grant execute on function public.gearrent_security_deposit(numeric) to anon, authenticated;
grant execute on function public.gearrent_service_fee() to anon, authenticated;


-- ---------------------------------------------------------------------
-- 1. Balance ledger
-- ---------------------------------------------------------------------

create table if not exists public.balance_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(12, 2) not null,              -- + credit / - debit
  kind text not null check (kind in ('provider_earning', 'rental_refund', 'deposit_refund', 'withdrawal', 'adjustment')),
  rental_id text,
  checkout_id uuid,
  note text,
  balance_after numeric(12, 2),
  created_at timestamptz not null default now()
);

create index if not exists balance_transactions_user_idx on public.balance_transactions (user_id, created_at desc);

alter table public.balance_transactions enable row level security;
revoke all on public.balance_transactions from anon, authenticated;
grant select on public.balance_transactions to authenticated;

drop policy if exists "Users read own balance transactions" on public.balance_transactions;
create policy "Users read own balance transactions"
  on public.balance_transactions for select
  to authenticated
  using (user_id = auth.uid() or (select public.gearrent_is_admin()));
-- No insert/update/delete policies: only the functions below write here.

drop policy if exists "gearrent_active_session_required" on public.balance_transactions;
create policy "gearrent_active_session_required"
  on public.balance_transactions
  as restrictive for all to authenticated
  using ((select public.gearrent_session_active()))
  with check ((select public.gearrent_session_active()));


-- Internal: the ONLY way balances change.
create or replace function public.gearrent_apply_balance(
  p_user uuid,
  p_amount numeric,
  p_kind text,
  p_rental_id text default null,
  p_checkout_id uuid default null,
  p_note text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance numeric;
begin
  if p_amount = 0 then
    select balance into new_balance from public.profiles where id = p_user;
    return new_balance;
  end if;

  update public.profiles
     set balance = round(coalesce(balance, 0) + p_amount, 2)
   where id = p_user
  returning balance into new_balance;

  if not found then
    raise exception 'Account not found.' using errcode = 'P0002';
  end if;
  if new_balance < 0 then
    raise exception 'Insufficient balance.' using errcode = 'P0001', hint = 'insufficient_funds';
  end if;

  insert into public.balance_transactions (user_id, amount, kind, rental_id, checkout_id, note, balance_after)
  values (p_user, round(p_amount, 2), p_kind, p_rental_id, p_checkout_id, p_note, new_balance);

  return new_balance;
end;
$$;

revoke all on function public.gearrent_apply_balance(uuid, numeric, text, text, uuid, text) from public, anon, authenticated;


-- Internal: best-effort notification (never blocks a payment).
create or replace function public.gearrent_notify(p_user uuid, p_message text, p_type text, p_admin boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (message, type, recipient_user_id, is_admin_channel)
  values (p_message, p_type, case when p_admin then null else p_user end, p_admin);
exception when others then
  null;
end;
$$;

revoke all on function public.gearrent_notify(uuid, text, text, boolean) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Lock down direct writes from the browser
-- ---------------------------------------------------------------------
-- These trigger functions are deliberately NOT security definer: inside them
-- current_user is `authenticated`/`anon` for a request from the app, and the
-- function owner (postgres) when the change comes from the functions in this
-- file or the SQL editor.

create or replace function public.gearrent_guard_balance()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.balance := 0;
  elsif new.balance is distinct from old.balance then
    raise exception 'Account balances can only change through payments, refunds or withdrawals.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_guard_balance on public.profiles;
create trigger gearrent_guard_balance
  before insert or update on public.profiles
  for each row execute function public.gearrent_guard_balance();


create or replace function public.gearrent_guard_rentals()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Rentals are created by checkout.' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Rental records cannot be deleted. Hide them from history instead.' using errcode = '42501';
  end if;

  -- UPDATE: the renter may only hide a record from their own history.
  if (to_jsonb(new) - 'hidden_at') is distinct from (to_jsonb(old) - 'hidden_at') then
    raise exception 'Rental records can only be changed through return or finish.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_guard_rentals on public.rentals;
create trigger gearrent_guard_rentals
  before insert or update or delete on public.rentals
  for each row execute function public.gearrent_guard_rentals();


-- Old browser-callable payout function: whoever could call it could credit
-- any account. Revoke it for every signature it may have been created with.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'credit_user_balance'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.signature);
  end loop;
end $$;


-- Cart quantities must be sane (existing bad rows are left alone: NOT VALID).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cart_items_days_range') then
    alter table public.cart_items
      add constraint cart_items_days_range check (days between 1 and 90) not valid;
  end if;
end $$;


-- Extra bookkeeping on rentals.
alter table public.rentals add column if not exists checkout_id uuid;
alter table public.rentals add column if not exists daily_rate numeric(12, 2);
alter table public.rentals add column if not exists service_fee numeric(12, 2) not null default 0;


-- ---------------------------------------------------------------------
-- 3. Checkout
-- ---------------------------------------------------------------------
-- NOTE: payment itself is still simulated by the app. When a real payment
-- provider is added, call this from its confirmed-payment webhook (or
-- verify the payment intent inside it) instead of straight from the page.

create or replace function public.checkout_cart()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_checkout uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_fee numeric := public.gearrent_service_fee();
  v_subtotal numeric := 0;
  v_deposits numeric := 0;
  v_items jsonb := '[]'::jsonb;
  v_first boolean := true;
  v_renter_name text;
  item record;
  v_amount numeric;
  v_deposit numeric;
  v_rental_id text;
begin
  if uid is null then
    raise exception 'Please sign in to check out.' using errcode = '42501';
  end if;

  perform public.gearrent_check_rate_limit('checkout:' || uid::text, 10, interval '10 minutes');

  select coalesce(nullif(name, ''), 'A gear renter') into v_renter_name from public.profiles where id = uid;

  -- Lock the products being rented so two checkouts can't race each other.
  for item in
    select c.product_id, c.days, p.name, p.price, p.status, p.approval_status, p.provider_id
      from public.cart_items c
      join public.products p on p.id = c.product_id
     where c.user_id = uid
     order by p.id
       for update of p
  loop
    if item.approval_status is distinct from 'approved' then
      raise exception '% is no longer available to rent.', item.name using errcode = 'P0001', hint = 'unavailable';
    end if;
    if item.status is distinct from 'available' then
      raise exception '% is currently booked.', item.name using errcode = 'P0001', hint = 'unavailable';
    end if;
    if item.provider_id = uid then
      raise exception 'You cannot rent your own listing (%).', item.name using errcode = 'P0001';
    end if;
    if item.days is null or item.days < 1 or item.days > 90 then
      raise exception 'Rental length for % must be between 1 and 90 days.', item.name using errcode = '22023';
    end if;
    if item.price is null or item.price <= 0 then
      raise exception '% has no valid price.', item.name using errcode = 'P0001';
    end if;

    v_amount := round(item.price * item.days, 2);
    v_deposit := public.gearrent_security_deposit(item.price);

    insert into public.rentals (
      user_id, product_id, days, status, rented_at, paid_at, return_at,
      rental_amount, security_deposit, deposit_status, deposit_held_at, refundable_amount,
      checkout_id, daily_rate, service_fee
    ) values (
      uid, item.product_id, item.days, 'active', v_now, v_now, v_now + make_interval(days => item.days),
      v_amount, v_deposit, 'held', v_now, v_amount + v_deposit,
      v_checkout, item.price, case when v_first then v_fee else 0 end
    )
    returning id::text into v_rental_id;
    v_first := false;

    v_subtotal := v_subtotal + v_amount;
    v_deposits := v_deposits + v_deposit;
    v_items := v_items || jsonb_build_object(
      'rental_id', v_rental_id, 'product_id', item.product_id, 'name', item.name,
      'days', item.days, 'amount', v_amount, 'deposit', v_deposit
    );

    -- Provider earnings (catalog items owned by Gear Rent have no provider).
    if item.provider_id is not null then
      perform public.gearrent_apply_balance(item.provider_id, v_amount, 'provider_earning', v_rental_id, v_checkout,
        item.name || ' × ' || item.days || ' day(s)');
      perform public.gearrent_notify(item.provider_id,
        v_renter_name || ' rented ' || item.name || ' for ' || item.days || ' day' || case when item.days = 1 then '' else 's' end
          || '. ' || public.gearrent_peso(v_amount) || ' was added to your account balance.',
        'success');
    end if;

    perform public.gearrent_notify(null,
      v_renter_name || ' rented ' || item.name || ' for ' || item.days || ' day' || case when item.days = 1 then '' else 's' end
        || '. ' || public.gearrent_peso(v_deposit) || ' security deposit is held by Gear Rent.',
      'success', true);
  end loop;

  if v_first then
    raise exception 'Your cart is empty.' using errcode = 'P0001', hint = 'empty_cart';
  end if;

  delete from public.cart_items where user_id = uid;

  perform public.gearrent_notify(uid,
    'Payment of ' || public.gearrent_peso(v_subtotal + v_deposits + v_fee) || ' confirmed. Your gear is ready.',
    'success');

  return jsonb_build_object(
    'checkout_id', v_checkout,
    'items', v_items,
    'subtotal', v_subtotal,
    'security_deposit', v_deposits,
    'service_fee', v_fee,
    'total', v_subtotal + v_deposits + v_fee
  );
end;
$$;

grant execute on function public.checkout_cart() to authenticated;


-- ---------------------------------------------------------------------
-- 4. Return / finish
-- ---------------------------------------------------------------------

create or replace function public.return_rental(p_rental_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r record;
  v_now timestamptz := now();
  v_rate numeric;
  v_used integer;
  v_unused integer;
  v_unused_refund numeric;
  v_refund numeric;
  v_balance numeric;
  v_renter_name text;
begin
  if uid is null then
    raise exception 'Please sign in.' using errcode = '42501';
  end if;

  select rt.id, rt.days, rt.rented_at, rt.rental_amount, rt.security_deposit, rt.daily_rate, rt.status, p.name
    into r
    from public.rentals rt
    join public.products p on p.id = rt.product_id
   where rt.id::text = p_rental_id and rt.user_id = uid
     for update of rt;

  if not found then
    raise exception 'Rental not found.' using errcode = 'P0002';
  end if;
  if r.status is distinct from 'active' then
    raise exception 'This rental has already been closed.' using errcode = 'P0001', hint = 'already_closed';
  end if;

  -- Rate is what the renter actually paid, not today's catalog price.
  v_rate := coalesce(r.daily_rate, r.rental_amount / greatest(r.days, 1), 0);
  v_used := least(r.days, greatest(1, ceil(extract(epoch from (v_now - coalesce(r.rented_at, v_now))) / 86400)::integer));
  v_unused := greatest(0, r.days - v_used);
  v_unused_refund := round(v_rate * v_unused, 2);
  v_refund := v_unused_refund + coalesce(r.security_deposit, 0);

  update public.rentals
     set status = 'returned',
         finished_at = v_now,
         deposit_status = 'refunded',
         deposit_refunded_at = v_now,
         refundable_amount = v_refund
   where id = r.id;

  if v_unused_refund > 0 then
    perform public.gearrent_apply_balance(uid, v_unused_refund, 'rental_refund', p_rental_id, null,
      v_unused || ' unused day(s) of ' || r.name);
  end if;
  v_balance := public.gearrent_apply_balance(uid, coalesce(r.security_deposit, 0), 'deposit_refund', p_rental_id, null,
    'Security deposit for ' || r.name);

  select coalesce(nullif(name, ''), 'A client') into v_renter_name from public.profiles where id = uid;
  perform public.gearrent_notify(uid,
    r.name || ' was returned. ' || public.gearrent_peso(v_refund) || ' was added to your account balance, including your '
      || public.gearrent_peso(coalesce(r.security_deposit, 0)) || ' security deposit.',
    'success');
  perform public.gearrent_notify(null,
    v_renter_name || ' returned ' || r.name || '. ' || public.gearrent_peso(coalesce(r.security_deposit, 0))
      || ' security deposit was refunded.',
    'info', true);

  return jsonb_build_object(
    'rental_id', p_rental_id,
    'refund', v_refund,
    'deposit_refund', coalesce(r.security_deposit, 0),
    'unused_days', v_unused,
    'balance', v_balance
  );
end;
$$;

grant execute on function public.return_rental(text) to authenticated;


create or replace function public.finish_rental(p_rental_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r record;
  v_now timestamptz := now();
  v_balance numeric;
  v_renter_name text;
begin
  if uid is null then
    raise exception 'Please sign in.' using errcode = '42501';
  end if;

  select rt.id, rt.security_deposit, rt.status, p.name
    into r
    from public.rentals rt
    join public.products p on p.id = rt.product_id
   where rt.id::text = p_rental_id and rt.user_id = uid
     for update of rt;

  if not found then
    raise exception 'Rental not found.' using errcode = 'P0002';
  end if;
  if r.status is distinct from 'active' then
    raise exception 'This rental has already been closed.' using errcode = 'P0001', hint = 'already_closed';
  end if;

  update public.rentals
     set status = 'finished',
         finished_at = v_now,
         deposit_status = 'refunded',
         deposit_refunded_at = v_now,
         refundable_amount = coalesce(r.security_deposit, 0)
   where id = r.id;

  v_balance := public.gearrent_apply_balance(uid, coalesce(r.security_deposit, 0), 'deposit_refund', p_rental_id, null,
    'Security deposit for ' || r.name);

  select coalesce(nullif(name, ''), 'A client') into v_renter_name from public.profiles where id = uid;
  perform public.gearrent_notify(uid,
    r.name || ' was marked as finished. Your ' || public.gearrent_peso(coalesce(r.security_deposit, 0))
      || ' security deposit was returned to your balance.',
    'info');
  perform public.gearrent_notify(null,
    v_renter_name || ' finished renting ' || r.name || '. ' || public.gearrent_peso(coalesce(r.security_deposit, 0))
      || ' security deposit was refunded.',
    'info', true);

  return jsonb_build_object(
    'rental_id', p_rental_id,
    'refund', coalesce(r.security_deposit, 0),
    'deposit_refund', coalesce(r.security_deposit, 0),
    'balance', v_balance
  );
end;
$$;

grant execute on function public.finish_rental(text) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Withdrawals
-- ---------------------------------------------------------------------

create or replace function public.request_withdrawal(p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_amount numeric := round(p_amount, 2);
  v_balance numeric;
begin
  if uid is null then
    raise exception 'Please sign in.' using errcode = '42501';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Enter an amount greater than zero.' using errcode = '22023';
  end if;
  if v_amount <> p_amount then
    raise exception 'Amounts can have at most two decimal places.' using errcode = '22023';
  end if;

  perform public.gearrent_check_rate_limit('withdraw:' || uid::text, 5, interval '1 hour');

  -- Lock the row so two withdrawals can't both pass the balance check.
  select balance into v_balance from public.profiles where id = uid for update;
  if coalesce(v_balance, 0) < v_amount then
    raise exception 'The transfer cannot be greater than your account balance.'
      using errcode = 'P0001', hint = 'insufficient_funds';
  end if;

  v_balance := public.gearrent_apply_balance(uid, -v_amount, 'withdrawal', null, null, 'Transfer to linked bank account');

  perform public.gearrent_notify(uid,
    public.gearrent_peso(v_amount) || ' transfer requested for your linked bank account.', 'success');

  return jsonb_build_object('amount', v_amount, 'balance', v_balance);
end;
$$;

grant execute on function public.request_withdrawal(numeric) to authenticated;
