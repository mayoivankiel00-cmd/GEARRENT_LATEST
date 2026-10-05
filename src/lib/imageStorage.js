import { supabase } from './supabaseClient';

// Photos live in the public `gear-images` Storage bucket; the products table
// stores only their public URLs (products.images).
export const IMAGE_BUCKET = 'gear-images';
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // must match storage.buckets.file_size_limit
// SVG is deliberately excluded (it can contain scripts). Must match
// storage.buckets.allowed_mime_types in gearrent_notifications_update.sql.
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

const PUBLIC_MARKER = `/storage/v1/object/public/${IMAGE_BUCKET}/`;

// Public URL → path inside the bucket (or null if it isn't one of ours).
export function storagePathFromUrl(url) {
  if (typeof url !== 'string') return null;
  const index = url.indexOf(PUBLIC_MARKER);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + PUBLIC_MARKER.length).split('?')[0]);
}

// Deletes our own uploaded files. Only paths inside `ownFolder` are touched —
// Storage policies would refuse anything else anyway.
export async function removeStoredImages(urls, ownFolder) {
  const paths = (urls || [])
    .map(storagePathFromUrl)
    .filter((path) => path && (!ownFolder || path.startsWith(`${ownFolder}/`)));
  if (!paths.length) return;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths);
  if (error) console.error('Failed to remove stored images', error);
}
