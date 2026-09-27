-- Run this in the Supabase SQL Editor (after the existing schema files).
-- Creates the "gear-images" storage bucket used by the drag & drop
-- upload widget in AdminAddEquipment and ProviderGear, and the RLS
-- policies that let signed-in users upload photos and let anyone
-- (including logged-out visitors browsing the catalog) view them.

-- 1. Create the public bucket (id must be exactly 'gear-images' to match
--    src/components/ImageDropzone.jsx).
insert into storage.buckets (id, name, public)
values ('gear-images', 'gear-images', true)
on conflict (id) do nothing;

-- 2. Anyone can view/download images (needed so product photos render
--    in the public catalog for logged-out visitors).
create policy "Public read access on gear-images"
on storage.objects for select
using (bucket_id = 'gear-images');

-- 3. Only authenticated users can upload, and only into a folder that
--    starts with their own user id (matches the `products/${user.id}`
--    folder the app uploads into) — so one user can't overwrite
--    another user's files.
create policy "Authenticated users can upload their own gear images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'gear-images'
  and (storage.foldername(name))[1] = 'products'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- 4. Let users delete/replace their own uploads.
create policy "Users can manage their own gear images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'gear-images'
  and (storage.foldername(name))[1] = 'products'
  and (storage.foldername(name))[2] = auth.uid()::text
);
