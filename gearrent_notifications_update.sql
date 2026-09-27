-- =====================================================================
-- GearRent — notification toasts, due-rental alerts, image rules
-- Run in the Supabase SQL Editor AFTER gearrent_payments_update.sql.
-- Idempotent: safe to run more than once.
--
--   1. notifications.link — where a toast / notification should take you
--   2. Admin "awaiting review" notifications link to the Approvals page
--   3. gearrent_check_due_rentals() — creates "due soon" (24h before) and
--      "overdue" notifications for the renter AND the provider, once each
--   4. Image rules — uploads limited to real image types / 8MB in Storage,
--      and non-admin listings may only use photos from their own folder in
--      the gear-images bucket
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Link column + helper
-- ---------------------------------------------------------------------

alter table public.notifications add column if not exists link text;

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
  insert into public.notifications (message, type, recipient_user_id, is_admin_channel, link)
  values (p_message, p_type, case when p_admin then null else p_user end, p_admin, p_link);
exception when others then
  null; -- notifications are best-effort
end;
$$;

revoke all on function public.gearrent_notify_link(uuid, text, text, boolean, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 2. "Awaiting review" → Approvals page (replaces the version from
--    gearrent_security_update.sql; same trigger, now with a link)
-- ---------------------------------------------------------------------

create or replace function public.gearrent_notify_pending_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider text;
begin
  if new.approval_status = 'pending'
     and (tg_op = 'INSERT' or old.approval_status is distinct from 'pending') then
    select coalesce(nullif(name, ''), email, 'A provider') into v_provider
      from public.profiles where id = new.provider_id;
    perform public.gearrent_notify_link(
      null,
      coalesce(v_provider, 'A provider') || ' submitted "' || coalesce(new.name, 'Untitled gear')
        || '" — awaiting review.',
      'review',
      true,
      '/admin/approvals'
    );
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Due-rental alerts
-- ---------------------------------------------------------------------

alter table public.rentals add column if not exists due_soon_notified_at timestamptz;
alter table public.rentals add column if not exists overdue_notified_at timestamptz;

create index if not exists rentals_active_return_idx
  on public.rentals (return_at) where status = 'active';

-- Shared worker. p_user = null processes every active rental (for pg_cron);
-- otherwise only rentals where p_user is the renter or the provider.
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
          || ' (' || v_when || '). Return it or mark it finished in My Gears.',
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
        r.product_name || ' is overdue — it was due back ' || v_when || '. Please return it as soon as possible.',
        'overdue', false, '/my-gears');

      if r.provider_id is not null and r.provider_id <> r.renter_id then
        perform public.gearrent_notify_link(r.provider_id,
          'Your ' || r.product_name || ' rented by ' || r.renter_name || ' is overdue (due ' || v_when || ').',
          'overdue', false, '/provider-gear');
      end if;

      perform public.gearrent_notify_link(null,
        r.renter_name || ' has not returned ' || r.product_name || ' (due ' || v_when || ').',
        'overdue', true, '/admin/history');

      -- An overdue rental never gets a late "due soon" alert afterwards.
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

-- Called by the app on each notification poll for the signed-in user.
create or replace function public.gearrent_check_due_rentals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return 0;
  end if;
  return public.gearrent_process_due_rentals(auth.uid());
end;
$$;

grant execute on function public.gearrent_check_due_rentals() to authenticated;

-- OPTIONAL — alerts even when nobody has the app open. Enable the pg_cron
-- extension (Database → Extensions), then run once:
--   select cron.schedule('gearrent-due-rentals', '*/15 * * * *',
--                        $$select public.gearrent_process_due_rentals(null)$$);


-- ---------------------------------------------------------------------
-- 4. Image rules
-- ---------------------------------------------------------------------

-- Storage enforces type and size on upload (SVG is excluded: it can carry
-- scripts and the bucket is public).
update storage.buckets
   set file_size_limit = 8 * 1024 * 1024,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
 where id = 'gear-images';

-- Listings from non-admins may only reference photos uploaded to their own
-- folder in the gear-images bucket (what the app's uploader produces).
create or replace function public.gearrent_guard_product_images()
returns trigger
language plpgsql
as $$
declare
  url text;
  own_prefix text;
begin
  if auth.uid() is null or public.gearrent_is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' and to_jsonb(new.images) is not distinct from to_jsonb(old.images) then
    return new;
  end if;

  if new.images is null or jsonb_array_length(to_jsonb(new.images)) = 0 then
    raise exception 'Add at least one photo of the gear.' using errcode = '22023';
  end if;
  if jsonb_array_length(to_jsonb(new.images)) > 8 then
    raise exception 'A listing can have at most 8 photos.' using errcode = '22023';
  end if;

  own_prefix := '/storage/v1/object/public/gear-images/products/' || auth.uid()::text || '/';
  for url in select jsonb_array_elements_text(to_jsonb(new.images)) loop
    if url not like 'https://%' or position(own_prefix in url) = 0 then
      raise exception 'Photos must be uploaded with the GearRent uploader.' using errcode = '22023';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists gearrent_guard_product_images on public.products;
create trigger gearrent_guard_product_images
  before insert or update on public.products
  for each row execute function public.gearrent_guard_product_images();
