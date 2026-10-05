import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ALLOWED_IMAGE_TYPES, IMAGE_BUCKET, MAX_IMAGE_BYTES, removeStoredImages } from '../lib/imageStorage';
import Icon from './Icon';
import './ImageDropzone.css';

const BUCKET = IMAGE_BUCKET;
const MAX_FILE_BYTES = MAX_IMAGE_BYTES;

const EXTENSION_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', pjpeg: 'image/jpeg',
  png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
};

// Windows often reports an empty (or odd) MIME type for dragged files, so fall
// back to the extension before deciding a photo isn't allowed.
function imageTypeOf(file) {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return EXTENSION_TYPES[extension] || null;
}

// Turns a Storage error into something the user (or whoever set up the
// Supabase project) can act on, instead of a generic "upload failed".
function describeUploadError(error) {
  const text = `${error?.message || ''} ${error?.error || ''} ${error?.statusCode || ''}`;
  if (/bucket not found/i.test(text)) {
    return 'The "gear-images" storage bucket does not exist yet. Run gearrent_supabase_storage_setup.sql in Supabase.';
  }
  if (/row-level security|row level security|unauthorized|403/i.test(text)) {
    return 'Storage refused the upload (permissions). Sign out and back in; if it keeps happening, check the gear-images storage policies.';
  }
  if (/mime|content type|not supported/i.test(text)) {
    return 'Storage does not accept this file type. Use JPG, PNG, WebP, GIF or AVIF.';
  }
  if (/maximum allowed size|too large|payload/i.test(text)) {
    return 'The photo is larger than storage allows (8MB).';
  }
  if (/failed to fetch|network/i.test(text)) {
    return 'Upload failed. Please check your connection and try again.';
  }
  return error?.message ? `Upload failed: ${error.message}` : 'Upload failed. Please try again.';
}

function randomId() {
  return (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

async function uploadToStorage(file, folder) {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${folder}/${randomId()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: imageTypeOf(file) || 'image/jpeg',
  });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Drag-and-drop (or click-to-browse) image uploader. Files are uploaded
 * straight to Supabase Storage and the resulting public URLs are handed
 * back via onChange — no manual URL typing, no hardcoded image data.
 *
 * value: string[] of image URLs already attached
 * onChange: (nextUrls: string[]) => void
 * folder: storage path prefix, e.g. `products/${userId}`
 */
export default function ImageDropzone({ value = [], onChange, folder, maxFiles = 8, label = 'Drag photos here' }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const dragCounter = useRef(0);

  // A drop that misses the box would make the browser open the image and
  // throw away the half-filled form, so swallow stray file drops on the page.
  useEffect(() => {
    const blockStrayDrop = (event) => {
      if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', blockStrayDrop);
    window.addEventListener('drop', blockStrayDrop);
    return () => {
      window.removeEventListener('dragover', blockStrayDrop);
      window.removeEventListener('drop', blockStrayDrop);
    };
  }, []);

  const acceptFiles = useCallback(async (fileList) => {
    setError('');
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const room = Math.max(0, maxFiles - value.length);
    if (!room) {
      setError(`You can attach up to ${maxFiles} photos.`);
      return;
    }

    const validFiles = [];
    for (const file of incoming.slice(0, room)) {
      if (!imageTypeOf(file)) {
        setError('Only JPG, PNG, WebP, GIF or AVIF photos are accepted.');
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError('Each photo must be under 8MB.');
        continue;
      }
      validFiles.push(file);
    }
    if (!validFiles.length) return;

    setIsUploading(true);
    // Keep whatever uploaded successfully even if some files fail.
    const results = await Promise.allSettled(validFiles.map((file) => uploadToStorage(file, folder)));
    setIsUploading(false);
    const uploadedUrls = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const failures = results.filter((result) => result.status === 'rejected');
    if (uploadedUrls.length) onChange([...value, ...uploadedUrls]);
    if (failures.length) {
      failures.forEach((failure) => console.error('Image upload failed', failure.reason));
      const reason = describeUploadError(failures[0].reason);
      setError(failures.length === results.length
        ? reason
        : `${failures.length} of ${results.length} photos failed to upload. ${reason}`);
    }
  }, [value, onChange, folder, maxFiles]);

  const handleDragEnter = (event) => {
    event.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (isUploading) return;
    // Images dragged out of a web page or the Photos app arrive as links,
    // not files, so there's nothing we can upload.
    if (!event.dataTransfer.files?.length) {
      setError('That drop had no photo file. Drag the image file from your computer\'s folders, or click to browse.');
      return;
    }
    acceptFiles(event.dataTransfer.files);
  };

  const handleBrowse = (event) => {
    acceptFiles(event.target.files);
    event.target.value = '';
  };

  // These photos aren't attached to a saved listing yet, so removing one
  // also deletes the file from Storage instead of leaving it orphaned.
  const removeImage = (urlToRemove) => {
    onChange(value.filter((url) => url !== urlToRemove));
    removeStoredImages([urlToRemove], folder);
  };

  return (
    <div className="image-dropzone-wrap">
      <div
        className={`image-dropzone ${isDragging ? 'is-dragging' : ''} ${isUploading ? 'is-uploading' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="Upload gear photos by dragging them here or clicking to browse"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          multiple
          className="image-dropzone-input"
          onChange={handleBrowse}
        />
        <span className="image-dropzone-icon" aria-hidden="true"><Icon name={isUploading ? 'loader' : 'upload'} /></span>
        <span className="image-dropzone-label">{isUploading ? 'Uploading…' : label}</span>
        <span className="image-dropzone-hint">or click to browse · JPG, PNG, WebP up to 8MB</span>
      </div>

      {error && <p className="image-dropzone-error" role="alert">{error}</p>}

      {value.length > 0 && (
        <div className="image-dropzone-grid">
          {value.map((url, index) => (
            <div className="image-dropzone-thumb" key={url}>
              <img src={url} alt={`Upload ${index + 1}`} />
              {index === 0 && <span className="image-dropzone-primary">Cover</span>}
              <button
                type="button"
                className="image-dropzone-remove"
                onClick={(event) => { event.stopPropagation(); removeImage(url); }}
                aria-label={`Remove photo ${index + 1}`}
              >
                <Icon name="close" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
