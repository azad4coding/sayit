import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AI_LOCATIONS } from "@/lib/ai-locations";
import sharp from "sharp";

// ── Supabase admin client (server-side only) ────────────────────────────────
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const OPENAI_API_KEY   = process.env.OPENAI_API_KEY!;
const REMOVEBG_API_KEY = process.env.REMOVEBG_API_KEY ?? "";   // optional — set in Vercel env
const AI_DAILY_LIMIT   = 2;

// Target card dimensions for gpt-image-1 and sharp compositing
const TARGET_W = 1024;
const TARGET_H = 1536;

// ── Card style prompts ────────────────────────────────────────────────────────
const STYLE_PROMPTS: Record<string, { mood: string; lighting: string; colors: string }> = {
  couple: {
    mood: "romantic, joyful, warm and inviting",
    lighting: "BRIGHT midday sunshine, clear deep-blue sky, strong vivid natural light, zero shade or shadow, perfect sunny holiday day",
    colors: "vivid saturated travel-photo colours — rich blue sky, white architecture, warm golden stone, lush green foliage",
  },
  birthday: {
    mood: "joyful, festive, celebratory, full of happiness and energy",
    lighting: "BRIGHT vibrant daylight, clear sunny sky, colourful confetti sparkles in sunlight",
    colors: "vivid rainbow, gold, festive brights, warm sunshine yellow",
  },
  pet: {
    mood: "playful, heartwarming, adorable, full of life and joy",
    lighting: "BRIGHT clear midday sunshine, crisp natural light, no shadows",
    colors: "warm natural tones, soft greens, earth tones, cozy warm amber",
  },
};

// ── Default quotes per category ──────────────────────────────────────────────
const DEFAULT_QUOTES: Record<string, string[]> = {
  couple: [
    "I Love You", "Forever Yours", "You & Me", "Always", "My Person",
    "Together is our favourite place", "You are my adventure",
  ],
  birthday: [
    "Happy Birthday!", "Make a Wish ✨", "Celebrate!", "Another Trip Around the Sun",
    "You're one in a million", "Here's to you!",
  ],
  pet: [
    "Best Friends", "Good Boy!", "Good Girl!", "Pawsome!", "Fur-ever Loved",
    "You complete me 🐾", "My Favourite Human",
  ],
};

function getQuote(category: string, userMessage: string): string {
  if (userMessage.trim()) return userMessage.trim().slice(0, 60);
  const quotes = DEFAULT_QUOTES[category] ?? DEFAULT_QUOTES.couple;
  return quotes[Math.floor(Math.random() * quotes.length)];
}

// ── DALL-E 3 prompt: pure background scene with embedded quote (no photo) ────
function buildDallePrompt(
  category: string,
  locationHint: string,
  locationName: string,
  textStyle: string,
  userMessage: string,
): string {
  const style = STYLE_PROMPTS[category] ?? STYLE_PROMPTS.couple;
  const quote = getQuote(category, userMessage);
  return `A breathtaking scenic photograph of ${locationName} for a greeting card, with the words "${quote}" ${textStyle}.

SETTING: ${locationHint}

TEXT: The text "${quote}" appears ${textStyle}. Clearly legible, beautifully styled, feels like a natural part of the scene.

STYLE: ${style.mood}. ${style.lighting}. Color palette: ${style.colors}.

COMPOSITION: Wide establishing shot. No people. Rich, detailed environment. Beautiful sky. Text is a prominent focal point.

8K photorealistic, award-winning travel photography, professional color grading.`.trim();
}

