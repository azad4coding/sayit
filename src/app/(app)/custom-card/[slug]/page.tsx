"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { getCategoryBySlug, type DBCategory } from "@/lib/supabase-data";

const CARD_W  = 320;   // closed card face — matches /card/[id] CARD_W
const CARD_H  = 450;   // card height      — matches /card/[id] CARD_H
const OPEN_W  = 348;   // open spread      — matches /card/[id] OPEN_W
const PANEL_W = 174;   // each inner panel when open (≈ OPEN_W / 2)

// ── Large quote pools — 3 picked randomly each render ────────────────────────
function OrnamentLine({ color = "#C9A84C" }: { color?: string }) {
  return (
    <svg viewBox="0 0 140 12" style={{ width: 140, height: 12 }} xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="6" x2="60" y2="6" stroke={color} strokeWidth="0.8" opacity="0.6" />
      <polygon points="70,2 74,6 70,10 66,6" fill={color} opacity="0.8" />
      <line x1="80" y1="6" x2="140" y2="6" stroke={color} strokeWidth="0.8" opacity="0.6" />
    </svg>
  );
}

// Shared no-tap-highlight style for clickable panels
const tapStyle: React.CSSProperties = {
  WebkitTapHighlightColor: "transparent",
  outline: "none",
  userSelect: "none",
  cursor: "pointer",
};

// Fallback values while Supabase category loads
const FALLBACK: Pick<DBCategory, "id" | "name" | "icon" | "gradient_from" | "gradient_to" | "slug"> = {
  id: "", name: "Greeting", icon: "💌", gradient_from: "#C9A84C", gradient_to: "#B8892A", slug: "occasions",
};

// ── Left-panel mood quotes by category slug ───────────────────────────────────
const CUSTOM_QUOTES: Record<string, string[]> = {
  romance:          ["Some feelings\ndefy all words. 💕", "You are\nmy favourite thought. ❤️", "Love, quietly\nand completely. 🌹"],
  occasions:        ["Thinking of you,\nwith warmth. 💌", "A little love,\nsent your way. 🌸", "Because you matter\nmore than you know. ✨"],
  holidays:         ["Wishing you warmth\nand wonder. ✨", "The best moments\nare shared ones. 🌟", "Joy to you\nand all you love. 💌"],
  birthday:         ["Another year\nof being wonderful. 🎂", "Today belongs\nentirely to you. 🎉", "Celebrating you,\nnow and always. ✨"],
  vibes:            ["Good energy,\nalways. ✨", "This one's\nfor you. 💫", "You are\nthe vibe. 🌟"],
  "thank-you":      ["Gratitude is\nthe warmest feeling. 🙏", "Thank you,\nfrom the heart. 💛", "What you did\nmeant everything. 🌸"],
  "morning-wishes": ["A new day,\njust for you. ☀️", "Rise softly.\nThis day is yours. 🌅", "Morning sunshine,\nsent with love. ☀️"],
  invitations:      ["Something special\nis happening. 🎉", "You're invited\nto a moment. ✨", "Come celebrate\nwith us. 💌"],
  "paw-moments":    ["Not all angels\nhave wings. 🐾", "Home is where\nthe paw prints are.", "A pet is\na heartbeat at your feet."],
};

