  -- =====================================================================
  -- GearRent — confirmed returns and deposit rules
  -- Run in the Supabase SQL Editor AFTER gearrent_notifications_update.sql.
  -- Idempotent: safe to run more than once.
  --
  -- Before this file the renter closed their own rental (return_rental /
  -- finish_rental) and got the deposit back instantly, with nobody checking
  -- the gear. Now:
  --   1. request_rental_return(id)   the renter says they handed the gear back.
  --                                  The rental stays active (still booked).
  --                                  This only alerts the owner; it does not
  --                                  set the price.
  --   2. confirm_rental_return(...)  the gear owner (the provider, or an admin
  --                                  for Gear Rent's own gear; admins can
  --                                  confirm any rental) checks the gear,
  --                                  records when it actually came back, and
  --                                  closes the rental, optionally keeping
  --                                  part of the deposit for damage. Once a
  --                                  rental is overdue the owner can confirm
  --                                  it even if the renter never pressed
  --                                  Return gear.
  --   3. return_rental / finish_rental can no longer be called from the app.
  --
  -- Deposit rules
  --   * Late fee    = daily rate x days late, counted up to when the owner
  --                   says the gear was received (not when the renter
  --                   pressed Return gear), with a 1-hour grace period.
  --                   Any part of a day after the grace period counts as a
  --                   full day.
  --   * Damage      = amount the inspector enters (a reason is required).
  --   * Both come out of the security deposit only, late fee first, and are
  --     capped at the deposit (there is no card on file to charge more).
  --   * What is kept goes to the provider; for Gear Rent's own gear it stays
  --     with Gear Rent (recorded on the rental).
  --   * Returning early still refunds the unused days, as before.
  -- =====================================================================


  -- ---------------------------------------------------------------------
  -- 0. Columns and ledger kinds
  -- ---------------------------------------------------------------------

  alter table public.rentals add column if not exists return_requested_at timestamptz;
  alter table public.rentals add column if not exists return_confirmed_at timestamptz;
  alter table public.rentals add column if not exists return_confirmed_by uuid references auth.users (id) on delete set null;
  alter table public.rentals add column if not exists late_days integer not null default 0;
  alter table public.rentals add column if not exists late_fee numeric(12, 2) not null default 0;
  alter table public.rentals add column if not exists damage_charge numeric(12, 2) not null default 0;
  alter table public.rentals add column if not exists return_note text;

  create index if not exists rentals_return_requested_idx
    on public.rentals (return_requested_at) where status = 'active' and return_requested_at is not null;

  -- The return functions look rentals up by id::text (the app passes ids as
  -- text). Unless id is already text, that cast skips the primary key index,
  -- so index the cast itself.
  do $$
  begin
    if (select format_type(atttypid, atttypmod) from pg_attribute
         where attrelid = 'public.rentals'::regclass and attname = 'id') <> 'text' then
      execute 'create index if not exists rentals_id_text_idx on public.rentals ((id::text))';
    end if;
  end $$;

  -- Deposit outcome: 'refunded' (all back), 'partially_kept', or 'kept'
  -- (nothing back), alongside 'held' while the rental runs. Any existing
  -- deposit_status check is replaced; values already in the table stay allowed.
  -- If the column is an enum instead, the new values are added to the enum.
  do $$
  declare
    c record;
    v_values text;
    v_type oid;
  begin
    select a.atttypid into v_type from pg_attribute a
     where a.attrelid = 'public.rentals'::regclass and a.attname = 'deposit_status';

    if (select typtype from pg_type where oid = v_type) = 'e' then
      execute format('alter type %s add value if not exists %L', v_type::regtype, 'partially_kept');
      execute format('alter type %s add value if not exists %L', v_type::regtype, 'kept');
      return;
    end if;

    for c in
      select conname from pg_constraint
      where conrelid = 'public.rentals'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%deposit_status%'
    loop
      execute format('alter table public.rentals drop constraint %I', c.conname);
    end loop;

    select string_agg(quote_literal(v), ', ') into v_values
      from (
        select unnest(array['held', 'refunded', 'partially_kept', 'kept']) as v
        union
        select distinct deposit_status::text from public.rentals where deposit_status is not null
      ) s;

    execute format(
      'alter table public.rentals add constraint rentals_deposit_status_check check (deposit_status is null or deposit_status in (%s))',
      v_values);
  end $$;

  -- Allow the two new kinds of balance change (drops whatever the kind check
  -- was called and re-adds it with the full list).
  do $$
  declare
    c record;
  begin
    for c in
      select conname from pg_constraint
      where conrelid = 'public.balance_transactions'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%kind%'
    loop
      execute format('alter table public.balance_transactions drop constraint %I', c.conname);
    end loop;
    alter table public.balance_transactions
      add constraint balance_transactions_kind_check check (kind in (
        'provider_earning', 'rental_refund', 'deposit_refund', 'withdrawal', 'adjustment',
        'late_fee', 'damage_charge'
      ));
  end $$;


  -- ---------------------------------------------------------------------
  -- 1. Pricing of a return (single source of truth)
  -- ---------------------------------------------------------------------

  create or replace function public.gearrent_return_quote(
    p_rented_at timestamptz,
    p_return_at timestamptz,
    p_days integer,
    p_rate numeric,
    p_handed_at timestamptz
  )
  returns table (used_days integer, unused_days integer, unused_refund numeric, late_days integer, late_fee numeric)
  language sql
  immutable
  as $$
    select u.used,
          greatest(0, p_days - u.used),
          round(coalesce(p_rate, 0) * greatest(0, p_days - u.used), 2),
          l.late,
          round(coalesce(p_rate, 0) * l.late, 2)
      from (
        select least(p_days, greatest(1,
          ceil(extract(epoch from (p_handed_at - coalesce(p_rented_at, p_handed_at))) / 86400)::integer)) as used
      ) u,
      (
        select greatest(0,
          ceil(extract(epoch from (p_handed_at - coalesce(p_return_at, p_handed_at) - interval '1 hour')) / 86400)::integer) as late
      ) l;
  $$;

  -- Pure arithmetic on the arguments (reads no tables), so the inspection
  -- screen may call it to preview a return.
  grant execute on function public.gearrent_return_quote(timestamptz, timestamptz, integer, numeric, timestamptz) to authenticated;


  -- ---------------------------------------------------------------------
  -- 2. Renter: request a return
  -- ---------------------------------------------------------------------

  create or replace function public.request_rental_return(p_rental_id text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    uid uuid := auth.uid();
    r record;
    q record;
    v_renter_name text;
  begin
    if uid is null then
      raise exception 'Please sign in.' using errcode = '42501';
    end if;

    perform public.gearrent_check_rate_limit('return:' || uid::text, 20, interval '1 hour');

    select rt.id, rt.days, rt.rented_at, rt.return_at, rt.rental_amount, rt.daily_rate, rt.status,
          rt.return_requested_at, p.name, p.provider_id
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

    if r.return_requested_at is null then
      r.return_requested_at := now();
      update public.rentals set return_requested_at = r.return_requested_at where id = r.id;

      select coalesce(nullif(name, ''), 'A renter') into v_renter_name from public.profiles where id = uid;
      if r.provider_id is not null then
        perform public.gearrent_notify_link(r.provider_id,
          v_renter_name || ' is returning your ' || r.name || '. Check the gear and confirm the return in Provider Gear.',
          'warning', false, '/provider-gear');
      else
        perform public.gearrent_notify_link(null,
          v_renter_name || ' is returning ' || r.name || '. Check the gear and confirm the return.',
          'warning', true, '/admin/returns');
      end if;
    end if;

    select * into q from public.gearrent_return_quote(
      r.rented_at, r.return_at, r.days,
      coalesce(r.daily_rate, r.rental_amount / greatest(r.days, 1)), r.return_requested_at);

    return jsonb_build_object(
      'rental_id', p_rental_id,
      'requested_at', r.return_requested_at,
      'late_days', q.late_days,
      'late_fee', q.late_fee
    );
  end;
  $$;

  revoke all on function public.request_rental_return(text) from public, anon;
  grant execute on function public.request_rental_return(text) to authenticated;


  -- ---------------------------------------------------------------------
  -- 3. Owner / admin: list returns waiting for inspection
  --    (renter pressed Return gear, or the rental is overdue). The late fee /
  --    refund in each row is a quote for gear received now; the inspection
  --    screen re-quotes with gearrent_return_quote() if the owner picks an
  --    earlier time.
  -- ---------------------------------------------------------------------

  create or replace function public.list_pending_returns()
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
        'owner_name', case when p.provider_id is null then 'Gear Rent' else coalesce(nullif(pp.name, ''), pp.email) end,
        'days', rt.days,
        'rented_at', rt.rented_at,
        'return_at', rt.return_at,
        'return_requested_at', rt.return_requested_at,
        'daily_rate', coalesce(rt.daily_rate, rt.rental_amount / greatest(rt.days, 1)),
        'security_deposit', coalesce(rt.security_deposit, 0),
        'late_days', q.late_days,
        'late_fee', q.late_fee,
        'unused_days', q.unused_days,
        'unused_refund', q.unused_refund,
        -- true when the renter never pressed Return gear (rental is overdue)
        'not_requested', rt.return_requested_at is null
      ) order by coalesce(rt.return_requested_at, rt.return_at)), '[]'::jsonb)
        from public.rentals rt
        join public.products p on p.id = rt.product_id
        left join public.profiles rp on rp.id = rt.user_id
        left join public.profiles pp on pp.id = p.provider_id
        cross join lateral public.gearrent_return_quote(
          rt.rented_at, rt.return_at, rt.days,
          coalesce(rt.daily_rate, rt.rental_amount / greatest(rt.days, 1)), now()) q
      where rt.status = 'active'
        and (rt.return_requested_at is not null or rt.return_at < now())
        and (v_admin or p.provider_id = uid)
    );
  end;
  $$;

  revoke all on function public.list_pending_returns() from public, anon;
  grant execute on function public.list_pending_returns() to authenticated;


  -- ---------------------------------------------------------------------
  -- 4. Owner / admin: confirm the return and settle the deposit
  --    p_handed_at is when the owner actually got the gear back (default:
  --    now). It decides the late fee and the unused-day refund; the renter's
  --    Return gear click does not.
  -- ---------------------------------------------------------------------

  -- Earlier version without p_handed_at; dropped so calls aren't ambiguous.
  drop function if exists public.confirm_rental_return(text, numeric, text);

  create or replace function public.confirm_rental_return(
    p_rental_id text,
    p_damage_charge numeric default 0,
    p_note text default null,
    p_handed_at timestamptz default null
  )
  returns jsonb
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    uid uuid := auth.uid();
    v_admin boolean := public.gearrent_is_admin();
    r record;
    q record;
    v_now timestamptz := now();
    v_handed timestamptz;
    v_note text := nullif(trim(coalesce(p_note, '')), '');
    v_damage numeric := round(coalesce(p_damage_charge, 0), 2);
    v_deposit numeric;
    v_late_kept numeric;
    v_damage_kept numeric;
    v_deposit_refund numeric;
    v_status text;
    v_summary text;
  begin
    if uid is null then
      raise exception 'Please sign in.' using errcode = '42501';
    end if;
    if v_damage < 0 then
      raise exception 'The damage charge cannot be negative.' using errcode = '22023';
    end if;
    if v_damage > 0 and v_note is null then
      raise exception 'Describe the damage so the renter knows why part of the deposit was kept.' using errcode = '22023';
    end if;
    if length(coalesce(v_note, '')) > 500 then
      raise exception 'Keep the note under 500 characters.' using errcode = '22023';
    end if;

    select rt.id, rt.user_id, rt.days, rt.rented_at, rt.return_at, rt.rental_amount, rt.daily_rate,
          rt.security_deposit, rt.status, rt.return_requested_at, p.name, p.provider_id
      into r
      from public.rentals rt
      join public.products p on p.id = rt.product_id
    where rt.id::text = p_rental_id
      for update of rt;

    if not found then
      raise exception 'Rental not found.' using errcode = 'P0002';
    end if;
    if not v_admin and r.provider_id is distinct from uid then
      raise exception 'Only the gear owner or an administrator can confirm this return.' using errcode = '42501';
    end if;
    if r.status is distinct from 'active' then
      raise exception 'This rental has already been closed.' using errcode = 'P0001', hint = 'already_closed';
    end if;
    -- Providers can close a rental the renter never marked as returned once it
    -- is overdue (gear handed back without pressing the button); admins any time.
    if r.return_requested_at is null and not v_admin
       and (r.return_at is null or r.return_at >= v_now) then
      raise exception 'The renter has not returned this gear yet.' using errcode = 'P0001', hint = 'not_requested';
    end if;

    -- A few minutes of browser clock drift are clamped; anything further in
    -- the future, or before the rental started, is rejected.
    v_handed := coalesce(p_handed_at, v_now);
    if v_handed > v_now + interval '5 minutes' then
      raise exception 'The return time cannot be in the future.' using errcode = '22023';
    end if;
    v_handed := least(v_handed, v_now);
    if r.rented_at is not null and v_handed < r.rented_at then
      raise exception 'The return time cannot be before the rental started.' using errcode = '22023';
    end if;

    select * into q from public.gearrent_return_quote(
      r.rented_at, r.return_at, r.days,
      coalesce(r.daily_rate, r.rental_amount / greatest(r.days, 1)), v_handed);

    v_deposit := coalesce(r.security_deposit, 0);
    v_late_kept := least(v_deposit, q.late_fee);
    v_damage_kept := least(v_deposit - v_late_kept, v_damage);
    v_deposit_refund := v_deposit - v_late_kept - v_damage_kept;
    v_status := case when q.unused_days > 0 then 'returned' else 'finished' end;

    -- status is set with literal values (below), not v_status, so this works
    -- whether rentals.status is text or the rental_status enum.
    update public.rentals
      set finished_at = v_handed,
          -- Keep the renter's own click time; finished_at records the handover.
          return_requested_at = coalesce(return_requested_at, v_handed),
          return_confirmed_at = v_now,
          return_confirmed_by = uid,
          late_days = q.late_days,
          late_fee = v_late_kept,
          damage_charge = v_damage_kept,
          return_note = v_note,
          deposit_status = 'refunded',
          deposit_refunded_at = v_now,
          refundable_amount = q.unused_refund + v_deposit_refund
    where id = r.id;

    if v_status = 'returned' then
      update public.rentals set status = 'returned' where id = r.id;
    else
      update public.rentals set status = 'finished' where id = r.id;
    end if;

    -- Record how much of the deposit was kept. Separate literal updates (not a
    -- CASE) so this works whether deposit_status is text or an enum.
    if v_deposit_refund < v_deposit and v_deposit_refund > 0 then
      update public.rentals set deposit_status = 'partially_kept' where id = r.id;
    elsif v_deposit_refund < v_deposit then
      update public.rentals set deposit_status = 'kept' where id = r.id;
    end if;

    -- Renter: unused days (early return) + whatever is left of the deposit.
    perform public.gearrent_apply_balance(r.user_id, q.unused_refund, 'rental_refund', p_rental_id, null,
      q.unused_days || ' unused day(s) of ' || r.name);
    perform public.gearrent_apply_balance(r.user_id, v_deposit_refund, 'deposit_refund', p_rental_id, null,
      'Security deposit for ' || r.name);

    -- Provider: keeps the late fee / damage charge taken from the deposit.
    if r.provider_id is not null then
      perform public.gearrent_apply_balance(r.provider_id, v_late_kept, 'late_fee', p_rental_id, null,
        q.late_days || ' day(s) late: ' || r.name);
      perform public.gearrent_apply_balance(r.provider_id, v_damage_kept, 'damage_charge', p_rental_id, null,
        'Damage: ' || r.name || coalesce(' — ' || v_note, ''));
    end if;

    v_summary := r.name || ' return confirmed. ' || public.gearrent_peso(q.unused_refund + v_deposit_refund)
      || ' was added to your balance';
    if v_late_kept > 0 or v_damage_kept > 0 then
      v_summary := v_summary || ' (' || public.gearrent_peso(v_late_kept + v_damage_kept) || ' kept from your deposit'
        || case when v_late_kept > 0 then ': ' || q.late_days || ' day(s) late' else '' end
        || case when v_damage_kept > 0 then case when v_late_kept > 0 then ', ' else ': ' end || 'damage — ' || v_note else '' end
        || ')';
    end if;
    perform public.gearrent_notify_link(r.user_id, v_summary || '.',
      case when v_late_kept > 0 or v_damage_kept > 0 then 'warning' else 'success' end, false, '/history');

    if r.provider_id is not null and r.provider_id <> uid and (v_late_kept > 0 or v_damage_kept > 0) then
      perform public.gearrent_notify_link(r.provider_id,
        'An administrator confirmed the return of your ' || r.name || '. '
          || public.gearrent_peso(v_late_kept + v_damage_kept) || ' from the deposit was added to your balance.',
        'info', false, '/provider-gear');
    end if;

    perform public.gearrent_notify_link(null,
      r.name || ' return confirmed. Deposit ' || public.gearrent_peso(v_deposit) || ': '
        || public.gearrent_peso(v_deposit_refund) || ' refunded, ' || public.gearrent_peso(v_late_kept + v_damage_kept) || ' kept.',
      'info', true, '/admin/history');

    return jsonb_build_object(
      'rental_id', p_rental_id,
      'status', v_status,
      'handed_at', v_handed,
      'unused_refund', q.unused_refund,
      'deposit_refund', v_deposit_refund,
      'late_days', q.late_days,
      'late_fee', v_late_kept,
      'damage_charge', v_damage_kept,
      -- Damage beyond what was left of the deposit can't be collected here.
      'damage_uncovered', v_damage - v_damage_kept
    );
  end;
  $$;

  revoke all on function public.confirm_rental_return(text, numeric, text, timestamptz) from public, anon;
  grant execute on function public.confirm_rental_return(text, numeric, text, timestamptz) to authenticated;


  -- ---------------------------------------------------------------------
  -- 5. Renters can no longer close rentals themselves
  -- ---------------------------------------------------------------------

  revoke execute on function public.return_rental(text) from public, anon, authenticated;
  revoke execute on function public.finish_rental(text) from public, anon, authenticated;


  -- ---------------------------------------------------------------------
  -- 6. Due alerts: stop once the renter has handed the gear back
  --    (replaces the version from gearrent_notifications_update.sql)
  -- ---------------------------------------------------------------------

  create or replace function public.gearrent_process_due_rentals(p_user uuid)
  returns integer
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    r record;
    created integer := 0;
    v_when text;
    v_hours integer;
  begin
    for r in
      select rt.id, rt.user_id as renter_id, rt.return_at, rt.due_soon_notified_at, rt.overdue_notified_at,
            p.name as product_name, p.provider_id,
            coalesce(nullif(rp.name, ''), 'The renter') as renter_name
        from public.rentals rt
        join public.products p on p.id = rt.product_id
        left join public.profiles rp on rp.id = rt.user_id
      where rt.status = 'active'
        and rt.return_requested_at is null
        and rt.return_at is not null
        and rt.return_at <= now() + interval '24 hours'
        and (p_user is null or rt.user_id = p_user or p.provider_id = p_user)
        and (
          (rt.return_at > now() and rt.due_soon_notified_at is null)
          or (rt.return_at <= now() and rt.overdue_notified_at is null)
        )
      for update of rt skip locked
    loop
      v_when := to_char(r.return_at at time zone 'Asia/Manila', 'Mon DD, HH12:MI AM');

      if r.return_at > now() then
        v_hours := greatest(1, ceil(extract(epoch from (r.return_at - now())) / 3600)::integer);

        perform public.gearrent_notify_link(r.renter_id,
          r.product_name || ' is due back in about ' || v_hours || ' hour' || case when v_hours = 1 then '' else 's' end
            || ' (' || v_when || '). Hand it back to the owner by then to avoid a late fee, and press Return gear in My Gears.',
          'due', false, '/my-gears');

        if r.provider_id is not null and r.provider_id <> r.renter_id then
          perform public.gearrent_notify_link(r.provider_id,
            'Your ' || r.product_name || ' rented by ' || r.renter_name || ' is due back in about ' || v_hours
              || ' hour' || case when v_hours = 1 then '' else 's' end || ' (' || v_when || ').',
            'due', false, '/provider-gear');
        end if;

        update public.rentals set due_soon_notified_at = now() where id = r.id;
      else
        perform public.gearrent_notify_link(r.renter_id,
          r.product_name || ' is overdue — it was due back ' || v_when
            || '. A late fee of one day''s rate per day comes out of your deposit until the owner has it back (after a 1-hour grace period, any part of a day counts as a full day).',
          'overdue', false, '/my-gears');

        if r.provider_id is not null and r.provider_id <> r.renter_id then
          perform public.gearrent_notify_link(r.provider_id,
            'Your ' || r.product_name || ' rented by ' || r.renter_name || ' is overdue (due ' || v_when || '). If you already have it back, confirm the return in Provider Gear.',
            'overdue', false, '/provider-gear');
        end if;

        perform public.gearrent_notify_link(null,
          r.renter_name || ' has not returned ' || r.product_name || ' (due ' || v_when || ').',
          'overdue', true, '/admin/history');

        update public.rentals
          set overdue_notified_at = now(),
              due_soon_notified_at = coalesce(due_soon_notified_at, now())
        where id = r.id;
      end if;

      created := created + 1;
    end loop;

    return created;
  end;
  $$;

  revoke all on function public.gearrent_process_due_rentals(uuid) from public, anon, authenticated;
