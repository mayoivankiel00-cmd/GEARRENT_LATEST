-- =====================================================================
-- GearRent — categories live in the database
-- Run in the Supabase SQL Editor AFTER gearrent_security_update.sql.
-- Idempotent: safe to run more than once.
--
-- The app used to read the category list (name, tagline, cover image) from
-- src/mockData.js. It now reads public.categories, and admins manage it on
-- Admin → Categories.
--   * adds name / tagline / image / sort_order to categories if missing
--   * fills them in for the five original categories (existing values win)
--   * everyone can read categories; only admins can add, edit or delete
--   * a category that still has products can't be deleted
-- =====================================================================

create table if not exists public.categories (
  id text primary key,
  name text not null
);

alter table public.categories add column if not exists name text;
alter table public.categories add column if not exists tagline text;
alter table public.categories add column if not exists image text;
alter table public.categories add column if not exists sort_order integer not null default 0;


-- The five original categories (same content the app had in mockData.js).
with seed (id, name, tagline, image, sort_order) as (
  values
    ('cameras',  'Cameras',        'Cinema, Mirrorless, DSLR & Action',
     'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=85', 1),
    ('lighting', 'Lighting',       'LED, Strobes & Grip',
     'https://waldo.pro/wp-content/uploads/2024/03/Lighting-Equipment-1-564x317.jpg', 2),
    ('audio',    'Audio',          'Mics, Mixers & Wireless',
     'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?auto=format&fit=crop&w=1200&q=85', 3),
    ('camping',  'Camping Gear',   'Tents, Sleeping Bags & Cooking',
     'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=85', 4),
    ('events',   'Event Supplies', 'Tables, Chairs & Decor',
     'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=85', 5)
)
update public.categories c
   set name = coalesce(nullif(c.name, ''), s.name),
       tagline = coalesce(nullif(c.tagline, ''), s.tagline),
       image = coalesce(nullif(c.image, ''), s.image),
       sort_order = case when c.sort_order = 0 then s.sort_order else c.sort_order end
  from seed s
 where c.id = s.id;

with seed (id, name, tagline, image, sort_order) as (
  values
    ('cameras',  'Cameras',        'Cinema, Mirrorless, DSLR & Action',
     'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=85', 1),
    ('lighting', 'Lighting',       'LED, Strobes & Grip',
     'https://waldo.pro/wp-content/uploads/2024/03/Lighting-Equipment-1-564x317.jpg', 2),
    ('audio',    'Audio',          'Mics, Mixers & Wireless',
     'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?auto=format&fit=crop&w=1200&q=85', 3),
    ('camping',  'Camping Gear',   'Tents, Sleeping Bags & Cooking',
     'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1200&q=85', 4),
    ('events',   'Event Supplies', 'Tables, Chairs & Decor',
     'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=85', 5)
)
insert into public.categories (id, name, tagline, image, sort_order)
select s.id, s.name, s.tagline, s.image, s.sort_order
  from seed s
 where not exists (select 1 from public.categories c where c.id = s.id);


-- ---------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------

alter table public.categories enable row level security;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

drop policy if exists "Anyone can read categories" on public.categories;
create policy "Anyone can read categories"
  on public.categories for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories"
  on public.categories for all
  to authenticated
  using ((select public.gearrent_is_admin()))
  with check ((select public.gearrent_is_admin()));

drop policy if exists "gearrent_active_session_required" on public.categories;
create policy "gearrent_active_session_required"
  on public.categories
  as restrictive for all to authenticated
  using ((select public.gearrent_session_active()))
  with check ((select public.gearrent_session_active()));


-- ---------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------

create or replace function public.gearrent_guard_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if tg_op = 'DELETE' then
    select count(*) into v_count from public.products where category_id = old.id;
    if v_count > 0 then
      raise exception '% still has % product(s). Move them to another category first.', old.name, v_count
        using errcode = '23503';
    end if;
    return old;
  end if;

  new.name := trim(coalesce(new.name, ''));
  if new.name = '' then
    raise exception 'A category needs a name.' using errcode = '22023';
  end if;
  if new.id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Category ids may only use lowercase letters, numbers and dashes.' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception 'A category id cannot be changed; products refer to it.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists gearrent_guard_category on public.categories;
create trigger gearrent_guard_category
  before insert or update or delete on public.categories
  for each row execute function public.gearrent_guard_category();
