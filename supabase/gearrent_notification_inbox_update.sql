-- Gear Rent: notifications that stay cleared and remember what was read.
-- Run in the Supabase SQL Editor AFTER gearrent_security_update.sql.
-- Safe to run more than once.
--
-- The site used to clear and mark notifications read by writing to the
-- notifications table directly. If the table's policies don't allow that,
-- Supabase skips it without an error, so cleared notifications came back
-- on the next refresh and nothing stayed "read". Notifications sent to
-- everyone (no recipient) were never cleared at all.
--
-- These functions do the work in the database instead:
--   list_my_notifications()       the signed-in member's bell, with `read`
--   mark_my_notifications_read()  everything up to now counts as read
--   clear_my_notifications()      deletes their own, hides shared ones for them
--   admin_mark_notifications_read() / admin_clear_notifications()
-- Shared notifications are only hidden for the person who cleared them,
-- using two timestamps on their profile.

alter table public.profiles add column if not exists notifications_read_at timestamptz;
alter table public.profiles add column if not exists notifications_cleared_at timestamptz;


-- ---------------------------------------------------------------------
-- Member bell
-- ---------------------------------------------------------------------

create or replace function public.list_my_notifications(p_limit integer default 30)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(n) || jsonb_build_object(
           'read',
           coalesce(n.read, false)
             or (n.recipient_user_id is null
                 and p.notifications_read_at is not null
                 and n.created_at <= p.notifications_read_at)
         )
    from public.notifications n
    join public.profiles p on p.id = auth.uid()
   where coalesce(n.is_admin_channel, false) = false
     and (
       n.recipient_user_id = auth.uid()
       or (n.recipient_user_id is null
           and (p.notifications_cleared_at is null or n.created_at > p.notifications_cleared_at))
     )
   order by n.created_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

create or replace function public.mark_my_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  update public.notifications
     set read = true
   where recipient_user_id = auth.uid()
     and coalesce(is_admin_channel, false) = false
     and coalesce(read, false) = false;
  update public.profiles set notifications_read_at = now() where id = auth.uid();
end;
$$;

create or replace function public.clear_my_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  delete from public.notifications
   where recipient_user_id = auth.uid()
     and coalesce(is_admin_channel, false) = false;
  update public.profiles
     set notifications_cleared_at = now(),
         notifications_read_at = now()
   where id = auth.uid();
end;
$$;


-- ---------------------------------------------------------------------
-- Admin bell (one shared inbox for all administrators)
-- ---------------------------------------------------------------------

create or replace function public.admin_mark_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.gearrent_is_admin() then
    raise exception 'Only administrators can do this.' using errcode = '42501';
  end if;
  update public.notifications
     set read = true
   where is_admin_channel = true
     and coalesce(read, false) = false;
end;
$$;

create or replace function public.admin_clear_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.gearrent_is_admin() then
    raise exception 'Only administrators can do this.' using errcode = '42501';
  end if;
  delete from public.notifications where is_admin_channel = true;
end;
$$;

revoke all on function public.list_my_notifications(integer) from public, anon;
revoke all on function public.mark_my_notifications_read() from public, anon;
revoke all on function public.clear_my_notifications() from public, anon;
revoke all on function public.admin_mark_notifications_read() from public, anon;
revoke all on function public.admin_clear_notifications() from public, anon;

grant execute on function public.list_my_notifications(integer) to authenticated;
grant execute on function public.mark_my_notifications_read() to authenticated;
grant execute on function public.clear_my_notifications() to authenticated;
grant execute on function public.admin_mark_notifications_read() to authenticated;
grant execute on function public.admin_clear_notifications() to authenticated;
