-- Gear Rent: renters keep seeing the gear they rented.
-- Run in the Supabase SQL Editor AFTER gearrent_security_update.sql.
-- Safe to run more than once.
--
-- Listings that aren't approved are hidden from everyone but their owner
-- and admins. Editing an approved listing sends it back to "pending", so a
-- renter who had rented that gear suddenly couldn't load it, and the rental
-- vanished from My History (and My Gears). This keeps the approval rule for
-- the catalog but also lets a renter see any listing they have rented.

-- security definer so this check reads rentals without going through the
-- rentals policies (avoids policies on the two tables referring to each
-- other in a loop).
create or replace function public.gearrent_has_rented(p_product_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.rentals r
     where r.user_id = auth.uid()
       and r.product_id::text = p_product_id
  );
$$;

-- Signed-out visitors need to run it too: the products policy below applies
-- to them, and Postgres doesn't always skip the check once the listing is
-- approved. Without this the catalog failed with "permission denied for
-- function gearrent_has_rented". It returns false when nobody is signed in.
revoke all on function public.gearrent_has_rented(text) from public;
grant execute on function public.gearrent_has_rented(text) to anon, authenticated;

create index if not exists rentals_user_product_idx on public.rentals (user_id, product_id);

-- Same rule as gearrent_security_update.sql, plus "you rented it".
drop policy if exists "gearrent_products_visible_when_approved" on public.products;
create policy "gearrent_products_visible_when_approved"
  on public.products
  as restrictive
  for select
  using (
    approval_status = 'approved'
    or provider_id = auth.uid()
    or (select public.gearrent_is_admin())
    or public.gearrent_has_rented(id::text)
  );