function getCustomQuote(slug: string): string {
  const pool = CUSTOM_QUOTES[slug] ?? CUSTOM_QUOTES["occasions"];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function CustomCardPage() {
  const params   = useParams();
  const router   = useRouter();
  const slug     = params.slug as string;

  const [category, setCategory] = useState<DBCategory | null>(null);

  useEffect(() => {
    getCategoryBySlug(slug).then(setCategory);
  }, [slug]);

  // Use loaded category or fallback so UI renders immediately
  const cat      = category ?? { ...FALLBACK, slug };
  const gradFrom = cat.gradient_from;
  const gradTo   = cat.gradient_to;

  const [bgPhoto,  setBgPhoto]  = useState<string | null>(null);
  type CardView = 'front' | 'open' | 'back';
  const [view,     setView]     = useState<CardView>('front');
  const [message,  setMessage]  = useState("");
  const [sender,   setSender]   = useState("");
  const [moodQuote] = useState(() => getCustomQuote(slug));

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setBgPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function compressImage(dataUrl: string, maxSize = 800): Promise<string> {
    return new Promise(resolve => {
      const img = document.createElement("img");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = dataUrl;
    });
  }

  async function handleSend() {
    if (!bgPhoto) return;
    const compressed = await compressImage(bgPhoto);
    sessionStorage.setItem("custom_bg_photo", compressed);
    sessionStorage.setItem("custom_message", message);
    sessionStorage.setItem("custom_category_id", cat.id);
    router.push(`/send?type=custom-card&category=${slug}`);
  }

  const paperBg = "linear-gradient(170deg,#FFFCF8,#FDF8F2)";
  const linesBg = `repeating-linear-gradient(transparent,transparent 23px,${gradFrom}15 24px)`;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% 40%,#FDF6EE,#F7EBE0,#F0DDD0)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px 8px 40px", fontFamily: "Georgia,serif", position: "relative",
    }}>

      {/* ── Back button (top-left, same as template card) ── */}
      <button
        onClick={() => { if (view === 'back') setView('open'); else if (view === 'open') setView('front'); else router.back(); }}
        style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 44px) + 10px)", left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.8)", backdropFilter: "blur(8px)", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", WebkitTapHighlightColor: "transparent", zIndex: 30 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#6b7280" }}>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>

      {/* ── Photo picker (before photo chosen) ── */}
      {!bgPhoto && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ width: "100%", maxWidth: CARD_W, marginBottom: 24 }}>
          <label style={{
            width: "100%", padding: "36px 16px", borderRadius: 24,
            border: "2px dashed rgba(201,168,76,0.5)", background: "rgba(255,255,255,0.5)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}>
            <span style={{ fontSize: 44 }}>📸</span>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#5C3317" }}>Choose your photo</p>
            <p style={{ margin: 0, fontSize: 11, color: "#9B7A5A" }}>This becomes the front of your card</p>
            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
          </label>
        </motion.div>
      )}

      {/* ── Card spread ── */}
      <div style={{ position: "relative", paddingBottom: 0 }}>
        <motion.div
          initial={{ width: CARD_W, height: CARD_H }}
          animate={{ width: view === 'front' ? CARD_W : OPEN_W }}
          transition={{ duration: 0.42, ease: "easeInOut" }}
          style={{ height: CARD_H, position: "relative", display: "flex", flexShrink: 0, overflow: "hidden", boxShadow: "0 16px 48px rgba(0,0,0,0.22)", borderRadius: 20 }}
        >
          {/* ── LEFT INNER PANEL ── */}
          <motion.div
            animate={{ borderRadius: view === 'open' ? "20px 0 0 20px" : "20px" }}
            style={{ width: PANEL_W, height: CARD_H, flexShrink: 0, position: "relative", overflow: "hidden", background: paperBg, ...tapStyle }}
            onClick={() => view === 'open' && setView('front')}
          >
            <div style={{ position: "absolute", inset: 0, backgroundImage: linesBg, backgroundSize: "100% 24px", backgroundPosition: "0 40px", pointerEvents: "none" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 12px", gap: 8 }}>
              <p style={{ fontSize: view === "open" ? 11 : 8, letterSpacing: 2.5, color: "#C9A84C", opacity: 0.7, textTransform: "uppercase", textAlign: "center", margin: 0, transition: "font-size 0.3s" }}>{cat.name}</p>
              {moodQuote && (
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontStyle: "italic",
                  fontSize: view === "open" ? 10 : 8,
                  lineHeight: 1.65,
                  color: "#8B6347",
                  textAlign: "center",
                  whiteSpace: "pre-line",
                  opacity: 0.82,
                  margin: "2px 4px",
                  transition: "font-size 0.3s",
                }}>
                  {moodQuote}
                </p>
              )}
              <OrnamentLine color="#C9A84C" />
              <div style={{
                width: view === "open" ? 152 : 110,
                height: view === "open" ? 152 : 110,
                borderRadius: "50%",
                overflow: "hidden",
                border: "3px solid #C9A84C",
                boxShadow: "0 0 0 5px rgba(201,168,76,0.12),0 6px 20px rgba(0,0,0,0.14)",
                flexShrink: 0,
                background: gradFrom,
                transition: "width 0.3s, height 0.3s",
              }}>
                {bgPhoto
                  ? <img src={bgPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg,${gradFrom}55,${gradFrom}22)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{cat.icon}</div>
                }
              </div>
              <OrnamentLine color="#C9A84C" />
            </div>
          </motion.div>

          {/* ── RIGHT PANEL — message ── */}
          <AnimatePresence>
            {view === 'open' && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ delay: 0.38, duration: 0.25 }}
                style={{ width: PANEL_W, height: CARD_H, flexShrink: 0, position: "relative", background: paperBg, borderRadius: "0 20px 20px 0", borderLeft: "1px solid rgba(201,168,76,0.2)", overflow: "hidden" }}
              >
                <div style={{ position: "absolute", inset: 0, backgroundImage: linesBg, backgroundSize: "100% 24px", backgroundPosition: "0 40px", pointerEvents: "none" }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "0 0 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 6px", flexShrink: 0 }}>
                    <p style={{ fontSize: 7, letterSpacing: 1.5, textTransform: "uppercase", color: "#C9A84C", margin: 0 }}>✦ A personal note</p>
                    <span onClick={() => setView('back')} style={{ fontSize: 10, color: "#C9A84C", opacity: 0.6, cursor: "pointer", padding: "4px 6px", WebkitTapHighlightColor: "transparent" }}>›</span>
                  </div>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value.slice(0, 300))}
                    placeholder="Write your heartfelt message here..."
                    maxLength={300}
                    style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", fontFamily: "Georgia,serif", fontSize: 11, lineHeight: "24px", color: "#5C3D2E", padding: "4px 14px" }}
                  />
                  <p style={{ textAlign: "right", fontSize: 8, color: message.length > 270 ? "#C9A84C" : "rgba(201,168,76,0.35)", paddingRight: 14, paddingBottom: 4, margin: 0 }}>
                    {message.length}/300
                  </p>
                  <div style={{ borderTop: "1px solid rgba(201,168,76,0.35)", paddingTop: 8, opacity: 0.7, margin: "0 14px" }}>
                    <input
                      value={sender}
                      onChange={e => setSender(e.target.value)}
                      placeholder="— Your Name"
                      style={{ background: "transparent", border: "none", outline: "none", fontFamily: "Georgia,serif", fontStyle: "italic", fontSize: 11, color: "#7A5240", width: "100%" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── SayIt back panel ── */}
          <AnimatePresence>
            {view === 'back' && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, zIndex: 20, ...tapStyle }}
                onClick={() => setView('open')}
              >
                <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
                <div style={{ width: 60, height: 60, borderRadius: 16, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
                  <span style={{ fontSize: 30 }}>❤️</span>
                </div>
                <p style={{ color: "white", fontSize: 28, fontWeight: 700, fontFamily: "Georgia,serif", margin: 0, letterSpacing: 1 }}>SayIt</p>
                <div style={{ width: 40, height: 1.5, background: "rgba(255,255,255,0.4)", borderRadius: 2 }} />
                <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 10, textAlign: "center", letterSpacing: 1.5, textTransform: "uppercase", margin: 0, lineHeight: 1.7, padding: "0 12px" }}>Some moments deserve more than a text</p>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 1, margin: 0 }}>sayit.app</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Front cover (flips open on tap) ── */}
          <motion.div
            style={{ position: "absolute", left: 0, top: 0, width: CARD_W, height: CARD_H, transformOrigin: "left center", transformStyle: "preserve-3d", zIndex: 10, ...tapStyle, pointerEvents: view === 'front' ? 'auto' : 'none' }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: view === 'front' ? 0 : -180 }}
            transition={{ type: "spring", stiffness: 62, damping: 14, mass: 1.3 }}
            onClick={() => bgPhoto && setView('open')}
          >
            <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", borderRadius: 20, overflow: "hidden", background: gradFrom }}>
              {bgPhoto ? (
                <img src={bgPhoto} alt="Card front" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg,${gradFrom},${gradTo})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <span style={{ fontSize: 40 }}>📸</span>
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, textAlign: "center", padding: "0 16px", margin: 0 }}>Add a photo to preview your card</p>
                </div>
              )}
              {bgPhoto && (
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(40,15,5,0.25) 100%)" }} />
              )}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Tap to open pill — shown when photo chosen and card is closed ── */}
      <AnimatePresence>
        {view === 'front' && bgPhoto && (
          <motion.button
            key="tap-to-open"
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            onClick={() => setView('open')}
            style={{ marginTop: 14, padding: "10px 28px", borderRadius: 20, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.5)", backdropFilter: "blur(4px)", color: "#5C3317", fontSize: 12, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", fontFamily: "Georgia,serif", boxShadow: "0 2px 10px rgba(0,0,0,0.1)", WebkitTapHighlightColor: "transparent" }}
          >
            Tap to open
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Close card button (view='open', identical to template card) ── */}
      <AnimatePresence>
        {view === 'open' && (
          <motion.button
            key="close-card"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={() => setView('front')}
            style={{ marginTop: 14, padding: "10px 28px", borderRadius: 30, border: "1.5px solid rgba(201,168,76,0.35)", background: "rgba(255,255,255,0.65)", backdropFilter: "blur(8px)", color: "#9B7A40", fontSize: 13, fontWeight: 600, letterSpacing: 0.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", WebkitTapHighlightColor: "transparent" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Close card
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Change photo (view='front', subtle) ── */}
      <AnimatePresence>
        {view === 'front' && bgPhoto && (
          <motion.label
            key="change-photo"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, border: "1.5px solid rgba(201,168,76,0.35)", borderRadius: 20, padding: "8px 20px", color: "#9B7A40", fontSize: 12, cursor: "pointer", background: "rgba(255,255,255,0.65)", backdropFilter: "blur(8px)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
          >
            📸 Change photo
            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
          </motion.label>
        )}
      </AnimatePresence>

      {/* ── SAYIT button (view='open', gold gradient — identical to template card) ── */}
      <AnimatePresence>
        {view === 'open' && bgPhoto && (
          <motion.button
            key="sayit-btn"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            transition={{ delay: 0.2 }}
            onClick={handleSend}
            style={{ marginTop: 16, padding: "14px 48px", borderRadius: 30, border: "none", background: "linear-gradient(135deg,#C9A84C,#B8892A)", color: "#FFF8EC", fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Georgia,serif", cursor: "pointer", boxShadow: "0 6px 20px rgba(0,0,0,0.22)", minWidth: 180 }}
          >
            ✦ SAYIT
          </motion.button>
        )}
      </AnimatePresence>


    </div>
  );
}