// ── DALL-E 3 prompt: background-only for photo composite ─────────────────────
// Person is NEVER sent to AI. DALL-E generates only the backdrop.
function buildDalleBackgroundOnlyPrompt(
  category: string,
  locationHint: string,
  locationName: string,
): string {
  return `A stunning travel photograph of ${locationName} taken at 1pm on a clear summer day.

SETTING: ${locationHint}

LIGHTING — ABSOLUTE RULE:
- Time of day: 1pm (early afternoon). Sun is high in the sky.
- Sky colour: solid bright azure blue (#4A90D9). Zero orange, zero gold, zero pink, zero purple in the sky.
- Light quality: cool, crisp, strong. Hard directional shadows are short because the sun is overhead.
- This is NOT sunrise, NOT sunset, NOT golden hour, NOT dusk, NOT dawn.
- If you are tempted to add warm atmospheric glow — DO NOT. The sky must stay pure blue.

PEOPLE: There are ZERO humans, ZERO figures, ZERO silhouettes anywhere in the scene.

COMPOSITION: Portrait orientation (9:16 ratio). Wide angle establishing shot. Sky occupies the upper 35% of the frame. There is open ground, paving, or pathway in the lower-centre where a person could naturally stand. The horizon sits at roughly 55% from the top. Rich architectural or landscape detail fills the mid-ground.

STYLE: Vibrant, saturated colours. Looks like a professional travel stock photo — the kind you see on a holiday booking website in the middle of the day. Sharp focus, high contrast, vivid blues and whites.

8K resolution, photorealistic, award-winning travel photography. No artistic filters. No vignette.`.trim();
}

// ── remove.bg: strip photo background → transparent PNG ──────────────────────
// Returns a Buffer of PNG binary data with alpha channel.
// Person pixels = opaque (alpha 255).  Background pixels = transparent (alpha 0).
// This format is DIRECTLY compatible with gpt-image-1's mask convention:
//   transparent = edit (background)  •  opaque = keep (person).
// Falls back to null if REMOVEBG_API_KEY is not configured.
async function removeBackground(photoBuffer: ArrayBuffer, mimeType: string): Promise<Buffer | null> {
  if (!REMOVEBG_API_KEY) return null;

  const form = new FormData();
  form.append("image_file", new Blob([photoBuffer], { type: mimeType }), "photo.jpg");
  form.append("size", "auto");
  form.append("format", "png");

  const res = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": REMOVEBG_API_KEY },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    console.error("remove.bg error:", errText);
    return null;
  }

  return Buffer.from(await res.arrayBuffer());
}

// ── gpt-image-1 inpainting with accurate mask ─────────────────────────────────
// Uses remove.bg's transparent-person PNG directly as the mask:
//   • Transparent pixels (background) → gpt-image-1 fills with the new location scene
//   • Opaque pixels (person)          → gpt-image-1 keeps pixel-perfect from original
// This is why the face CANNOT change: the person's pixels are locked by the mask.
async function generateWithAccurateMask(
  _photoBuffer: ArrayBuffer,    // kept for signature compatibility — no longer sent to AI
  _mimeType: string,            // kept for signature compatibility
  maskBuffer: Buffer,           // remove.bg PNG: person=opaque, background=transparent
  locationName: string,
  locationHint: string,
  category: string,
): Promise<string> {
  const style = STYLE_PROMPTS[category] ?? STYLE_PROMPTS.couple;

  // ── Send a blank white canvas as the image, not the original photo ──────────
  // Why: if we send the real photo, gpt-image-1 "echoes" the person into the
  // generated background even in the transparent (edit) region, creating a ghost
  // artifact. A blank canvas has no person data for gpt-image-1 to echo — it
  // generates a clean scene, and we overlay the real person separately via sharp.
  //
  // The mask tells gpt-image-1 which region to fill:
  //   transparent pixels (background area) → generate the travel scene
  //   opaque pixels (person area)          → keep white (we'll cover with person)
  const blankCanvas = await sharp({
    create: { width: TARGET_W, height: TARGET_H, channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 } },
  }).png().toBuffer();

  // Resize the remove.bg mask to exactly match the blank canvas dimensions
  const resizedMaskBuffer = await sharp(maskBuffer)
    .resize(TARGET_W, TARGET_H, { fit: "cover", position: "top" })
    .png()
    .toBuffer();

  // Helper: Buffer → ArrayBuffer (TypeScript-safe for use in Blob)
  const toAB = (b: Buffer): ArrayBuffer =>
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

  const form = new FormData();
  // Blank canvas — gpt-image-1 fills the background region with the travel scene
  form.append("image", new Blob([toAB(blankCanvas)], { type: "image/png" }), "photo.png");
  // Mask: transparent = generate background, opaque = leave white (person goes here)
  form.append("mask", new Blob([toAB(resizedMaskBuffer)], { type: "image/png" }), "mask.png");
  // Prompt describes the background only — no person, no faces
  form.append("prompt", `Stunning background travel scene only for ${locationName}. ${locationHint}. ${style.lighting}. ${style.colors}. Photorealistic travel photography, bright clear day, vivid natural colours. Wide open view. ZERO people, ZERO faces, ZERO silhouettes, ZERO human figures anywhere in the scene.`);
  form.append("model", "gpt-image-1");
  form.append("size",  "1024x1536");   // portrait card
  form.append("quality", "high");
  form.append("n", "1");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData?.error?.message ?? `gpt-image-1 failed: ${res.status}`);
  }

  const data = await res.json();
  const b64  = data.data?.[0]?.b64_json;
  if (b64) return `data:image/png;base64,${b64}`;
  const url = data.data?.[0]?.url;
  if (url) return url;
  throw new Error("No image returned from gpt-image-1");
}

