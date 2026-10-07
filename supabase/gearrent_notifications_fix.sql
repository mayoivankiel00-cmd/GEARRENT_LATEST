-- Gear Rent: make database notifications actually arrive.
-- Run in the Supabase SQL Editor AFTER gearrent_notifications_update.sql
-- (and gearrent_security_update.sql). Safe to run more than once.
--
-- Every notification the database sends (a renter paid for your gear, hand
-- it over, returns, approvals...) goes through gearrent_notify() or
-- gearrent_notify_link(). Both silently threw away any error, so if the
-- insert failed the person simply got nothing. Providers noticed first
-- because their notifications ("someone rented your gear", "your gear was
-- approved") come only from these helpers.
--
-- This file:
--   1. gives both helpers one shared sender that retries the common
--      failures (a `type` the table doesn't allow -> 'info'; no `link`
--      column -> without the link) and, if it still fails, writes the real
--      error to public.gearrent_notification_errors instead of dropping it;
--   2. makes admin_review_product() use it, link to Provider Gear, and
--      return the reason when the provider couldn't be notified.
--
-- If a notification still doesn't arrive, look here for the reason:
--   select * from public.gearrent_notification_errors order by created_at desc;


-- ---------------------------------------------------------------------
-- 1. Shared sender
-- ---------------------------------------------------------------------

alter table public.notifications add column if not exists link text;

-- Failures land here. RLS is on with no policies, so only the SQL editor
-- (and the functions below) can read or write it.
create table if not exists public.gearrent_notification_errors (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  recipient_user_id uuid,
  is_admin_channel boolean,
  message text,
  error text
);
alter table public.gearrent_notification_errors enable row level security;

-- Saves one notification. Returns null when it was saved, otherwise the
-- database's reason (which is also logged).
create or replace function public.gearrent_send_notification(
  p_user uuid,
  p_message text,
  p_type text,
  p_admin boolean,
  p_link text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := case when p_admin then null else p_user end;
  v_type text := coalesce(p_type, 'info');
  v_error text;
begin
  -- First try exactly as asked, then the usual fallbacks.
  for attempt in 1..3 loop
    begin
      if attempt = 3 then
        insert into public.notifications (message, type, recipient_user_id, is_admin_channel)
        values (p_message, 'info', v_user, coalesce(p_admin, false));
      else
        insert into public.notifications (message, type, recipient_user_id, is_admin_channel, link)
        values (p_message, case when attempt = 1 then v_type else 'info' end, v_user, coalesce(p_admin, false), p_link);
      end if;
      return null;
    exception when others then
      v_error := sqlerrm;
    end;
  end loop;

  begin
    insert into public.gearrent_notification_errors (recipient_user_id, is_admin_channel, message, error)
    values (v_user, coalesce(p_admin, false), p_message, v_error);
  exception when others then
    null; -- never let logging break a payment or a review
  end;
  return v_error;
end;
$$;

revoke all on function public.gearrent_send_notification(uuid, text, text, boolean, text) from public, anon, authenticated;

-- Same signatures as before, so checkout, handovers, returns and the rest
-- pick this up without being changed.
create or replace function public.gearrent_notify(p_user uuid, p_message text, p_type text, p_admin boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.gearrent_send_notification(p_user, p_message, p_type, p_admin, null);
end;
$$;

revoke all on function public.gearrent_notify(uuid, text, text, boolean) from public, anon, authenticated;

create or replace function public.gearrent_notify_link(
  p_user uuid,
  p_message text,
  p_type text,
  p_admin boolean,
  p_link text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.gearrent_send_notification(p_user, p_message, p_type, p_admin, p_link);
end;
$$;

revoke all on function public.gearrent_notify_link(uuid, text, text, boolean, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. Approvals tell the provider (and the admin, if that fails)
-- ---------------------------------------------------------------------

-- The return type changes (void -> text), so the old version has to go first.
drop function if exists public.admin_review_product(text, text, text);

create function public.admin_review_product(p_product_id text, p_decision text, p_note text default null)
returns text
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
  returning provider_id, coalesce(nullif(trim(name), ''), 'Your gear') into v_provider, v_name;

  if not found then
    raise exception 'Listing not found.' using errcode = 'P0002';
  end if;

  -- Gear Rent's own listings have no provider to tell.
  if v_provider is null then
    return null;
  end if;

  -- null when sent, otherwise the reason (shown to the admin).
  return public.gearrent_send_notification(
    v_provider,
    case when p_decision = 'approved'
      then '"' || v_name || '" was approved and is now live in the catalog.'
      else '"' || v_name || '" was not approved: ' || trim(p_note)
    end,
    case when p_decision = 'approved' then 'success' else 'warning' end,
    false,
    '/provider-gear?tab=listings'
  );
end;
$$;

grant execute on function public.admin_review_product(text, text, text) to authenticated;
