"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { AI_LOCATION_REGIONS, getLocationsForCategory, type AiLocation } from "@/lib/ai-locations";
import { ArrowLeft, Sparkles, Upload, Camera, Send, ChevronDown, CheckCircle2, Wand2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { v4 as uuidv4 } from "uuid";

// ── SHARED: apply overlays onto an already-composited canvas ─────────────────
function applyOverlays(ctx: CanvasRenderingContext2D, W: number, H: number, message: string) {
  // Dark gradient at bottom for text legibility
  const tGrad = ctx.createLinearGradient(0, H * 0.52, 0, H);
  tGrad.addColorStop(0,    "rgba(0,0,0,0)");
  tGrad.addColorStop(0.40, "rgba(0,0,0,0.38)");
  tGrad.addColorStop(1,    "rgba(0,0,0,0.62)");
  ctx.fillStyle = tGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle side vignettes
  const lv = ctx.createLinearGradient(0, 0, W * 0.10, 0);
  lv.addColorStop(0, "rgba(0,0,0,0.20)"); lv.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = lv; ctx.fillRect(0, 0, W * 0.10, H);

  const rv = ctx.createLinearGradient(W, 0, W * 0.90, 0);
  rv.addColorStop(0, "rgba(0,0,0,0.20)"); rv.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rv; ctx.fillRect(W * 0.90, 0, W * 0.10, H);

  // ❤️ badge
  ctx.save();
  ctx.font = "54px serif"; ctx.textAlign = "right"; ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 14;
  ctx.fillText("❤️", W - 44, 52);
  ctx.restore();

  // Message text
  const quote = message.trim().slice(0, 60);
  if (quote) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 22;
    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.round(W * 0.052)}px Georgia, 'Times New Roman', serif`;
    const words = quote.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > W * 0.78) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    const lineH  = Math.round(W * 0.065);
    const startY = H - 200 - lines.length * lineH;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lineH));
    ctx.restore();
  }
}

// ── SHARED: apply geometric person fading (bottom fade + side feathers) ──────
function applyPersonFade(
  personCanvas: HTMLCanvasElement,
  W: number,
  H: number,
  fadeStartY: number = 0.50,   // fraction of H where bottom fade starts
  fadeEndY: number   = 0.72,   // fraction of H where bottom fade completes
) {
  const pcCtx = personCanvas.getContext("2d")!;

  const fadeCanvas = document.createElement("canvas");
  fadeCanvas.width = W; fadeCanvas.height = H;
  const fCtx = fadeCanvas.getContext("2d")!;
  fCtx.fillStyle = "#fff";
  fCtx.fillRect(0, 0, W, H);
  fCtx.globalCompositeOperation = "destination-out";

  // Bottom fade — person "stands" in the landscape
  const bFade = fCtx.createLinearGradient(0, H * fadeStartY, 0, H * fadeEndY);
  bFade.addColorStop(0, "rgba(0,0,0,0)");
  bFade.addColorStop(1, "rgba(0,0,0,1)");
  fCtx.fillStyle = bFade;
  fCtx.fillRect(0, H * fadeStartY, W, H * (fadeEndY - fadeStartY));
  fCtx.fillStyle = "#000";
  fCtx.fillRect(0, H * fadeEndY, W, H * (1 - fadeEndY));

  // Left feather
  const lFade = fCtx.createLinearGradient(0, 0, W * 0.13, 0);
  lFade.addColorStop(0, "rgba(0,0,0,1)"); lFade.addColorStop(1, "rgba(0,0,0,0)");
  fCtx.fillStyle = lFade;
  fCtx.fillRect(0, 0, W * 0.13, H * fadeEndY);

  // Right feather
  const rFade = fCtx.createLinearGradient(W, 0, W * 0.87, 0);
  rFade.addColorStop(0, "rgba(0,0,0,1)"); rFade.addColorStop(1, "rgba(0,0,0,0)");
  fCtx.fillStyle = rFade;
  fCtx.fillRect(W * 0.87, 0, W * 0.13, H * fadeEndY);

  pcCtx.globalCompositeOperation = "destination-in";
  pcCtx.drawImage(fadeCanvas, 0, 0);
}

// ── Strategy A: Transparent-PNG composite (remove.bg result) ─────────────────
// The person PNG already has a perfect transparent background.
// We just scale, position, fade edges, and composite — no pixel analysis needed.
async function compositeWithTransparentPerson(
  bgUrl: string,
  personUrl: string,
  message: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const W = 1024, H = 1792;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) { reject(new Error("Canvas not supported")); return; }

    const bg     = new window.Image();
    const person = new window.Image();
    bg.crossOrigin     = "anonymous";
    person.crossOrigin = "anonymous";

    bg.onload = () => {
      ctx.drawImage(bg, 0, 0, W, H);

      person.onload = () => {
        const PW = person.naturalWidth;
        const PH = person.naturalHeight;

        // Scale person to fill upper ~72% of the card, centred horizontally
        const targetH = H * 0.72;
        const scale   = Math.max(W / PW, targetH / PH);
        const scaledW = PW * scale;
        const scaledH = PH * scale;
        const posX    = (W - scaledW) / 2;
        const posY    = Math.min(0, (targetH - scaledH) / 2) - H * 0.01;

        // Draw transparent person onto an intermediate canvas
        const personCard = document.createElement("canvas");
        personCard.width = W; personCard.height = H;
        const pcCtx = personCard.getContext("2d")!;
        pcCtx.drawImage(person, posX, posY, scaledW, scaledH);

        // Apply geometric fading (bottom fade + side feathers)
        applyPersonFade(personCard, W, H, 0.52, 0.74);

        // Composite onto background
        ctx.drawImage(personCard, 0, 0);

        // Overlays (gradient, badge, text)
        applyOverlays(ctx, W, H, message);

        resolve(canvas.toDataURL("image/jpeg", 0.93));
      };

      person.onerror = () => reject(new Error("Failed to load person PNG"));
      person.src = personUrl;
    };

    bg.onerror = () => reject(new Error("Failed to load background"));
    bg.src = bgUrl;
  });
}

// ── Strategy B: Chroma-key fallback (no remove.bg key) ───────────────────────
// Samples 4 corner regions of the photo to estimate background colour, then
// removes pixels close to that colour via per-pixel distance threshold.
// Works reasonably well for simple/solid backgrounds but may ghost on complex
// indoor backgrounds (patterned cushions, etc.).  Use only as last resort.
async function compositeWithChromaKey(
  bgUrl: string,
  userPhotoDataUrl: string,
  message: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const W = 1024, H = 1792;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) { reject(new Error("Canvas not supported")); return; }

    const bg    = new window.Image();
    const photo = new window.Image();
    bg.crossOrigin = "anonymous";

    bg.onload = () => {
      ctx.drawImage(bg, 0, 0, W, H);

      photo.onload = () => {
        const PW = photo.naturalWidth;
        const PH = photo.naturalHeight;

        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = PW; srcCanvas.height = PH;
        const sCtx = srcCanvas.getContext("2d")!;
        sCtx.drawImage(photo, 0, 0);
        const imgData = sCtx.getImageData(0, 0, PW, PH);
        const px = imgData.data;

        // 4-corner anchors only (avoids sampling person's body at mid-edges)
        const CS = Math.max(20, Math.round(Math.min(PW, PH) * 0.05));
        function regionAvg(x0: number, y0: number, x1: number, y1: number): [number, number, number] {
          let r = 0, g = 0, b = 0, n = 0;
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const i = (y * PW + x) * 4;
              r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
            }
          }
          return n > 0 ? [r / n, g / n, b / n] : [128, 128, 128];
        }
        const anchors: [number, number, number][] = [
          regionAvg(0, 0, CS, CS),
          regionAvg(PW - CS, 0, PW, CS),
          regionAvg(0, PH - CS, CS, PH),
          regionAvg(PW - CS, PH - CS, PW, PH),
        ];

        const THRESH_LO = 30, THRESH_HI = 65;
        const total = PW * PH;
        const rawAlpha = new Float32Array(total);
        for (let i = 0, pi = 0; i < px.length; i += 4, pi++) {
          const r = px[i], g = px[i + 1], b = px[i + 2];
          let minDist = Infinity;
          for (const [ar, ag, ab] of anchors) {
            const d = Math.sqrt((r-ar)**2 + (g-ag)**2 + (b-ab)**2);
            if (d < minDist) minDist = d;
          }
          rawAlpha[pi] = minDist < THRESH_LO ? 0 : minDist > THRESH_HI ? 1
            : (minDist - THRESH_LO) / (THRESH_HI - THRESH_LO);
        }
        // S-curve sharpen
        for (let pi = 0; pi < total; pi++) {
          const a = rawAlpha[pi];
          rawAlpha[pi] = a < 0.5 ? 2*a*a : 1 - 2*(1-a)*(1-a);
        }
        // 3×3 blur
        const smAlpha = new Float32Array(total);
        for (let y = 0; y < PH; y++) {
          for (let x = 0; x < PW; x++) {
            let sum = 0, cnt = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              const nx = x+dx, ny = y+dy;
              if (nx>=0 && nx<PW && ny>=0 && ny<PH) { sum += rawAlpha[ny*PW+nx]; cnt++; }
            }
            smAlpha[y*PW+x] = sum/cnt;
          }
        }

        // Write extracted person
        const personSrc = document.createElement("canvas");
        personSrc.width = PW; personSrc.height = PH;
        const perCtx = personSrc.getContext("2d")!;
        const outData = perCtx.createImageData(PW, PH);
        for (let i = 0, pi = 0; i < px.length; i += 4, pi++) {
          outData.data[i]     = px[i];
          outData.data[i + 1] = px[i + 1];
          outData.data[i + 2] = px[i + 2];
          outData.data[i + 3] = Math.round(smAlpha[pi] * 255);
        }
        perCtx.putImageData(outData, 0, 0);

        // Position on card
        const targetH = H * 0.70;
        const scale   = Math.max(W / PW, targetH / PH);
        const scaledW = PW * scale, scaledH = PH * scale;
        const posX = (W - scaledW) / 2;
        const posY = Math.min(0, (targetH - scaledH) / 2) - H * 0.015;

        const personCard = document.createElement("canvas");
        personCard.width = W; personCard.height = H;
        const pcCtx = personCard.getContext("2d")!;
        pcCtx.drawImage(personSrc, posX, posY, scaledW, scaledH);

        applyPersonFade(personCard, W, H, 0.50, 0.72);
        ctx.drawImage(personCard, 0, 0);
        applyOverlays(ctx, W, H, message);
        resolve(canvas.toDataURL("image/jpeg", 0.93));
      };

      photo.onerror = () => resolve(canvas.toDataURL("image/jpeg", 0.92));
      photo.src = userPhotoDataUrl;
    };

    bg.onerror = () => reject(new Error("Failed to load background"));
    bg.src = bgUrl;
  });
}


const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://sayit-gamma.vercel.app";

const COUNTRY_CODES = [
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+1",   flag: "🇺🇸", name: "US / Canada" },
  { code: "+44",  flag: "🇬🇧", name: "UK" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+65",  flag: "🇸🇬", name: "Singapore" },
  { code: "+61",  flag: "🇦🇺", name: "Australia" },
];

type Category = "couple";
type Step = "location" | "photo" | "generating" | "preview" | "send" | "done";

// Messages shown when user uploaded a photo (background replacement path)
const GENERATING_MESSAGES_PHOTO = [
  "Removing your original background…",
  "Placing you in the scene…",
  "Matching the lighting and colours…",
  "Adding a cinematic touch…",
  "Crafting your masterpiece…",
];

// Messages shown when no photo (background-only DALL-E path)
const GENERATING_MESSAGES_BG = [
  "Teleporting to your chosen destination…",
  "Setting the perfect scene…",
  "Painting with golden light…",
  "Adding a touch of magic…",
  "Crafting your masterpiece…",
];

// ── Loading dots ────────────────────────────────────────────────────────────
function LoadingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-white inline-block"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

export default function CreateAiCardPage() {
  const router   = useRouter();
  const supabase = createClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [step,        setStep]       = useState<Step>("location");
  const [category,    setCategory]   = useState<Category | null>("couple");
  const [location,    setLocation]   = useState<AiLocation | null>(null);
  const [photo,       setPhoto]      = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [message,     setMessage]    = useState("");
  const [genMsgIdx,   setGenMsgIdx]  = useState(0);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [genError,    setGenError]   = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<string>(AI_LOCATION_REGIONS[0]);

  // ── AI note suggestions ────────────────────────────────────────────────────
  const [suggestedNotes,   setSuggestedNotes]   = useState<string[]>([]);
  const [loadingNotes,     setLoadingNotes]     = useState(false);
  const [lastSuggestLocId, setLastSuggestLocId] = useState<string | null>(null);

  async function suggestNotes() {
    if (!location) return;
    setLoadingNotes(true);
    setSuggestedNotes([]);
    setLastSuggestLocId(location.id);
    try {
      const res  = await fetch("/api/suggest-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationName:    location.name,
          locationCountry: location.country,
          locationEmoji:   location.emoji,
        }),
      });
      const data = await res.json();
      setSuggestedNotes(data.notes ?? []);
    } catch {
      setSuggestedNotes([]);
    } finally {
      setLoadingNotes(false);
    }
  }

  // ── Send step state ────────────────────────────────────────────────────────
  const [phone,        setPhone]        = useState("");
  const [countryCode,  setCountryCode]  = useState("+1");
  const [showCC,       setShowCC]       = useState(false);
  const [sending,      setSending]      = useState(false);
  const [sendError,    setSendError]    = useState<string | null>(null);
  const [shortCode,    setShortCode]    = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Photo pick — compress to max 1200px / 0.85 JPEG before storing ─────────
  // No mask needed any more — the person is extracted client-side via chroma-key.
  const handlePhotoChange = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const MAX = 1200;
        let { naturalWidth: w, naturalHeight: h } = img;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (!blob) return;
          const compressed = new File([blob], file.name, { type: "image/jpeg" });
          setPhoto(compressed);
          setPhotoPreview(canvas.toDataURL("image/jpeg", 0.92));
        }, "image/jpeg", 0.85);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Generate card ──────────────────────────────────────────────────────────
  async function generateCard() {
    if (!category || !location) return;
    setStep("generating");
    setGenError(null);

    // Pick loading messages based on whether user uploaded a photo
    const msgs = photo ? GENERATING_MESSAGES_PHOTO : GENERATING_MESSAGES_BG;
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % msgs.length;
      setGenMsgIdx(idx);
    }, 2400);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in to create AI cards");

      // ── Step A: Ask the server to generate the background (DALL-E 3) ─────────
      // When photo is present, the server generates a background-ONLY scene.
      // The person is NEVER sent to any AI model — their pixels stay intact.
      const formData = new FormData();
      formData.append("userId",     user.id);
      formData.append("category",   category);
      formData.append("locationId", location.id);
      formData.append("message",    message);
      // Send photo so the server knows to generate a person-free background.
      // The photo itself is not processed by AI — it's only used as a signal.
      if (photo) formData.append("photo", photo);

      const res = await fetch("/api/generate-ai-card", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "daily_limit") throw new Error(data.message);
        throw new Error(data.error ?? "Generation failed");
      }

      let finalUrl: string = data.imageUrl;

      // ── Step B: Client-side compositing ──────────────────────────────────────
      // Skip if server already composited (Tier 1: gpt-image-1 + accurate mask).
      // Only run when composited=false (Tier 2: transparent PNG, or Tier 3: chroma-key).
      if (!data.composited && photoPreview && data.imageUrl) {
        try {
          let compositeDataUrl: string;

          if (data.personUrl) {
            // ── Strategy A: remove.bg gave us a clean transparent-PNG cutout ──
            // No chroma-key needed — just composite the transparent PNG onto the
            // DALL-E 3 background. Clean edges, any background type, perfect result.
            compositeDataUrl = await compositeWithTransparentPerson(
              data.imageUrl, data.personUrl, message,
            );
          } else {
            // ── Strategy B: No remove.bg key — fall back to chroma-key ────────
            // Quality depends on how uniform the original background is.
            compositeDataUrl = await compositeWithChromaKey(
              data.imageUrl, photoPreview, message,
            );
          }

          // ── Step C: Upload composite for a permanent Supabase URL ─────────────
          try {
            const b64    = compositeDataUrl.split(",")[1];
            const bytes  = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const blob   = new Blob([bytes], { type: "image/jpeg" });
            const upForm = new FormData();
            upForm.append("userId", user.id);
            upForm.append("image",  new File([blob], "composite.jpg", { type: "image/jpeg" }));

            const { data: { session: upSession } } = await supabase.auth.getSession();
            const upRes  = await fetch("/api/upload-composite", {
              method: "POST",
              headers: { "Authorization": `Bearer ${upSession?.access_token ?? ""}` },
              body: upForm,
            });
            const upData = await upRes.json();
            finalUrl = upData.url ?? compositeDataUrl;
          } catch (uploadErr) {
            console.warn("Composite upload failed, using data URL:", uploadErr);
            finalUrl = compositeDataUrl;
          }
        } catch (compositeErr) {
          console.warn("Composite failed, using background only:", compositeErr);
        }
      }

      setGeneratedUrl(finalUrl);
      setStep("preview");
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Something went wrong");
      setStep("photo"); // go back to photo step on error
    } finally {
      clearInterval(interval);
    }
  }

  // ── Send card ──────────────────────────────────────────────────────────────
  async function sendCard() {
    if (!generatedUrl || !phone.trim()) return;
    setSending(true);
    setSendError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      const senderName = profile?.full_name ?? user.email ?? "Someone";
      const fullPhone  = countryCode + phone.trim().replace(/\D/g, "");
      const code       = uuidv4().replace(/-/g, "").slice(0, 12);

      // Look up recipient by phone to get their name + id
      const { data: recipientProfile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("phone", fullPhone)
        .maybeSingle();

      const { error } = await supabase.from("sent_cards").insert({
        sender_id:       user.id,
        recipient_phone: fullPhone,
        recipient_id:    recipientProfile?.id ?? null,
        recipient_name:  recipientProfile?.full_name ?? null,
        template_id:     null,
        message:         message,
        short_code:      code,
        sender_name:     senderName,
        card_type:       "ai-card",
        front_image_url: generatedUrl,
      });

      if (error) throw new Error(error.message);

      // ── Create/upsert a My Circle request for this recipient ──────────
      const { data: myProfile } = await supabase.from("profiles").select("phone").eq("id", user.id).single();
      await supabase.from("circles").upsert({
        sender_id:       user.id,
        sender_phone:    user.phone ?? myProfile?.phone ?? null,
        sender_name:     senderName,
        recipient_phone: fullPhone,
        recipient_id:    recipientProfile?.id ?? null,
        status:          "accepted",
        updated_at:      new Date().toISOString(),
      }, { onConflict: "sender_id,recipient_phone", ignoreDuplicates: true });

      setShortCode(code);
      setStep("done");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  const cardLink = shortCode ? `${BASE_URL}/preview/${shortCode}` : "";

  // ── Back nav ───────────────────────────────────────────────────────────────
  function goBack() {
    if (step === "location") { router.push("/home"); return; }
    if (step === "photo")    { setStep("location"); return; }
    if (step === "preview")  { setStep("photo"); return; }
    if (step === "send")     { setStep("preview"); return; }
  }

  const categoryLocations = category ? getLocationsForCategory(category) : [];
  const availableRegions = AI_LOCATION_REGIONS.filter(r =>
    categoryLocations.some(l => l.region === r)
  );
  // If current activeRegion has no locations for this category, use the first available
  const effectiveRegion = availableRegions.includes(activeRegion) ? activeRegion : (availableRegions[0] ?? activeRegion);
  const filteredLocations = categoryLocations.filter(l => l.region === effectiveRegion);

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {step !== "generating" && step !== "done" && (
        <header className="flex items-center gap-4 px-5 pt-14 pb-4">
          <button
            onClick={goBack}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <ArrowLeft size={18} color="white" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles size={16} color="#FFD700" />
              <span className="text-white font-bold text-base">Couple Card Creator</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {(["location", "photo", "preview", "send"] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className="rounded-full transition-all"
                  style={{
                    width: step === s ? 20 : 6,
                    height: 6,
                    background: (["location","photo","preview","send"] as Step[]).indexOf(step) >= i
                      ? "#FFD700"
                      : "rgba(255,255,255,0.2)",
                  }}
                />
              ))}
            </div>
          </div>
        </header>
      )}

      <AnimatePresence mode="wait">

        {/* ════════════════════════════════════════════════════════════════════
            STEP 1 — LOCATION
        ════════════════════════════════════════════════════════════════════ */}
        {step === "location" && (
          <motion.div
            key="location"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="flex flex-col flex-1 pb-10"
          >
            <div className="px-5 mb-5">
              <h1 className="text-2xl font-bold text-white">Pick a destination</h1>
              <p className="text-white/50 text-sm mt-1">50 exotic locations to set the scene</p>
            </div>

            {/* Region tabs */}
            <div className="flex gap-2 px-5 mb-5 overflow-x-auto no-scrollbar">
              {availableRegions.map(region => (
                <button
                  key={region}
                  onClick={() => setActiveRegion(region)}
                  className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: effectiveRegion === region ? "#FFD700" : "rgba(255,255,255,0.1)",
                    color: effectiveRegion === region ? "#1a1a2e" : "white",
                  }}
                >
                  {region}
                </button>
              ))}
            </div>

            {/* Location grid */}
            <div className="px-5 grid grid-cols-2 gap-3">
              {filteredLocations.map((loc, i) => (
                <motion.button
                  key={loc.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => { setLocation(loc); setSuggestedNotes([]); setMessage(""); setStep("photo"); }}
                  className="relative rounded-2xl p-4 text-left transition-all"
                  style={{
                    background: location?.id === loc.id
                      ? "rgba(255,215,0,0.2)"
                      : "rgba(255,255,255,0.07)",
                    border: location?.id === loc.id
                      ? "2px solid #FFD700"
                      : "2px solid rgba(255,255,255,0.08)",
                    boxShadow: location?.id === loc.id ? "0 0 20px rgba(255,215,0,0.2)" : "none",
                  }}
                >
                  <span className="text-2xl block mb-2">{loc.emoji}</span>
                  <p className="text-white text-sm font-semibold leading-tight">{loc.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">{loc.country}</p>
                  {location?.id === loc.id && (
                    <div
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "#FFD700" }}
                    >
                      <span style={{ fontSize: 10, color: "#1a1a2e" }}>✓</span>
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            STEP 3 — PHOTO + MESSAGE
        ════════════════════════════════════════════════════════════════════ */}
        {step === "photo" && (
          <motion.div
            key="photo"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="flex flex-col flex-1 px-5 pb-10"
          >
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Add your photo</h1>
              <p className="text-white/50 text-sm mt-1">
                AI will place you in{" "}
                <span className="text-yellow-400 font-medium">{location?.name}</span>
              </p>
            </div>

            {/* Photo upload area */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handlePhotoChange(e.target.files[0]); }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative overflow-hidden rounded-3xl mb-5 flex flex-col items-center justify-center"
              style={{
                height: 200,
                background: photoPreview ? "transparent" : "rgba(255,255,255,0.06)",
                border: "2px dashed rgba(255,255,255,0.2)",
              }}
            >
              {photoPreview ? (
                <>
                  <Image
                    src={photoPreview}
                    alt="Your photo"
                    fill
                    className="object-cover rounded-3xl"
                  />
                  <div
                    className="absolute inset-0 rounded-3xl flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.4)" }}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Camera size={24} color="white" />
                      <span className="text-white text-sm font-medium">Tap to change photo</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(255,215,0,0.15)" }}
                  >
                    <Upload size={26} color="#FFD700" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-semibold text-sm">Upload your photo</p>
                    <p className="text-white/40 text-xs mt-1">
                      A photo of you both together
                    </p>
                  </div>
                </div>
              )}
            </button>

            {/* Optional label */}
            <div className="flex items-center gap-2 mb-5">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />
              <span className="text-white/30 text-xs">optional photo</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.1)" }} />
            </div>

            {/* ── Personal message ───────────────────────────────────────── */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-white/70 text-sm font-medium">Personal note</label>
                <button
                  onClick={suggestNotes}
                  disabled={loadingNotes}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                  style={{
                    background: loadingNotes ? "rgba(255,215,0,0.1)" : "rgba(255,215,0,0.18)",
                    border: "1px solid rgba(255,215,0,0.35)",
                    color: "#FFD700",
                  }}
                >
                  {loadingNotes ? (
                    <><div className="w-3 h-3 border-2 border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" /> Generating…</>
                  ) : (
                    <><Wand2 size={12} /> ✨ Suggest a note</>
                  )}
                </button>
              </div>

              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={`Write something romantic for ${location?.name}…`}
                rows={2}
                className="w-full rounded-2xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none resize-none"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1.5px solid rgba(255,255,255,0.12)",
                  caretColor: "#FFD700",
                }}
              />

              {/* AI suggestions */}
              <AnimatePresence>
                {suggestedNotes.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="mt-3 flex flex-col gap-2"
                  >
                    <p className="text-white/40 text-[11px] uppercase tracking-widest font-semibold px-1">
                      {location?.emoji} Tap to use
                    </p>
                    {suggestedNotes.map((note, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        onClick={() => setMessage(note)}
                        className="w-full text-left px-4 py-3 rounded-2xl text-sm transition-all active:scale-[0.98]"
                        style={{
                          background: message === note
                            ? "rgba(255,215,0,0.18)"
                            : "rgba(255,255,255,0.06)",
                          border: message === note
                            ? "1.5px solid rgba(255,215,0,0.45)"
                            : "1.5px solid rgba(255,255,255,0.08)",
                          color: message === note ? "#FFD700" : "rgba(255,255,255,0.75)",
                          fontStyle: "italic",
                        }}
                      >
                        &ldquo;{note}&rdquo;
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mb-4" />

            {/* Error */}
            {genError && (
              <div className="mb-4 px-4 py-3 rounded-2xl" style={{ background: "rgba(255,107,107,0.2)", border: "1px solid rgba(255,107,107,0.4)" }}>
                <p className="text-red-300 text-sm">{genError}</p>
              </div>
            )}

            {/* Generate button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={generateCard}
              className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-base"
              style={{ background: "linear-gradient(135deg, #FFD700, #FF9500)", color: "#1a1a2e", boxShadow: "0 8px 24px rgba(255,215,0,0.35)" }}
            >
              <Sparkles size={20} />
              Generate My Card
            </motion.button>

            <p className="text-center text-white/30 text-xs mt-3">
              ✨ Takes about 15 seconds · Powered by DALL-E 3
            </p>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            STEP 4 — GENERATING (loading screen)
        ════════════════════════════════════════════════════════════════════ */}
        {step === "generating" && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col flex-1 items-center justify-center px-5 pb-10"
          >
            {/* Animated gradient orb */}
            <div className="relative mb-10">
              <motion.div
                className="w-40 h-40 rounded-full"
                style={{ background: "linear-gradient(135deg, #FFD700, #FF6B8A, #9B59B6)" }}
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute inset-4 rounded-full flex items-center justify-center"
                style={{ background: "#1a1a2e" }}
              >
                <motion.span
                  className="text-4xl"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ❤️
                </motion.span>
              </motion.div>
            </div>

            {/* Location badge */}
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full mb-6"
              style={{ background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.3)" }}
            >
              <span>{location?.emoji}</span>
              <span className="text-yellow-400 text-sm font-semibold">{location?.name}, {location?.country}</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={genMsgIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-white font-medium text-center text-lg mb-3"
              >
                {(photo ? GENERATING_MESSAGES_PHOTO : GENERATING_MESSAGES_BG)[genMsgIdx]}
              </motion.p>
            </AnimatePresence>

            <div className="mb-8">
              <LoadingDots />
            </div>

            <p className="text-white/30 text-sm text-center">
              {photo
                ? <>AI is placing you in the scene<br />This takes about 20–30 seconds</>
                : <>Creating your Couple Card<br />This takes about 15 seconds</>
              }
            </p>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            STEP 5 — PREVIEW
        ════════════════════════════════════════════════════════════════════ */}
        {step === "preview" && generatedUrl && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col flex-1 px-5 pb-10"
          >
            <div className="mb-5">
              <h1 className="text-2xl font-bold text-white">Your Couple Card ✨</h1>
              <p className="text-white/50 text-sm mt-1">
                {location?.name} · Couple Card
              </p>
            </div>

            {/* Generated card image */}
            <motion.div
              className="relative rounded-3xl overflow-hidden mb-5 shadow-2xl"
              style={{ aspectRatio: "9/16", maxHeight: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Image
                src={generatedUrl}
                alt="AI Generated Card"
                fill
                className="object-cover"
                unoptimized
              />
              {/* Message is baked into the canvas composite */}
            </motion.div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep("send")}
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-base"
                style={{ background: "linear-gradient(135deg, #FFD700, #FF9500)", color: "#1a1a2e", boxShadow: "0 8px 24px rgba(255,215,0,0.35)" }}
              >
                <Send size={18} />
                Send this card
              </motion.button>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => { setGeneratedUrl(null); setStep("photo"); }}
                className="w-full py-3 rounded-2xl font-semibold text-sm"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
              >
                Regenerate
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            STEP 6 — SEND
        ════════════════════════════════════════════════════════════════════ */}
        {step === "send" && (
          <motion.div
            key="send"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="flex flex-col flex-1 px-5 pb-10"
          >
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white">Who's it for?</h1>
              <p className="text-white/50 text-sm mt-1">Enter their phone number to send the card</p>
            </div>

            {/* Thumbnail preview */}
            {generatedUrl && (
              <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="relative w-14 h-20 rounded-xl overflow-hidden flex-shrink-0">
                  <Image src={generatedUrl} alt="Card preview" fill className="object-cover" unoptimized />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Couple Card</p>
                  <p className="text-white/50 text-xs mt-0.5">{location?.emoji} {location?.name}</p>
                </div>
              </div>
            )}

            {/* Phone input */}
            <label className="text-white/70 text-sm font-medium block mb-2">Phone number</label>
            <div
              className="flex items-center gap-2 rounded-2xl mb-5 px-3 py-1"
              style={{ background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.12)" }}
            >
              {/* Country code dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowCC(!showCC)}
                  className="flex items-center gap-1 py-3 pr-2"
                >
                  <span className="text-lg">{COUNTRY_CODES.find(c => c.code === countryCode)?.flag}</span>
                  <span className="text-white/70 text-sm">{countryCode}</span>
                  <ChevronDown size={14} color="rgba(255,255,255,0.4)" />
                </button>
                {showCC && (
                  <div
                    className="absolute top-full left-0 rounded-2xl overflow-hidden z-50 min-w-[180px]"
                    style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
                  >
                    {COUNTRY_CODES.map(cc => (
                      <button
                        key={cc.code}
                        onClick={() => { setCountryCode(cc.code); setShowCC(false); }}
                        className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-white/5"
                      >
                        <span>{cc.flag}</span>
                        <span className="text-white/80 text-sm">{cc.name}</span>
                        <span className="text-white/40 text-sm ml-auto">{cc.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.1)" }} />
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="Phone number"
                className="flex-1 py-3 pl-2 bg-transparent text-white text-base outline-none"
                style={{ caretColor: "#FFD700" }}
              />
            </div>

            {sendError && (
              <div className="mb-4 px-4 py-3 rounded-2xl" style={{ background: "rgba(255,107,107,0.2)", border: "1px solid rgba(255,107,107,0.4)" }}>
                <p className="text-red-300 text-sm">{sendError}</p>
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={sendCard}
              disabled={sending || phone.length < 7}
              className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-base"
              style={{
                background: phone.length >= 7
                  ? "linear-gradient(135deg, #FFD700, #FF9500)"
                  : "rgba(255,255,255,0.1)",
                color: phone.length >= 7 ? "#1a1a2e" : "rgba(255,255,255,0.3)",
                boxShadow: phone.length >= 7 ? "0 8px 24px rgba(255,215,0,0.35)" : "none",
              }}
            >
              {sending ? <LoadingDots /> : <><Send size={18} /> Send Card</>}
            </motion.button>
          </motion.div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            STEP 7 — DONE
        ════════════════════════════════════════════════════════════════════ */}
        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col min-h-dvh items-center justify-center px-8 gap-6"
            style={{ background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}
          >
            {/* Animated ping ring + checkmark */}
            <div style={{ position: "relative", width: 96, height: 96 }}>
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: "linear-gradient(135deg,#FF6B8A40,#9B59B640)" }}
              />
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center shadow-xl relative"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}
              >
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800">Card sent! 🎉</h2>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                Your Couple Card is on its way ✨<br />
                They&apos;ll see it as soon as they tap the link 💌
              </p>
            </div>

            {/* Card thumbnail */}
            {generatedUrl && (
              <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 w-full">
                <div className="relative w-10 h-14 rounded-xl overflow-hidden flex-shrink-0">
                  <Image src={generatedUrl} alt="AI card" fill className="object-cover" sizes="40px" unoptimized />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400">Couple Card · {location?.name}</p>
                  <p className="font-semibold text-gray-800 text-sm">❤️ Couple Card</p>
                </div>
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#22c55e" }} />
              </div>
            )}

            {/* CTAs */}
            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => router.push("/home")}
                className="w-full py-4 rounded-2xl text-white font-semibold shadow-md"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}
              >
                Send Another Card
              </button>
              <button
                onClick={() => router.push("/history")}
                className="w-full py-4 rounded-2xl bg-white border border-gray-100 text-gray-600 font-semibold shadow-sm"
              >
                View Sent Cards
              </button>
            </div>

            {/* Create another — subtle link */}
            <button
              onClick={() => {
                setStep("location");
                setCategory("couple");
                setLocation(null);
                setPhoto(null);
                setPhotoPreview(null);
                setMessage("");
                setGeneratedUrl(null);
                setShortCode(null);
                setPhone("");
                setGenError(null);
              }}
              className="text-sm font-semibold"
              style={{ color: "#9B59B6" }}
            >
              Create another Couple Card ✨
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
