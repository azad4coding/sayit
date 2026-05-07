/**
 * seed-templates.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates DALL-E 3 images for every greeting card template, uploads them to
 * Supabase Storage, and seeds the categories / subcategories / templates tables.
 *
 * Run ONCE from your project root:
 *   node seed-templates.mjs
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      process.env[key] = process.env[key] ?? val;
    }
  } catch { /* .env.local not found — rely on real env vars */ }
}
loadEnv();

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_API_KEY) {
  console.error("❌  Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { slug: "romance",        name: "Romance",        icon: "❤️",  gradient_from: "#FF6B8A", gradient_to: "#FF8FA3", display_order: 1, is_hero: true },
  { slug: "paw-moments",    name: "Paw Moments",    icon: "🐾",  gradient_from: "#9B59B6", gradient_to: "#C39BD3", display_order: 2, is_hero: true },
  { slug: "morning-wishes", name: "Morning Wishes", icon: "☀️",  gradient_from: "#F39C12", gradient_to: "#F7DC6F", display_order: 3, is_hero: false },
  { slug: "birthday",       name: "Birthday",       icon: "🎂",  gradient_from: "#FF6B35", gradient_to: "#FFB347", display_order: 4, is_hero: false },
  { slug: "occasions",      name: "Occasions",      icon: "🎉",  gradient_from: "#11998E", gradient_to: "#38EF7D", display_order: 5, is_hero: false },
  { slug: "holidays",       name: "Holidays",       icon: "🎁",  gradient_from: "#C0392B", gradient_to: "#E74C3C", display_order: 6, is_hero: false },
  { slug: "thank-you",      name: "Thank You",      icon: "🙏",  gradient_from: "#F5A623", gradient_to: "#E8722A", display_order: 7, is_hero: false },
  { slug: "invitations",    name: "Invitations",    icon: "💌",  gradient_from: "#8E44AD", gradient_to: "#C0392B", display_order: 8, is_hero: false },
  { slug: "vibes",          name: "Vibes",          icon: "✨",  gradient_from: "#FF1493", gradient_to: "#FF6B00", display_order: 9, is_hero: true },
];

// ── Subcategories (slug → parent slug) ──────────────────────────────────────
const SUBCATEGORIES = [
  { slug: "flowers",         category_slug: "romance",        name: "Flowers",          icon: "🌹", display_order: 1 },
  { slug: "miss-you",        category_slug: "romance",        name: "Miss You",         icon: "💌", display_order: 2 },
  { slug: "thinking-of-you", category_slug: "romance",        name: "Thinking of You",  icon: "💭", display_order: 3 },
  { slug: "good-night",      category_slug: "romance",        name: "Good Night",       icon: "🌙", display_order: 4 },
  { slug: "good-morning",    category_slug: "morning-wishes", name: "Good Morning",     icon: "🌅", display_order: 1 },
  { slug: "motivation",      category_slug: "morning-wishes", name: "Motivation",       icon: "🔥", display_order: 2 },
  { slug: "weekend-vibes",   category_slug: "morning-wishes", name: "Weekend Vibes",    icon: "🎉", display_order: 3 },
  { slug: "general-thanks",  category_slug: "thank-you",      name: "General",          icon: "🙏", display_order: 1 },
  { slug: "thank-you-teacher",category_slug:"thank-you",      name: "Teacher",          icon: "🍎", display_order: 2 },
  { slug: "thank-you-friend",category_slug: "thank-you",      name: "Friend",           icon: "💛", display_order: 3 },
  { slug: "thank-you-work",  category_slug: "thank-you",      name: "Professional",     icon: "💼", display_order: 4 },
  { slug: "inv-birthday",    category_slug: "invitations",    name: "Birthday",         icon: "🎂", display_order: 1 },
  { slug: "inv-wedding",     category_slug: "invitations",    name: "Wedding",          icon: "💍", display_order: 2 },
  { slug: "inv-baby",        category_slug: "invitations",    name: "Baby Shower",      icon: "🍼", display_order: 3 },
  { slug: "inv-graduation",  category_slug: "invitations",    name: "Graduation",       icon: "🎓", display_order: 4 },
  { slug: "inv-teacher",     category_slug: "invitations",    name: "Teacher's Week",   icon: "🍎", display_order: 5 },
  { slug: "no-cap",          category_slug: "vibes",          name: "No Cap",           icon: "🧢", display_order: 1 },
  { slug: "its-giving",      category_slug: "vibes",          name: "It's Giving",      icon: "💅", display_order: 2 },
  { slug: "lowkey",          category_slug: "vibes",          name: "Lowkey",           icon: "🤫", display_order: 3 },
  { slug: "main-character",  category_slug: "vibes",          name: "Main Character",   icon: "🌟", display_order: 4 },

  // ── Holidays ──────────────────────────────────────────────────────────────
  { slug: "christmas",       category_slug: "holidays",       name: "Christmas",        icon: "🎄", display_order: 1 },
  { slug: "new-year",        category_slug: "holidays",       name: "New Year",         icon: "🎆", display_order: 2 },
  { slug: "diwali",          category_slug: "holidays",       name: "Diwali",           icon: "🪔", display_order: 3 },
  { slug: "hanukkah",        category_slug: "holidays",       name: "Hanukkah",         icon: "🕎", display_order: 4 },
  { slug: "holi",            category_slug: "holidays",       name: "Holi",             icon: "🌈", display_order: 5 },
  { slug: "eid",             category_slug: "holidays",       name: "Eid",              icon: "🌙", display_order: 6 },
  { slug: "halloween",       category_slug: "holidays",       name: "Halloween",        icon: "🎃", display_order: 7 },
  { slug: "thanksgiving",    category_slug: "holidays",       name: "Thanksgiving",     icon: "🍂", display_order: 8 },

  // ── Occasions ─────────────────────────────────────────────────────────────
  { slug: "mothers-day",              category_slug: "occasions", name: "Mother's Day",             icon: "🌸", display_order: 1 },
  { slug: "fathers-day",              category_slug: "occasions", name: "Father's Day",             icon: "👔", display_order: 2 },
  { slug: "friendship-day",           category_slug: "occasions", name: "Friendship Day",           icon: "💛", display_order: 3 },
  { slug: "raksha-bandhan",           category_slug: "occasions", name: "Raksha Bandhan",           icon: "🪢", display_order: 4 },
  { slug: "international-womens-day", category_slug: "occasions", name: "International Women's Day",icon: "💜", display_order: 5 },
];

// ── Templates with DALL-E prompts ────────────────────────────────────────────
const TEMPLATES = [
  // ── Romance › Flowers ──────────────────────────────────────────────────────
  { slug: "t-r-f-1", category_slug: "romance", subcategory_slug: "flowers", title: "Red Roses", color_accent: "#E74C3C", display_order: 1,
    prompt: "Stunning close-up of a bouquet of deep red roses with dewdrops on petals, soft bokeh green background, warm romantic lighting, award-winning floral photography, portrait orientation, vibrant saturated colors, 8K." },
  { slug: "t-r-f-2", category_slug: "romance", subcategory_slug: "flowers", title: "Pink Blooms", color_accent: "#FF6B8A", display_order: 2,
    prompt: "Beautiful arrangement of soft pink peonies and cherry blossoms, pastel dreamy bokeh background, romantic morning light, fine art floral photography, portrait card, ultra-detailed petals." },
  { slug: "t-r-f-3", category_slug: "romance", subcategory_slug: "flowers", title: "Sunflower Love", color_accent: "#F39C12", display_order: 3,
    prompt: "Field of bright golden sunflowers under a vivid blue sky, warm afternoon sunshine, joyful and uplifting, wide portrait shot, vibrant saturated travel photography style, 8K." },
  { slug: "t-r-f-4", category_slug: "romance", subcategory_slug: "flowers", title: "Garden Blooms", color_accent: "#9B59B6", display_order: 4,
    prompt: "Lush English garden in full bloom — lavender, roses, wisteria — soft purple and pink palette, golden hour light, dreamy romantic photography, portrait orientation." },

  // ── Romance › Miss You ─────────────────────────────────────────────────────
  { slug: "t-r-m-1", category_slug: "romance", subcategory_slug: "miss-you", title: "Missing You", color_accent: "#FF6B8A", display_order: 1,
    prompt: "Lone heart-shaped hot air balloon drifting over misty mountains at golden sunrise, warm pink and gold tones, dreamy romantic atmosphere, ultra-wide portrait shot, cinematic photography." },
  { slug: "t-r-m-2", category_slug: "romance", subcategory_slug: "miss-you", title: "Lonely Heart", color_accent: "#E74C3C", display_order: 2,
    prompt: "Empty wooden bench on a cliff overlooking a calm ocean at sunset, single red rose lying on the bench, warm melancholic golden light, cinematic portrait photography." },

  // ── Romance › Thinking of You ──────────────────────────────────────────────
  { slug: "t-r-t-1", category_slug: "romance", subcategory_slug: "thinking-of-you", title: "You're on My Mind", color_accent: "#9B59B6", display_order: 1,
    prompt: "Dreamy double-exposure of a night sky full of stars and delicate wildflowers, soft purple and blue palette, magical romantic atmosphere, fine art portrait photography." },
  { slug: "t-r-t-2", category_slug: "romance", subcategory_slug: "thinking-of-you", title: "Always Here", color_accent: "#8E44AD", display_order: 2,
    prompt: "A glowing paper lantern floating up into a deep indigo night sky with scattered stars, warm amber light, romantic and hopeful mood, portrait orientation, cinematic photography." },

  // ── Romance › Good Night ───────────────────────────────────────────────────
  { slug: "t-r-g-1", category_slug: "romance", subcategory_slug: "good-night", title: "Starry Night", color_accent: "#1A1A4E", display_order: 1,
    prompt: "Breathtaking Milky Way galaxy over a calm dark lake reflecting the stars, deep indigo and purple sky, single glowing light on distant shore, astrophotography, portrait orientation." },
  { slug: "t-r-g-2", category_slug: "romance", subcategory_slug: "good-night", title: "Sweet Dreams", color_accent: "#2C3E50", display_order: 2,
    prompt: "Cozy bedroom window at night with sheer curtains, full moon glowing softly outside, warm lamplight, string lights, dreamy peaceful atmosphere, intimate interior portrait photography." },

  // ── Morning Wishes ─────────────────────────────────────────────────────────
  { slug: "t-mw-1", category_slug: "morning-wishes", subcategory_slug: "good-morning", title: "Golden Sunrise", color_accent: "#F39C12", display_order: 1,
    prompt: "Spectacular golden sunrise over misty mountain peaks, warm orange and gold rays bursting through clouds, breathtaking landscape, portrait orientation, award-winning travel photography, 8K." },
  { slug: "t-mw-2", category_slug: "morning-wishes", subcategory_slug: "good-morning", title: "Morning Coffee", color_accent: "#795548", display_order: 2,
    prompt: "Perfect flat white coffee with latte art in a ceramic cup on a wooden table, morning sunlight streaming through a window, warm cozy atmosphere, portrait food photography, ultra-detailed." },
  { slug: "t-mw-3", category_slug: "morning-wishes", subcategory_slug: "motivation", title: "Rise & Shine", color_accent: "#E67E22", display_order: 1,
    prompt: "Person reaching the summit of a rocky mountain peak at sunrise, arms raised in triumph, vast panoramic landscape below, dramatic golden light, cinematic inspirational photography, portrait." },
  { slug: "t-mw-4", category_slug: "morning-wishes", subcategory_slug: "weekend-vibes", title: "Happy Weekend", color_accent: "#27AE60", display_order: 1,
    prompt: "Vibrant outdoor weekend market with colorful flowers, fresh food, happy atmosphere, dappled sunshine through trees, bokeh background, portrait photography, warm joyful colors." },

  // ── Birthday ───────────────────────────────────────────────────────────────
  { slug: "t-b-1", category_slug: "birthday", title: "Birthday Cake", color_accent: "#FF6B8A", display_order: 1,
    prompt: "Stunning three-tier birthday cake with pink and gold frosting, lit candles glowing warmly, colorful confetti raining down, dark elegant background, portrait food photography, ultra-detailed." },
  { slug: "t-b-2", category_slug: "birthday", title: "Celebrate!", color_accent: "#9B59B6", display_order: 2,
    prompt: "Explosion of colorful confetti and gold balloons against a vivid purple background, festive celebration mood, studio photography, portrait orientation, vibrant and joyful, 8K." },
  { slug: "t-b-3", category_slug: "birthday", title: "Balloons & Joy", color_accent: "#3498DB", display_order: 3,
    prompt: "Bunch of colorful helium balloons — red, blue, gold, pink — floating against a bright blue sky, joyful and celebratory, portrait orientation, vibrant saturated photography." },

  // ── Thank You › General ────────────────────────────────────────────────────
  { slug: "t-ty-1", category_slug: "thank-you", subcategory_slug: "general-thanks", title: "From the Heart", color_accent: "#F5A623", display_order: 1,
    prompt: "Two hands cradling a glowing golden heart, warm amber light, dark bokeh background, emotional and heartfelt, fine art portrait photography, ultra-detailed." },
  { slug: "t-ty-2", category_slug: "thank-you", subcategory_slug: "general-thanks", title: "Gratitude Blooms", color_accent: "#E8722A", display_order: 2,
    prompt: "Beautiful bouquet of yellow sunflowers and orange marigolds in warm afternoon light, gratitude and warmth, vibrant floral portrait photography, bokeh background." },

  // ── Thank You › Teacher ────────────────────────────────────────────────────
  { slug: "t-ty-3", category_slug: "thank-you", subcategory_slug: "thank-you-teacher", title: "Thanks, Teacher!", color_accent: "#E74C3C", display_order: 1,
    prompt: "Stack of colorful books with a shiny red apple on top, warm wooden desk, soft classroom window light, warm golden tones, portrait still-life photography, ultra-detailed." },
  { slug: "t-ty-4", category_slug: "thank-you", subcategory_slug: "thank-you-teacher", title: "You Inspire Me", color_accent: "#C0392B", display_order: 2,
    prompt: "Open book with golden light emanating from its pages like a sunrise, surrounded by floating stars and paper planes, magical and inspirational, fine art portrait photography." },

  // ── Thank You › Friend ─────────────────────────────────────────────────────
  { slug: "t-ty-5", category_slug: "thank-you", subcategory_slug: "thank-you-friend", title: "Lucky to Have You", color_accent: "#F39C12", display_order: 1,
    prompt: "Two sparklers forming a heart shape against a dark night sky, warm golden light, friendship and celebration, portrait photography, bokeh background." },
  { slug: "t-ty-6", category_slug: "thank-you", subcategory_slug: "thank-you-friend", title: "BFF Thanks", color_accent: "#E67E22", display_order: 2,
    prompt: "Jar of golden honey with wildflowers on a sunny wooden table, warm friendship vibes, soft natural light, cozy and heartwarming still-life portrait photography." },

  // ── Thank You › Professional ───────────────────────────────────────────────
  { slug: "t-ty-7", category_slug: "thank-you", subcategory_slug: "thank-you-work", title: "Professional Thanks", color_accent: "#2C3E50", display_order: 1,
    prompt: "Elegant handshake over a clean marble desk with a small succulent plant, soft natural office light, professional and warm, portrait business photography, minimalist." },
  { slug: "t-ty-8", category_slug: "thank-you", subcategory_slug: "thank-you-work", title: "Great Teamwork", color_accent: "#34495E", display_order: 2,
    prompt: "Several hands stacking together in a team gesture, warm office light, diverse hands, positive energy, portrait corporate photography, clean background." },

  // ── Invitations › Birthday ─────────────────────────────────────────────────
  { slug: "t-inv-b1", category_slug: "invitations", subcategory_slug: "inv-birthday", title: "Birthday Bash", color_accent: "#FF6B8A", display_order: 1,
    prompt: "Festive birthday party table with gold and pink balloons, streamers, cake and confetti, top-down flat lay, vibrant celebration, portrait photography, ultra-detailed." },
  { slug: "t-inv-b2", category_slug: "invitations", subcategory_slug: "inv-birthday", title: "You're Invited!", color_accent: "#E91E8C", display_order: 2,
    prompt: "Colorful party invitation aesthetic — confetti, ribbons, sparkle, bright pink and gold palette, festive flat lay portrait photography." },

  // ── Invitations › Wedding ──────────────────────────────────────────────────
  { slug: "t-inv-w1", category_slug: "invitations", subcategory_slug: "inv-wedding", title: "Forever Begins", color_accent: "#C9A84C", display_order: 1,
    prompt: "Elegant wedding arch draped in white roses and eucalyptus leaves, soft golden afternoon light, romantic garden setting, portrait photography, luxury wedding aesthetic." },
  { slug: "t-inv-w2", category_slug: "invitations", subcategory_slug: "inv-wedding", title: "Two Hearts Unite", color_accent: "#8E44AD", display_order: 2,
    prompt: "Two wedding rings nestled in rose petals, soft purple and gold tones, fine art macro photography, romantic and elegant, portrait orientation." },

  // ── Invitations › Baby Shower ──────────────────────────────────────────────
  { slug: "t-inv-bs1", category_slug: "invitations", subcategory_slug: "inv-baby", title: "Baby on the Way", color_accent: "#85C1E9", display_order: 1,
    prompt: "Soft baby blue nursery flat lay — tiny shoes, knitted blanket, teddy bear, pastel blue and white palette, portrait still-life photography, ultra-gentle lighting." },
  { slug: "t-inv-bs2", category_slug: "invitations", subcategory_slug: "inv-baby", title: "Little One Coming", color_accent: "#F1948A", display_order: 2,
    prompt: "Delicate pink baby shoes and a small flower crown on a white fluffy blanket, soft natural light, pastel pink palette, fine art baby portrait photography." },

  // ── Invitations › Graduation ───────────────────────────────────────────────
  { slug: "t-inv-g1", category_slug: "invitations", subcategory_slug: "inv-graduation", title: "Cap & Gown", color_accent: "#2E86AB", display_order: 1,
    prompt: "Graduation cap thrown in the air against a bright blue sky with confetti raining down, achievement and celebration, portrait photography, vibrant colors." },
  { slug: "t-inv-g2", category_slug: "invitations", subcategory_slug: "inv-graduation", title: "Future is Bright", color_accent: "#F39C12", display_order: 2,
    prompt: "Open road stretching toward a bright golden sunrise between tall trees, hopeful and inspiring, wide-angle portrait, warm light, future and opportunity theme." },

  // ── Invitations › Teacher's Week ──────────────────────────────────────────
  { slug: "t-inv-t1", category_slug: "invitations", subcategory_slug: "inv-teacher", title: "Teacher Celebration", color_accent: "#E74C3C", display_order: 1,
    prompt: "Chalkboard with colorful chalk drawings of stars, hearts, and a trophy, warm classroom light, appreciation and celebration, portrait photography." },
  { slug: "t-inv-t2", category_slug: "invitations", subcategory_slug: "inv-teacher", title: "Shaping Tomorrow", color_accent: "#27AE60", display_order: 2,
    prompt: "Green seedling growing from an open book, warm sunlight, nurturing and growth metaphor, teacher appreciation, fine art portrait photography." },

  // ── Vibes ─────────────────────────────────────────────────────────────────
  { slug: "t-v-1", category_slug: "vibes", subcategory_slug: "no-cap", title: "No Cap, You're It", color_accent: "#FF1493", display_order: 1,
    prompt: "Neon pink and cyan graffiti art on a dark urban wall, Gen Z aesthetic, vibrant electric colors, street art portrait photography, glowing neon lights." },
  { slug: "t-v-2", category_slug: "vibes", subcategory_slug: "no-cap", title: "Facts Only 💯", color_accent: "#FF6B00", display_order: 2,
    prompt: "Bold orange and yellow neon signs in a dark city street, urban Gen Z aesthetic, glowing warm light, portrait photography, electric atmosphere." },
  { slug: "t-v-3", category_slug: "vibes", subcategory_slug: "its-giving", title: "It's Giving Love", color_accent: "#BF00FF", display_order: 1,
    prompt: "Glamorous purple and pink aesthetic — glitter, holographic foil, sparkles, luxe and chic, studio portrait photography, Gen Z Y2K style." },
  { slug: "t-v-4", category_slug: "vibes", subcategory_slug: "its-giving", title: "Serving Looks 💅", color_accent: "#FF1493", display_order: 2,
    prompt: "Hot pink and gold glitter explosion against a black background, glamorous and fierce, studio photography, Y2K aesthetic, ultra-vibrant." },
  { slug: "t-v-5", category_slug: "vibes", subcategory_slug: "lowkey", title: "Lowkey Obsessed", color_accent: "#00CFFF", display_order: 1,
    prompt: "Moody aesthetic — blue neon reflection on wet pavement at night, dark and cool, cinematic portrait photography, subtle and beautiful." },
  { slug: "t-v-6", category_slug: "vibes", subcategory_slug: "lowkey", title: "Quietly Iconic 🤫", color_accent: "#7B2FBE", display_order: 2,
    prompt: "Deep purple and indigo bokeh lights in a dark background, mysterious and iconic, moody fine art photography, portrait orientation." },
  { slug: "t-v-7", category_slug: "vibes", subcategory_slug: "main-character", title: "Main Character Era", color_accent: "#FFD700", display_order: 1,
    prompt: "Cinematic golden-hour scene — long lens flare, dramatic sky, open road, protagonist energy, warm gold and amber tones, portrait movie still aesthetic." },
  { slug: "t-v-8", category_slug: "vibes", subcategory_slug: "main-character", title: "That Girl / That Guy", color_accent: "#FF1493", display_order: 2,
    prompt: "Aesthetic morning routine flat lay — matcha latte, journal, flowers, crystals, soft morning light, pastel tones, portrait still-life photography, aspirational lifestyle." },

  // ── Holidays › Christmas ──────────────────────────────────────────────────
  { slug: "t-h-xmas-1", category_slug: "holidays", subcategory_slug: "christmas", title: "Christmas Magic", color_accent: "#C0392B", display_order: 1,
    prompt: "Warm cinematic close-up of a snow-dusted pine wreath with red berries, golden fairy lights glowing softly, burgundy ribbon, rich jewel tones, cosy magical atmosphere, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-h-xmas-2", category_slug: "holidays", subcategory_slug: "christmas", title: "Cosy Christmas", color_accent: "#27AE60", display_order: 2,
    prompt: "Elegant Christmas fireplace scene with glowing embers, stockings hung, snow falling outside a frosted window, warm amber candlelight, cosy and magical, painterly fine art style, portrait orientation, no text." },

  // ── Holidays › New Year ───────────────────────────────────────────────────
  { slug: "t-h-ny-1", category_slug: "holidays", subcategory_slug: "new-year", title: "New Year Fireworks", color_accent: "#1A1A4E", display_order: 1,
    prompt: "Breathtaking aerial view of fireworks exploding over a dark city skyline at midnight, gold and silver sparks cascading, deep navy background, cinematic and dramatic, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-h-ny-2", category_slug: "holidays", subcategory_slug: "new-year", title: "Fresh Start", color_accent: "#C9A84C", display_order: 2,
    prompt: "Two champagne glasses clinking with golden bubbles rising against a bokeh backdrop of warm lights and confetti, celebratory and elegant, fine art portrait photography, greeting card aesthetic, no text." },

  // ── Holidays › Diwali ─────────────────────────────────────────────────────
  { slug: "t-h-diwali-1", category_slug: "holidays", subcategory_slug: "diwali", title: "Festival of Light", color_accent: "#E67E22", display_order: 1,
    prompt: "Beautiful arrangement of lit diyas glowing amber and gold on a dark surface, surrounded by marigold petals and intricate rangoli patterns in pink, orange and red, warm festive atmosphere, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-h-diwali-2", category_slug: "holidays", subcategory_slug: "diwali", title: "Diwali Glow", color_accent: "#F39C12", display_order: 2,
    prompt: "Overhead flat lay of dozens of clay diyas glowing golden in a dark setting, surrounded by flower petals and sparkle, rich warm tones, painterly fine art style, portrait orientation, no text." },

  // ── Holidays › Hanukkah ───────────────────────────────────────────────────
  { slug: "t-h-hanukkah-1", category_slug: "holidays", subcategory_slug: "hanukkah", title: "Eight Nights", color_accent: "#1A3A6B", display_order: 1,
    prompt: "Silver menorah with all eight candles lit, warm golden flames glowing against a deep blue background with soft bokeh stars, elegant and serene, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-h-hanukkah-2", category_slug: "holidays", subcategory_slug: "hanukkah", title: "Festival of Lights", color_accent: "#C9A84C", display_order: 2,
    prompt: "Close-up of a golden menorah candle flame glowing against a dark indigo background with Star of David bokeh lights, warm and sacred, fine art portrait photography, greeting card aesthetic, no text." },

  // ── Holidays › Holi ───────────────────────────────────────────────────────
  { slug: "t-h-holi-1", category_slug: "holidays", subcategory_slug: "holi", title: "Colours of Joy", color_accent: "#E91E8C", display_order: 1,
    prompt: "Explosion of vibrant coloured powder — magenta, turquoise, saffron and lime — suspended in the air against a bright white background, joyful, energetic, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-h-holi-2", category_slug: "holidays", subcategory_slug: "holi", title: "Holi Celebration", color_accent: "#9B59B6", display_order: 2,
    prompt: "Hands tossing rainbow gulal powder into a bright blue sky, vivid pinks purples and yellows filling the frame, celebration and joy, vibrant portrait photography, greeting card aesthetic, no text." },

  // ── Holidays › Eid ────────────────────────────────────────────────────────
  { slug: "t-h-eid-1", category_slug: "holidays", subcategory_slug: "eid", title: "Eid Mubarak", color_accent: "#1B4332", display_order: 1,
    prompt: "Crescent moon and single star glowing in a deep indigo sky, intricate Islamic geometric lanterns hanging below casting warm golden light, elegant and serene, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-h-eid-2", category_slug: "holidays", subcategory_slug: "eid", title: "Eid Blessings", color_accent: "#C9A84C", display_order: 2,
    prompt: "Ornate golden Islamic lanterns glowing warmly against a deep teal and gold Moroccan backdrop, intricate geometric patterns, festive and sacred atmosphere, fine art portrait photography, greeting card aesthetic, no text." },

  // ── Holidays › Halloween ──────────────────────────────────────────────────
  { slug: "t-h-halloween-1", category_slug: "holidays", subcategory_slug: "halloween", title: "Spooky Night", color_accent: "#E67E22", display_order: 1,
    prompt: "Carved jack-o-lantern glowing orange on a dark doorstep surrounded by autumn leaves, candles and wisps of mist, moody and atmospheric, deep purples and burnt oranges, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-h-halloween-2", category_slug: "holidays", subcategory_slug: "halloween", title: "Witch's Night", color_accent: "#6C3483", display_order: 2,
    prompt: "Full moon rising behind bare autumn trees with bats silhouetted in the night sky, haunted house in the distance, deep purple and black tones, cinematic horror art style, greeting card aesthetic, portrait orientation, no text." },

  // ── Holidays › Thanksgiving ───────────────────────────────────────────────
  { slug: "t-h-thanks-1", category_slug: "holidays", subcategory_slug: "thanksgiving", title: "Harvest Table", color_accent: "#C0392B", display_order: 1,
    prompt: "Warm rustic flatlay of autumn harvest — golden pumpkins, maple leaves, wheat stalks and candles on a wooden table, rich amber and burnt sienna tones, cosy and abundant, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-h-thanks-2", category_slug: "holidays", subcategory_slug: "thanksgiving", title: "Grateful Heart", color_accent: "#E67E22", display_order: 2,
    prompt: "Beautiful autumn forest path with golden and red fallen leaves, warm afternoon sunlight filtering through bare trees, peaceful and grateful mood, cinematic portrait photography, greeting card aesthetic, no text." },

  // ── Occasions › Mother's Day ──────────────────────────────────────────────
  { slug: "t-occ-mom-1", category_slug: "occasions", subcategory_slug: "mothers-day", title: "For Mum", color_accent: "#FF6B8A", display_order: 1,
    prompt: "Soft close-up of gentle hands holding a bouquet of pale pink peonies and white roses, warm afternoon light falling across them, tender and romantic, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-occ-mom-2", category_slug: "occasions", subcategory_slug: "mothers-day", title: "Unconditional Love", color_accent: "#C9A84C", display_order: 2,
    prompt: "Silhouette of a mother and child holding hands walking through a golden field at sunset, warm amber glow, emotional and cinematic, painterly fine art style, greeting card aesthetic, portrait orientation, no text." },

  // ── Occasions › Father's Day ──────────────────────────────────────────────
  { slug: "t-occ-dad-1", category_slug: "occasions", subcategory_slug: "fathers-day", title: "For Dad", color_accent: "#2C3E50", display_order: 1,
    prompt: "Heartwarming silhouette of a father and child walking hand in hand along a golden sunset beach, waves softly lapping, warm amber and coral tones, cinematic and emotional, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-occ-dad-2", category_slug: "occasions", subcategory_slug: "fathers-day", title: "My Hero", color_accent: "#1A3A6B", display_order: 2,
    prompt: "Close-up of a strong father's hand gently holding a tiny child's hand, warm natural light, dark bokeh background, emotional and intimate, fine art portrait photography, greeting card aesthetic, no text." },

  // ── Occasions › Friendship Day ────────────────────────────────────────────
  { slug: "t-occ-friend-1", category_slug: "occasions", subcategory_slug: "friendship-day", title: "Best Friends", color_accent: "#F39C12", display_order: 1,
    prompt: "Warm candid moment of two hands clinking coffee cups together at a sunlit café table, golden light streaming through the window, soft bokeh background, joyful and intimate, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-occ-friend-2", category_slug: "occasions", subcategory_slug: "friendship-day", title: "Forever Friends", color_accent: "#27AE60", display_order: 2,
    prompt: "Two friendship bracelets on wrists side by side in warm afternoon sunlight, vibrant colours, golden bokeh background, intimate and joyful, fine art portrait photography, greeting card aesthetic, no text." },

  // ── Occasions › Raksha Bandhan ────────────────────────────────────────────
  { slug: "t-occ-raksha-1", category_slug: "occasions", subcategory_slug: "raksha-bandhan", title: "Sacred Bond", color_accent: "#E74C3C", display_order: 1,
    prompt: "Close-up of a delicate rakhi thread — red, gold and intricate — being tied around a wrist, marigold petals scattered softly around, warm golden tones, intimate and ceremonial, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-occ-raksha-2", category_slug: "occasions", subcategory_slug: "raksha-bandhan", title: "Sibling Love", color_accent: "#C9A84C", display_order: 2,
    prompt: "Beautiful flat lay of colourful rakhis, marigold flowers, red kumkum and sweets on a golden silk cloth, festive and warm, fine art portrait photography, greeting card aesthetic, no text." },

  // ── Occasions › International Women's Day ────────────────────────────────
  { slug: "t-occ-iwd-1", category_slug: "occasions", subcategory_slug: "international-womens-day", title: "She Leads", color_accent: "#8E44AD", display_order: 1,
    prompt: "Powerful close-up of diverse women's hands raised together, each holding a different wildflower — roses, sunflowers, lavender — against a soft purple sky, bold and uplifting, painterly illustration style, greeting card aesthetic, portrait orientation, no text." },
  { slug: "t-occ-iwd-2", category_slug: "occasions", subcategory_slug: "international-womens-day", title: "Women Rise", color_accent: "#E91E8C", display_order: 2,
    prompt: "Single woman silhouette standing on a mountain peak at golden sunrise, arms open wide, dramatic sky with soft pinks and purples, empowering and cinematic, fine art portrait photography, greeting card aesthetic, no text." },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateDalleImage(prompt) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: "1024x1792", quality: "hd", style: "natural" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `DALL-E failed: ${res.status}`);
  }
  const data = await res.json();
  const url = data.data?.[0]?.url;
  if (!url) throw new Error("No URL returned from DALL-E");
  return url;
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadToSupabase(buffer, path) {
  // Check if already exists
  const { data: existing } = await supabase.storage.from("card-images").list(path.split("/").slice(0, -1).join("/"));
  const filename = path.split("/").pop();
  if (existing?.find(f => f.name === filename)) {
    console.log(`    ⏭️  Already exists, skipping upload`);
    const { data } = supabase.storage.from("card-images").getPublicUrl(path);
    return data.publicUrl;
  }

  const { error } = await supabase.storage.from("card-images").upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from("card-images").getPublicUrl(path);
  return data.publicUrl;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱  SayIt Template Seeder\n");

  // 1. Upsert categories → collect { slug → uuid }
  console.log("📁  Seeding categories…");
  const catMap = {};
  for (const cat of CATEGORIES) {
    const { data, error } = await supabase.from("categories")
      .upsert({ ...cat, is_active: true }, { onConflict: "slug" })
      .select("id, slug").single();
    if (error) { console.error(`  ❌ ${cat.slug}:`, error.message); continue; }
    catMap[cat.slug] = data.id;
    console.log(`  ✅ ${cat.name} → ${data.id}`);
  }

  // 2. Upsert subcategories → collect { slug → uuid }
  console.log("\n📂  Seeding subcategories…");
  const subMap = {};
  for (const sub of SUBCATEGORIES) {
    const cat_id = catMap[sub.category_slug];
    if (!cat_id) { console.error(`  ❌ ${sub.slug}: parent category not found`); continue; }
    const { data, error } = await supabase.from("subcategories")
      .upsert({ name: sub.name, slug: sub.slug, icon: sub.icon, display_order: sub.display_order, category_id: cat_id }, { onConflict: "slug" })
      .select("id, slug").single();
    if (error) { console.error(`  ❌ ${sub.slug}:`, error.message); continue; }
    subMap[sub.slug] = data.id;
    console.log(`  ✅ ${sub.name}`);
  }

  // 3. Generate images + seed templates
  console.log(`\n🎨  Generating ${TEMPLATES.length} card images with DALL-E 3…`);
  console.log("    (This will take ~5-6 minutes due to API rate limits)\n");

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < TEMPLATES.length; i++) {
    const t = TEMPLATES[i];
    console.log(`[${i + 1}/${TEMPLATES.length}] ${t.title} (${t.category_slug})`);

    try {
      // Check if template already has a Supabase URL
      const storagePath = `templates/${t.slug}.jpg`;
      const { data: existingFiles } = await supabase.storage.from("card-images").list("templates");
      const alreadyUploaded = existingFiles?.find(f => f.name === `${t.slug}.jpg`);

      let imageUrl;
      if (alreadyUploaded) {
        console.log(`    ⏭️  Image already in storage, skipping DALL-E generation`);
        const { data } = supabase.storage.from("card-images").getPublicUrl(storagePath);
        imageUrl = data.publicUrl;
      } else {
        // Generate with DALL-E
        console.log(`    🖌️  Generating with DALL-E 3…`);
        const dalleUrl = await generateDalleImage(t.prompt);

        // Download + upload to Supabase
        console.log(`    ⬇️  Downloading…`);
        const buffer = await downloadImage(dalleUrl);

        console.log(`    ☁️  Uploading to Supabase Storage…`);
        const { error: upErr } = await supabase.storage.from("card-images")
          .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw new Error(`Upload: ${upErr.message}`);

        const { data: urlData } = supabase.storage.from("card-images").getPublicUrl(storagePath);
        imageUrl = urlData.publicUrl;
      }

      // Upsert template record
      const record = {
        title: t.title,
        color_accent: t.color_accent,
        display_order: t.display_order,
        is_active: true,
        front_image_url: imageUrl,
        category_id: catMap[t.category_slug],
        subcategory_id: t.subcategory_slug ? subMap[t.subcategory_slug] : null,
      };

      const { error: tErr } = await supabase.from("templates")
        .upsert(record, { onConflict: "title,category_id" });

      if (tErr) throw new Error(`DB insert: ${tErr.message}`);

      console.log(`    ✅ Done → ${imageUrl.split("?")[0].split("/").pop()}\n`);
      successCount++;

      // Rate limit: wait 5 seconds between DALL-E calls (max ~12/min, limit is 15)
      if (!alreadyUploaded && i < TEMPLATES.length - 1) {
        console.log(`    ⏳ Waiting 5s for rate limit…`);
        await sleep(5000);
      }

    } catch (err) {
      console.error(`    ❌ Failed: ${err.message}\n`);
      failCount++;
      // Wait a bit longer on error before continuing
      await sleep(3000);
    }
  }

  console.log("\n─────────────────────────────────────────");
  console.log(`✅  Seeding complete!`);
  console.log(`    Success: ${successCount}/${TEMPLATES.length}`);
  if (failCount > 0) console.log(`    Failed:  ${failCount} (re-run to retry)`);
  console.log("\n🎉  Your Supabase DB now has all categories, subcategories, and templates with real DALL-E images!");
  console.log("    Next step: Update your app to fetch from Supabase instead of data.ts\n");
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
