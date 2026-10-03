-- =============================================================================
-- supabase_v15_bucket_limits.sql
-- =============================================================================
-- This script restricts the 'inventory-images' bucket so users cannot upload
-- massive files or malicious executable files masquerading as images.

BEGIN;

UPDATE storage.buckets
SET 
  -- Restrict file types to standard images
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  -- Limit file size to 100KB (102400 bytes)
  file_size_limit = 102400
WHERE id = 'inventory-images';

COMMIT;
