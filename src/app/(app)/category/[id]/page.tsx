"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getCategoryBySlug, getTemplatesByCategory, type DBCategory, type DBTemplate } from "@/lib/supabase-data";
import { ArrowLeft } from "lucide-react";

// Card thumbnail with shimmer skeleton until image loads
function CardThumb({ tmpl, categoryName, subcatName }: {
  tmpl: DBTemplate;
  categoryName: string;
  subcatName?: string;
}) {
  const [imgLoaded, setImgLoaded] = React.useState(false);
  return (
    <Link href={`/card/${tmpl.id}`}>
      <div className="rounded-2xl overflow-hidden shadow-sm aspect-[3/4] relative group"
        style={{ background: imgLoaded ? "transparent" : "#e5e7eb" }}>
        {/* Shimmer overlay — hidden once image loads */}
        {!imgLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200" />
        )}
        <Image
          src={tmpl.front_image_url}
          alt={tmpl.title}
          fill
          className="object-cover group-active:scale-105 transition-transform duration-300"
          sizes="(max-width: 430px) 50vw, 200px"
          onLoad={() => setImgLoaded(true)}
        />
        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <p className="text-white text-xs font-semibold truncate">{tmpl.title}</p>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-2 h-2 rounded-full" style={{ background: tmpl.color_accent }} />
            <span className="text-white/60 text-[10px]">{subcatName ?? categoryName}</span>
          </div>
        </div>
        <div className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-0.5 opacity-0 group-active:opacity-100 transition-opacity">
          <span className="text-[10px] font-semibold text-gray-600">Open</span>
        </div>
      </div>
    </Link>
  );
}

