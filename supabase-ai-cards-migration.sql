-- ─────────────────────────────────────────────────────────────────────────────
-- AI Card Creator — Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add 'ai-card' as a valid card_type (if you have a check constraint, update it)
--    Most setups just use text, so no change needed for card_type column.

-- 2. Create the card-images storage bucket (for AI-generated images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'card-images',
  'card-images',
  true,           -- public so images are accessible via URL
  10485760,       -- 10 MB max per file
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policy — anyone can read (cards are public links)
CREATE POLICY "Public read card images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'card-images');

-- 4. Storage RLS policy — only authenticated users can upload
CREATE POLICY "Authenticated users can upload card images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'card-images');

-- 5. Storage RLS policy — users can delete their own uploads
CREATE POLICY "Users can delete own card images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'card-images'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification: Check the bucket was created
-- SELECT id, name, public FROM storage.buckets WHERE id = 'card-images';
-- ─────────────────────────────────────────────────────────────────────────────
