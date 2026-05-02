/**
 * add-card.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Add a local image file as a new greeting card template in any category.
 *
 * Usage:
 *   node add-card.mjs <image-path> <title> <category-slug> [subcategory-slug] [accent-color]
 *
 * Examples:
 *   node add-card.mjs ./cards/reminder.png "Just a Reminder" romance thinking-of-you "#C8639A"
 *   node add-card.mjs ./cards/roses.jpg "Red Roses" romance flowers "#E74C3C"
 *   node add-card.mjs ./cards/birthday.png "Happy Birthday" birthday "" "#FF6B35"
 *
 * Category slugs:    romance | morning-wishes | birthday | occasions | holidays | thank-you | invitations | vibes
 * Romance subcats:   flowers | miss-you | thinking-of-you | good-night
 */

import { createClient }  from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, extname, basename } from "path";

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] = process.env[key] ?? val;
    }
  } catch {}
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Args ─────────────────────────────────────────────────────────────────────
const [,, imagePath, title, categorySlug, subcategorySlug = "", accentColor = "#FF6B8A"] = process.argv;

if (!imagePath || !title || !categorySlug) {
  console.log(`
Usage:
  node add-card.mjs <image-path> <title> <category-slug> [subcategory-slug] [accent-color]

Example:
  node add-card.mjs ./reminder.png "Just a Reminder" romance thinking-of-you "#C8639A"
`);
  process.exit(1);
}

const fullPath = resolve(process.cwd(), imagePath);
if (!existsSync(fullPath)) {
  console.error(`❌  File not found: ${fullPath}`);
  process.exit(1);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📸  Adding card: "${title}" → ${categorySlug}${subcategorySlug ? "/" + subcategorySlug : ""}\n`);

  // 1. Look up category
  const { data: cat, error: catErr } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", categorySlug)
    .single();

  if (catErr || !cat) {
    console.error(`❌  Category not found: "${categorySlug}"`);
    console.error("    Valid slugs:", "romance | morning-wishes | birthday | occasions | holidays | thank-you | invitations | vibes");
    process.exit(1);
  }

  // 2. Look up subcategory (optional)
  let subcatId = null;
  if (subcategorySlug) {
    const { data: subcat } = await supabase
      .from("subcategories")
      .select("id")
      .eq("slug", subcategorySlug)
      .eq("category_id", cat.id)
      .single();

    if (!subcat) {
      console.warn(`⚠️   Subcategory "${subcategorySlug}" not found under "${categorySlug}" — card will be added without subcategory`);
    } else {
      subcatId = subcat.id;
    }
  }

  // 3. Generate a unique slug from title + timestamp
  const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const slug = `t-custom-${slugBase}-${Date.now()}`;

  // 4. Determine next display_order
  const { data: existing } = await supabase
    .from("templates")
    .select("display_order")
    .eq("category_id", cat.id)
    .order("display_order", { ascending: false })
    .limit(1);

  const nextOrder = existing?.[0]?.display_order != null ? existing[0].display_order + 1 : 1;

  // 5. Upload image to Supabase Storage
  const ext       = extname(imagePath).toLowerCase() || ".jpg";
  const storagePath = `templates/${slug}${ext}`;
  const mimeMap   = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
  const contentType = mimeMap[ext] ?? "image/jpeg";

  console.log(`⬆️   Uploading image to card-images/${storagePath} …`);
  const imageBuffer = readFileSync(fullPath);

  const { error: uploadErr } = await supabase.storage
    .from("card-images")
    .upload(storagePath, imageBuffer, { contentType, upsert: true });

  if (uploadErr) {
    console.error("❌  Upload failed:", uploadErr.message);
    process.exit(1);
  }

  // 6. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("card-images")
    .getPublicUrl(storagePath);

  console.log(`✅  Image uploaded: ${publicUrl}`);

  // 7. Insert template record
  const { data: template, error: insertErr } = await supabase
    .from("templates")
    .insert({
      category_id:      cat.id,
      subcategory_id:   subcatId,
      title,
      front_image_url:  publicUrl,
      color_accent:     accentColor,
      display_order:    nextOrder,
      is_active:        true,
    })
    .select()
    .single();

  if (insertErr) {
    console.error("❌  DB insert failed:", insertErr.message);
    process.exit(1);
  }

  console.log(`\n🎉  Card added successfully!`);
  console.log(`    ID:            ${template.id}`);
  console.log(`    Title:         ${template.title}`);
  console.log(`    Category:      ${categorySlug}${subcatId ? " / " + subcategorySlug : ""}`);
  console.log(`    Display order: ${nextOrder}`);
  console.log(`    Image URL:     ${publicUrl}`);
  console.log(`\n    View it at: /category/${categorySlug}\n`);
}

main().catch(err => { console.error("❌ Unexpected error:", err); process.exit(1); });
