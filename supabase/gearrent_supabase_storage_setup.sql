-- Run this in the Supabase SQL Editor (after the existing schema files).
-- Creates the "gear-images" storage bucket used by the drag & drop
-- upload widget (Admin → Add Equipment, Admin → Categories, Provider Gear),
-- and the RLS policies that let signed-in users upload photos and let
-- anyone (including logged-out visitors browsing the catalog) view them.
-- Idempotent: safe to run more than once.

-- 1. Create the public bucket (id must be exactly 'gear-images' to match
--    src/lib/imageStorage.js). Limits match MAX_IMAGE_BYTES and
--    ALLOWED_IMAGE_TYPES there (SVG is excluded: it can carry scripts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gear-images', 'gear-images', true, 8 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2. Anyone can view/download images (needed so product photos render
--    in the public catalog for logged-out visitors).
drop policy if exists "Public read access on gear-images" on storage.objects;
create policy "Public read access on gear-images"
on storage.objects for select
using (bucket_id = 'gear-images');

-- 3. Only authenticated users can upload, and only into a folder that
--    starts with their own user id (matches the `products/${user.id}`
--    folder the app uploads into) — so one user can't overwrite
--    another user's files.
drop policy if exists "Authenticated users can upload their own gear images" on storage.objects;
create policy "Authenticated users can upload their own gear images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'gear-images'
  and (storage.foldername(name))[1] = 'products'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- 4. Let users delete/replace their own uploads.
drop policy if exists "Users can manage their own gear images" on storage.objects;
create policy "Users can manage their own gear images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'gear-images'
  and (storage.foldername(name))[1] = 'products'
  and (storage.foldername(name))[2] = auth.uid()::text
);