export default function CategoryPage() {
  const params    = useParams();
  const router    = useRouter();
  const slug      = params.id as string;

  const [category,     setCategory]     = useState<DBCategory | null>(null);
  const [allTemplates, setAllTemplates] = useState<DBTemplate[]>([]);
  const [activeSubcat, setActiveSubcat] = useState<string>("all");
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    getCategoryBySlug(slug).then(cat => {
      setCategory(cat);
      if (cat) {
        getTemplatesByCategory(cat.id).then(tmpl => {
          setAllTemplates(tmpl);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, [slug]);

  const templates = allTemplates.filter(t =>
    activeSubcat === "all" || t.subcategory_id === activeSubcat
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
        <p className="text-gray-400">Category not found</p>
        <button onClick={() => router.push("/home")} className="text-pink-500 font-semibold">← Home</button>
      </div>
    );
  }

  // Paw Moments has its own special flow (photo collage)
  if (slug === "paw-moments") {
    return <PawMomentsPage gradient_from={category.gradient_from} gradient_to={category.gradient_to} />;
  }

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="relative flex flex-col px-5 pt-14 pb-5 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${category.gradient_from}, ${category.gradient_to})` }}>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute top-10 right-10 w-24 h-24 rounded-full bg-white/10" />

        {/* Back button — in flow, not absolute */}
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center mb-4 z-10 self-start">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="z-10">
          <h1 className="text-white text-3xl font-bold">{category.name}</h1>
        </div>
      </div>

      {/* ── Subcategory filter pills ─────────────────────────────── */}
      {category.subcategories && category.subcategories.length > 0 && (
        <div className="flex gap-2 px-5 pt-4 pb-3 overflow-x-auto">
          <FilterPill label="All" active={activeSubcat === "all"} onClick={() => setActiveSubcat("all")}
            gradient_from={category.gradient_from} gradient_to={category.gradient_to} />
          {category.subcategories.map(sub => (
            <FilterPill key={sub.id} label={`${sub.icon} ${sub.name}`}
              active={activeSubcat === sub.id}
              onClick={() => setActiveSubcat(sub.id)}
              gradient_from={category.gradient_from} gradient_to={category.gradient_to} />
          ))}
        </div>
      )}

      {/* ── Template grid ────────────────────────────────────────── */}
      <div className="px-5 pt-2 pb-6">

        {/* ── Create with my photo ─────────────────────────────── */}
        {slug !== "paw-moments" && (
          <Link href={`/custom-card/${category.slug}`}>
            <div className="flex items-center gap-4 rounded-2xl px-5 py-4 mb-4 shadow-sm border"
              style={{
                background: `linear-gradient(135deg, ${category.gradient_from}12, ${category.gradient_to}08)`,
                borderColor: `${category.gradient_from}40`,
              }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm"
                style={{ background: `linear-gradient(135deg, ${category.gradient_from}, ${category.gradient_to})` }}>
                📸
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-800">Create your card with your pictures</p>
                <p className="text-xs text-gray-400 mt-0.5">Use your own photos as the card background</p>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </div>
          </Link>
        )}

        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <span className="text-5xl">{category.icon}</span>
            <p className="text-gray-400 text-sm">No cards yet in this category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {templates.map(tmpl => (
              <CardThumb
                key={tmpl.id}
                tmpl={tmpl}
                categoryName={category.name}
                subcatName={category.subcategories?.find(s => s.id === tmpl.subcategory_id)?.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Filter Pill ───────────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick, gradient_from, gradient_to }: {
  label: string; active: boolean; onClick: () => void;
  gradient_from: string; gradient_to: string;
}) {
  return (
    <button onClick={onClick} className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all"
      style={active
        ? { background: `linear-gradient(135deg,${gradient_from},${gradient_to})`, color: "#fff", borderColor: "transparent" }
        : { background: "#fff", color: "#888", borderColor: "#eee" }}>
      {label}
    </button>
  );
}

// ── Frame types ───────────────────────────────────────────────────────────────
type FrameType = "wooden" | "film" | "polaroid" | "gold" | "minimal";

const FRAMES: { id: FrameType; label: string; emoji: string; thumbBg: string; thumbBorder: string }[] = [
  { id: "wooden",   label: "Wooden",   emoji: "🪵", thumbBg: "linear-gradient(135deg,#7A4F2D,#9B6B4A)", thumbBorder: "#5C3317" },
  { id: "film",     label: "Film",     emoji: "🎞️", thumbBg: "linear-gradient(135deg,#1a1a2e,#16213e)",  thumbBorder: "#e94560" },
  { id: "polaroid", label: "Polaroid", emoji: "🤍", thumbBg: "#ffffff",                                   thumbBorder: "#ddd" },
  { id: "gold",     label: "Gold",     emoji: "✨", thumbBg: "linear-gradient(135deg,#C8A45A,#F5D78A)",  thumbBorder: "#A07830" },
  { id: "minimal",  label: "Minimal",  emoji: "🖤", thumbBg: "#fafafa",                                   thumbBorder: "#222" },
];

// ── Adaptive collage grid — graceful layout for 1–5 photos ───────────────────
function CollageGrid({ photos, imgFilter = "" }: { photos: string[]; imgFilter?: string }) {
  const n = photos.length;
  const imgStyle: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block", filter: imgFilter };
  const cell = (p: string, i: number) => (
    <div key={i} style={{ overflow: "hidden", borderRadius: 2 }}>
      <img src={p} alt="" style={imgStyle} />
    </div>
  );

  if (n === 0) return null;

  // 1 photo — full frame
  if (n === 1) return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <img src={photos[0]} alt="" style={imgStyle} />
    </div>
  );

  // 2 photos — side by side equal columns
  if (n === 2) return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, width: "100%", height: "100%" }}>
      {photos.map(cell)}
    </div>
  );

  // 3 photos — 1 large on top, 2 equal below
  if (n === 3) return (
    <div style={{ display: "grid", gridTemplateRows: "1.4fr 1fr", gap: 3, width: "100%", height: "100%" }}>
      {cell(photos[0], 0)}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
        {cell(photos[1], 1)}
        {cell(photos[2], 2)}
      </div>
    </div>
  );

  // 4 photos — 2×2 equal grid
  if (n === 4) return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3, width: "100%", height: "100%" }}>
      {photos.map(cell)}
    </div>
  );

  // 5 photos — 3 on top + 2 on bottom, equal row heights
  return (
    <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 3, width: "100%", height: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
        {photos.slice(0, 3).map(cell)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
        {photos.slice(3, 5).map((p, i) => cell(p, i + 3))}
      </div>
    </div>
  );
}

// ── Framed collage — renders photos inside the chosen frame style ─────────────
function FramedCollage({ photos, frame, height = 320 }: { photos: string[]; frame: FrameType; height?: number }) {
  const empty = photos.length === 0;

  // ── Wooden ────────────────────────────────────────────────────────────────
  if (frame === "wooden") {
    return (
      <div>
        <div style={{
          position: "relative", width: "100%", height,
          background: "linear-gradient(135deg,#7A4F2D 0%,#9B6B4A 15%,#5C3317 35%,#8B5E3C 55%,#6B3F1F 75%,#A07850 100%)",
          borderRadius: 8, padding: 14,
          boxShadow: "3px 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.25)"
        }}>
          <div style={{ width: "100%", height: "100%", borderRadius: 4, background: "#1E0A00", boxShadow: "inset 0 3px 10px rgba(0,0,0,0.8)", overflow: "hidden" }}>
            {empty
              ? <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#6B4423" }}>
                  <span style={{ fontSize: 36 }}>🐾</span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>Your photos will appear here</span>
                </div>
              : <CollageGrid photos={photos} imgFilter="sepia(15%) contrast(1.05)" />
            }
          </div>
          {/* Wood grain overlay */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: "repeating-linear-gradient(88deg,transparent 0,transparent 5px,rgba(0,0,0,0.025) 5px,rgba(0,0,0,0.025) 6px)", pointerEvents: "none" }} />
          {/* Brass nails */}
          {([{ top: 7, left: 7 }, { top: 7, right: 7 }, { bottom: 7, left: 7 }, { bottom: 7, right: 7 }] as React.CSSProperties[]).map((p, i) => (
            <div key={i} style={{ position: "absolute", ...p, width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%,#D4B07A,#6B4020)", boxShadow: "0 2px 4px rgba(0,0,0,0.6)", zIndex: 3 }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <div style={{ background: "linear-gradient(135deg,#C8A45A,#A07830)", borderRadius: 4, padding: "4px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
            <span style={{ fontSize: 9, color: "#FFF3D0", letterSpacing: 3, fontFamily: "Georgia,serif" }}>PAW MOMENTS</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Film strip ────────────────────────────────────────────────────────────
  if (frame === "film") {
    const sprocketCount = 6;
    return (
      <div>
        <div style={{
          position: "relative", width: "100%", height,
          background: "linear-gradient(180deg,#0f0f0f,#1a1a2e)",
          borderRadius: 6,
          boxShadow: "0 4px 20px rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center"
        }}>
          {/* Left sprocket strip */}
          <div style={{ width: 18, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", padding: "8px 0", flexShrink: 0 }}>
            {Array.from({ length: sprocketCount }).map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: "#e94560", boxShadow: "0 0 4px #e94560" }} />
            ))}
          </div>
          {/* Photo area */}
          <div style={{ flex: 1, height: "calc(100% - 20px)", margin: "10px 0", borderRadius: 2, overflow: "hidden", background: "#111" }}>
            {empty
              ? <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#444" }}>
                  <span style={{ fontSize: 36 }}>🎞️</span>
                  <span style={{ fontSize: 12 }}>Your photos will appear here</span>
                </div>
              : <CollageGrid photos={photos} imgFilter="contrast(1.1) saturate(0.85)" />
            }
          </div>
          {/* Right sprocket strip */}
          <div style={{ width: 18, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", padding: "8px 0", flexShrink: 0 }}>
            {Array.from({ length: sprocketCount }).map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: "#e94560", boxShadow: "0 0 4px #e94560" }} />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <span style={{ fontSize: 9, color: "#e94560", letterSpacing: 3, fontFamily: "monospace", fontWeight: 700 }}>PAW MOMENTS</span>
        </div>
      </div>
    );
  }

  // ── Polaroid ──────────────────────────────────────────────────────────────
  if (frame === "polaroid") {
    return (
      <div style={{ background: "#fff", borderRadius: 4, padding: "14px 14px 42px", boxShadow: "0 8px 30px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)", position: "relative" }}>
        <div style={{ height: height - 56, background: "#f0f0f0", overflow: "hidden", borderRadius: 2 }}>
          {empty
            ? <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#aaa" }}>
                <span style={{ fontSize: 36 }}>📷</span>
                <span style={{ fontSize: 12 }}>Your photos will appear here</span>
              </div>
            : <CollageGrid photos={photos} imgFilter="brightness(0.97) saturate(1.1)" />
          }
        </div>
        <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center" }}>
          <span style={{ fontSize: 11, color: "#888", fontFamily: "cursive, Georgia, serif", letterSpacing: 1 }}>Paw Moments 🐾</span>
        </div>
      </div>
    );
  }

  // ── Gold ──────────────────────────────────────────────────────────────────
  if (frame === "gold") {
    return (
      <div>
        <div style={{
          position: "relative", width: "100%", height,
          background: "linear-gradient(135deg,#B8860B,#FFD700,#C8A45A,#FFD700,#B8860B)",
          borderRadius: 6, padding: 16,
          boxShadow: "0 4px 20px rgba(184,134,11,0.5), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2)"
        }}>
          {/* Inner gold border */}
          <div style={{
            position: "absolute", inset: 6, borderRadius: 4,
            border: "1px solid rgba(255,255,255,0.5)",
            pointerEvents: "none", zIndex: 2
          }} />
          <div style={{ width: "100%", height: "100%", borderRadius: 2, overflow: "hidden", background: "#fff8e7" }}>
            {empty
              ? <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#A07830" }}>
                  <span style={{ fontSize: 36 }}>✨</span>
                  <span style={{ fontSize: 12 }}>Your photos will appear here</span>
                </div>
              : <CollageGrid photos={photos} imgFilter="brightness(1.02) contrast(1.05)" />
            }
          </div>
          {/* Corner ornaments */}
          {([{ top: 4, left: 4 }, { top: 4, right: 4 }, { bottom: 4, left: 4 }, { bottom: 4, right: 4 }] as React.CSSProperties[]).map((p, i) => (
            <div key={i} style={{ position: "absolute", ...p, width: 14, height: 14, zIndex: 3, fontSize: 10, lineHeight: "14px", textAlign: "center" }}>✦</div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <div style={{ background: "linear-gradient(135deg,#C8A45A,#FFD700,#C8A45A)", borderRadius: 4, padding: "3px 16px", boxShadow: "0 1px 4px rgba(184,134,11,0.4)" }}>
            <span style={{ fontSize: 9, color: "#5a3e00", letterSpacing: 3, fontFamily: "Georgia,serif", fontWeight: 700 }}>PAW MOMENTS</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Minimal ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{
        position: "relative", width: "100%", height,
        background: "#fff",
        border: "2px solid #111",
        borderRadius: 4,
        padding: 10,
        boxShadow: "4px 4px 0px #111"
      }}>
        <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "#f5f5f5" }}>
          {empty
            ? <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#333" }}>
                <span style={{ fontSize: 36 }}>🐾</span>
                <span style={{ fontSize: 12 }}>Your photos will appear here</span>
              </div>
            : <CollageGrid photos={photos} />
          }
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
        <span style={{ fontSize: 9, color: "#111", letterSpacing: 3, fontFamily: "monospace", fontWeight: 900, textTransform: "uppercase" }}>Paw Moments</span>
      </div>
    </div>
  );
}

// ── Paw Moments special page ──────────────────────────────────────────────────
function PawMomentsPage({ gradient_from, gradient_to }: { gradient_from: string; gradient_to: string }) {
  const router = useRouter();
  const [photos,     setPhotos]     = React.useState<string[]>([]);
  const [message,    setMessage]    = React.useState("");
  const [step,       setStep]       = React.useState<"pick" | "preview">("pick");
  const [photoError, setPhotoError] = React.useState("");
  const [frame,      setFrame]      = React.useState<FrameType>("wooden");

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 5) {
      setPhotoError("Please select up to 5 photos only.");
      e.target.value = "";
      return;
    }
    setPhotoError("");
    const readers = files.slice(0, 5).map(f => new Promise<string>(resolve => {
      const r = new FileReader();
      r.onload = ev => resolve(ev.target?.result as string);
      r.readAsDataURL(f);
    }));
    Promise.all(readers).then(urls => setPhotos(urls));
  }

  function compressImage(dataUrl: string, maxSize = 600): Promise<string> {
    return new Promise(resolve => {
      const img = document.createElement("img");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.src = dataUrl;
    });
  }

  async function handleSend() {
    try {
      const compressed = await Promise.all(photos.map(p => compressImage(p)));
      sessionStorage.setItem("paw_photos", JSON.stringify(compressed));
      sessionStorage.setItem("paw_message", message);
      sessionStorage.setItem("paw_frame", frame);
    } catch {
      sessionStorage.setItem("paw_photos", "[]");
      sessionStorage.setItem("paw_message", message);
      sessionStorage.setItem("paw_frame", frame);
    }
    router.push("/send?type=paw-moments");
  }

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "linear-gradient(160deg,#F5EDE0,#EDD9C0)" }}>
      {/* Header */}
      <div className="relative flex flex-col px-5 pt-14 pb-5 overflow-hidden" style={{ background: `linear-gradient(135deg,${gradient_from},${gradient_to})` }}>
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center mb-4 z-10 self-start">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="z-10">
          <p className="text-white/70 text-xs font-medium">🐾 Special category</p>
          <h1 className="text-white text-3xl font-bold">Paw Moments</h1>
          <p className="text-white/70 text-xs mt-1">Share pet photos as a beautiful collage</p>
        </div>
      </div>

      <div className="px-5 py-6 flex flex-col gap-5">
        {/* ── Pick step ── */}
        {step === "pick" && (
          <>
            {/* Frame style picker */}
            <div className="rounded-3xl p-5 shadow-sm" style={{ background: "#FAF3E8", border: "1px solid #D4B896" }}>
              <p className="font-bold mb-1" style={{ color: "#5C3317", fontFamily: "Georgia,serif" }}>Choose a Frame Style</p>
              <p className="text-xs mb-4" style={{ color: "#8B6347" }}>Pick the look for your collage</p>

              <div className="grid grid-cols-5 gap-2">
                {FRAMES.map(f => (
                  <button key={f.id} onClick={() => setFrame(f.id)} className="flex flex-col items-center gap-1.5">
                    <div style={{
                      width: "100%", aspectRatio: "1/1", borderRadius: 8,
                      background: f.thumbBg,
                      border: frame === f.id ? `2.5px solid ${gradient_from}` : `2px solid ${f.thumbBorder}`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                      boxShadow: frame === f.id ? `0 0 0 2px ${gradient_from}33` : "none",
                      transition: "all 0.15s",
                    }}>
                      {f.emoji}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: frame === f.id ? gradient_from : "#8B6347", letterSpacing: 0.3 }}>
                      {f.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live collage preview */}
            <div className="rounded-3xl p-5 shadow-sm" style={{ background: "#FAF3E8", border: "1px solid #D4B896" }}>
              <p className="font-bold mb-1" style={{ color: "#5C3317", fontFamily: "Georgia,serif" }}>Your Paw Moments Collage</p>
              <p className="text-xs mb-4" style={{ color: "#8B6347" }}>Add up to 5 photos — max 5 images</p>

              <FramedCollage photos={photos} frame={frame} />

              {/* Photo picker button */}
              <label className="block mt-4">
                <div className="flex items-center justify-center gap-2 py-3 rounded-2xl cursor-pointer transition-colors"
                  style={{ border: `2px dashed ${gradient_from}`, background: "rgba(255,255,255,0.5)" }}>
                  <span style={{ fontSize: 18 }}>📷</span>
                  <span className="text-sm font-semibold" style={{ color: gradient_from }}>
                    {photos.length === 0 ? "Choose Photos (up to 5)" : `${photos.length} photo${photos.length > 1 ? "s" : ""} selected — tap to change`}
                  </span>
                </div>
                <input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
              </label>
              {photoError && (
                <p className="text-xs mt-2 text-center font-semibold" style={{ color: "#C0392B" }}>⚠️ {photoError}</p>
              )}
            </div>

            {/* Message */}
            <div className="rounded-3xl p-5 shadow-sm" style={{ background: "#FAF3E8", border: "1px solid #D4B896" }}>
              <label className="text-xs font-semibold mb-2 block" style={{ color: "#8B6347", letterSpacing: 1 }}>A LITTLE NOTE</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Meet my best friend! 🐶"
                rows={3}
                className="w-full px-4 py-3 rounded-2xl text-sm focus:outline-none resize-none"
                style={{ background: "#FBF5EC", border: "1px solid #D4B896", fontFamily: "Georgia,serif", color: "#5C3317" }}
              />
            </div>

            {photos.length > 0 && (
              <button onClick={() => setStep("preview")}
                className="w-full py-4 rounded-2xl text-white font-semibold shadow-md"
                style={{ background: `linear-gradient(135deg,${gradient_from},${gradient_to})` }}>
                Preview →
              </button>
            )}
          </>
        )}

        {/* ── Preview step ── */}
        {step === "preview" && (
          <>
            <div className="rounded-3xl p-5 shadow-sm" style={{ background: "#FAF3E8", border: "1px solid #D4B896" }}>
              <p className="font-bold mb-4" style={{ color: "#5C3317", fontFamily: "Georgia,serif" }}>Preview</p>
              <FramedCollage photos={photos} frame={frame} height={360} />
              {message && (
                <div className="mt-4 px-4 py-3 rounded-2xl" style={{ background: "rgba(139,94,60,0.08)" }}>
                  <p className="text-sm" style={{ color: "#5C3317", fontFamily: "Georgia,serif", fontStyle: "italic" }}>{message}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep("pick")}
                className="flex-1 py-4 rounded-2xl font-semibold text-sm"
                style={{ border: "1px solid #D4B896", color: "#8B6347", background: "transparent" }}>
                ← Back
              </button>
              <button onClick={handleSend}
                className="flex-1 py-4 rounded-2xl text-white font-semibold text-sm shadow-md"
                style={{ background: `linear-gradient(135deg,${gradient_from},${gradient_to})` }}>
                Send 🐾
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
