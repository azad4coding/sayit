-- ============================================================
--  SayIt — Seed Patch
--  Run this in Supabase Dashboard → SQL Editor BEFORE running
--  the seed-templates.mjs script.
-- ============================================================

-- Add unique constraint on subcategories.slug (needed for upsert)
ALTER TABLE public.subcategories
  ADD CONSTRAINT IF NOT EXISTS subcategories_slug_key UNIQUE (slug);

-- Add unique constraint on templates.front_image_url (needed for upsert idempotency)
-- If this is too broad, you can remove it and let the script INSERT only
ALTER TABLE public.templates
  ADD CONSTRAINT IF NOT EXISTS templates_slug_key UNIQUE (title, category_id);

-- Allow service role to insert/update all tables used by the seeder
CREATE POLICY IF NOT EXISTS "Service role can manage subcategories"
  ON public.subcategories FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "Service role can manage templates"
  ON public.templates FOR ALL USING (auth.role() = 'service_role');