// ── DALL-E 3 call ─────────────────────────────────────────────────────────────
async function generateWithDalle(prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1792",
      quality: "hd",
      style: "natural",
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message ?? res.statusText;
    if (res.status === 401) throw new Error("OpenAI API key is invalid. Check Vercel env vars.");
    if (res.status === 429) throw new Error("OpenAI billing issue. Check your account credits.");
    throw new Error(`DALL-E 3 failed: ${msg}`);
  }

  const data = await res.json();
  const url = data.data?.[0]?.url;
  if (!url) throw new Error("No image returned from DALL-E 3");
  return url;
}

// ── Upload image to Supabase Storage → return public URL ─────────────────────
async function uploadToStorage(
  source: string | Buffer,
  userId: string,
  suffix = "",
  contentType = "image/png",
): Promise<string> {
  let buffer: Buffer;

  if (Buffer.isBuffer(source)) {
    buffer = source;
  } else if (typeof source === "string" && source.startsWith("data:")) {
    buffer = Buffer.from(source.split(",")[1], "base64");
  } else {
    // URL (e.g. DALL-E 3 temporary URL)
    const imgRes = await fetch(source as string);
    if (!imgRes.ok) throw new Error("Failed to fetch generated image");
    buffer = Buffer.from(await imgRes.arrayBuffer());
  }

  const ext  = contentType === "image/png" ? "png" : "jpg";
  const path = `ai-cards/${userId}/${Date.now()}${suffix}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from("card-images")
    .upload(path, buffer, { contentType, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabaseAdmin.storage.from("card-images").getPublicUrl(path);
  return data.publicUrl;
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const userId      = formData.get("userId")     as string;
    const category    = formData.get("category")   as string;
    const locationId  = formData.get("locationId") as string;
    const userMessage = (formData.get("message")   as string) ?? "";
    const photoFile   = formData.get("photo")      as File | null;

    if (!userId || !category || !locationId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });
    }

    const location = AI_LOCATIONS.find(l => l.id === locationId);
    if (!location) {
      return NextResponse.json({ error: "Invalid location" }, { status: 400 });
    }

    // ── Daily limit check ─────────────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin
      .from("sent_cards")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", userId)
      .eq("card_type", "ai-card")
      .gte("created_at", today.toISOString());

    if ((count ?? 0) >= AI_DAILY_LIMIT) {
      return NextResponse.json(
        { error: "daily_limit", message: `You've used your ${AI_DAILY_LIMIT} free AI cards today. Come back tomorrow!` },
        { status: 429 },
      );
    }

    const locationName = `${location.name}, ${location.country}`;
    const quote = getQuote(category, userMessage);

    // ── Generation strategy ───────────────────────────────────────────────
    //
    // PHOTO PRESENT — three-tier strategy (best quality first):
    //
    //   Tier 1 ★  remove.bg mask + gpt-image-1 inpainting
    //     remove.bg creates a pixel-accurate person mask.
    //     gpt-image-1 fills ONLY the background (masked) pixels.
    //     Person pixels are pixel-locked → face CANNOT change.
    //     Result looks like the OpenAI reference image (professional composite).
    //
    //   Tier 2    remove.bg transparent PNG + DALL-E 3 + client composite
    //     gpt-image-1 failed (rate-limit, etc.) but remove.bg worked.
    //     Client overlays the clean transparent person PNG onto the DALL-E scene.
    //
    //   Tier 3    DALL-E 3 only + client chroma-key
    //     No remove.bg key set.  Falls back to colour-distance background removal.
    //
    // NO PHOTO → DALL-E 3 with embedded quote text.

    if (photoFile) {
      const photoBuffer = await photoFile.arrayBuffer();

      // Always call remove.bg first (needs the photo buffer)
      const personMaskBuffer = await removeBackground(photoBuffer, photoFile.type);

      if (personMaskBuffer) {
        // Pre-resize the remove.bg person to card size once — reused in both tiers
        const personOverlay = await sharp(personMaskBuffer)
          .resize(TARGET_W, TARGET_H, { fit: "cover", position: "top" })
          .png()
          .toBuffer();

        // ── Tier 1: gpt-image-1 background + sharp person overlay ───────────
        // gpt-image-1 generates the scene; we then paste the ORIGINAL remove.bg
        // person pixels back on top so the face is pixel-perfect — never AI-altered.
        try {
          const gptSource = await generateWithAccurateMask(
            photoBuffer,
            photoFile.type,
            personMaskBuffer,
            locationName,
            location.promptHint,
            category,
          );

          // Fetch gpt-image-1 result as buffer
          let gptBuf: Buffer;
          if (typeof gptSource === "string" && gptSource.startsWith("data:")) {
            gptBuf = Buffer.from(gptSource.split(",")[1], "base64");
          } else {
            gptBuf = Buffer.from(await (await fetch(gptSource)).arrayBuffer());
          }

          // Composite original person back on top — restores exact face pixels
          const finalBuf = await sharp(gptBuf)
            .resize(TARGET_W, TARGET_H)
            .composite([{ input: personOverlay, blend: "over" }])
            .jpeg({ quality: 92 })
            .toBuffer();

          const permanentUrl = await uploadToStorage(finalBuf, userId, "_composited", "image/jpeg")
            .catch(async () => uploadToStorage(gptBuf, userId, "_composited"));
          return NextResponse.json({ imageUrl: permanentUrl, personUrl: null, locationName, quote, composited: true });
        } catch (gptErr) {
          console.error("gpt-image-1 with mask failed, falling to Tier 2:", gptErr);
        }

        // ── Tier 2: DALL-E 3 background + sharp person overlay (server-side) ─
        // Same sharp composite approach — no client-side canvas needed.
        const bgUrl = await generateWithDalle(
          buildDalleBackgroundOnlyPrompt(category, location.promptHint, locationName),
        );
        const bgBuf = Buffer.from(await (await fetch(bgUrl)).arrayBuffer());
        const bgResized = await sharp(bgBuf)
          .resize(TARGET_W, TARGET_H, { fit: "cover" })
          .toBuffer();

        const tier2Buf = await sharp(bgResized)
          .composite([{ input: personOverlay, blend: "over" }])
          .jpeg({ quality: 92 })
          .toBuffer();

        const tier2Url = await uploadToStorage(tier2Buf, userId, "_composited", "image/jpeg")
          .catch(async () => uploadToStorage(bgBuf, userId, "_bg"));
        return NextResponse.json({ imageUrl: tier2Url, personUrl: null, locationName, quote, composited: true });
      }

      // ── Tier 3: no remove.bg key → DALL-E 3 + client chroma-key ────────
      const bgImageUrl = await generateWithDalle(
        buildDalleBackgroundOnlyPrompt(category, location.promptHint, locationName),
      );
      const bgUrl = await uploadToStorage(bgImageUrl, userId, "_bg").catch(() => bgImageUrl);
      return NextResponse.json({ imageUrl: bgUrl, personUrl: null, locationName, quote, composited: false });
    }

    // ── No photo: DALL-E 3 with embedded quote text ───────────────────────
    const bgImageUrl = await generateWithDalle(
      buildDallePrompt(category, location.promptHint, locationName, location.textStyle, userMessage),
    );
    let permanentUrl: string;
    try { permanentUrl = await uploadToStorage(bgImageUrl, userId); }
    catch { permanentUrl = bgImageUrl; }

    return NextResponse.json({ imageUrl: permanentUrl, personUrl: null, locationName, quote, composited: false });

  } catch (err: unknown) {
    console.error("generate-ai-card error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
