"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { TEMPLATES, CATEGORIES, GREETING_MESSAGES } from "@/lib/data";
import { ArrowLeft, ChevronLeft, ChevronRight, Send, Heart } from "lucide-react";

// Pre-printed inside sentiments per subcategory
const INSIDE_SENTIMENTS: Record<string, { headline: string; subtext: string }> = {
  "flowers":          { headline: "For you,", subtext: "Because you deserve all the beauty in the world." },
  "miss-you":         { headline: "Every day,", subtext: "I find a hundred little reasons to miss you." },
  "thinking-of-you":  { headline: "Right now,", subtext: "You are the only thing on my mind." },
  "good-night":       { headline: "As the stars appear,", subtext: "Know that someone is thinking of you." },
  "good-morning":     { headline: "Rise & shine,", subtext: "Today is going to be your day." },
  "motivation":       { headline: "You've got this.", subtext: "Every step forward is a step closer to your dream." },
  "weekend-vibes":    { headline: "It's the weekend!", subtext: "Time to rest, recharge, and be amazing." },
  "birthday":         { headline: "Happy Birthday!", subtext: "Wishing you a day as wonderful as you are." },
  "occasions":        { headline: "Celebrating you,", subtext: "Because every moment with you is worth celebrating." },
  "holidays":         { headline: "Wishing you joy,", subtext: "May this season bring warmth to your heart." },
};

const DEFAULT_SENTIMENT = { headline: "With love,", subtext: "Sending you warm thoughts and a big smile." };

// Framer Motion variants — book-page flip
const variants = {
  enter: (dir: number) => ({ rotateY: dir > 0 ? 60 : -60, opacity: 0, scale: 0.97 }),
  center: { rotateY: 0, opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit:  (dir: number) => ({ rotateY: dir < 0 ? 60 : -60, opacity: 0, scale: 0.97, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }),
};

export default function CardPage() {
  const params   = useParams();
  const router   = useRouter();
  const id       = params.id as string;

  const template = TEMPLATES.find(t => t.id === id);
  const category = CATEGORIES.find(c => c.id === template?.category_id);

  const [page, setPage]         = useState(0);   // 0=front 1=inside 2=back
  const [direction, setDir]     = useState(1);
  const [message, setMessage]   = useState("");
  const [suggestions, setSugg]  = useState<string[]>([]);

  const sentiment = INSIDE_SENTIMENTS[template?.subcategory_id ?? ""] ??
                    INSIDE_SENTIMENTS[template?.category_id ?? ""] ??
                    DEFAULT_SENTIMENT;

  useEffect(() => {
    if (template?.subcategory_id) setSugg(GREETING_MESSAGES[template.subcategory_id] ?? []);
    else if (template?.category_id) setSugg(GREETING_MESSAGES[template.category_id] ?? []);
  }, [template]);

  if (!template || !category) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
        <p className="text-gray-400">Card not found</p>
        <button onClick={() => router.back()} className="text-pink-500 font-semibold">← Go back</button>
      </div>
    );
  }

  function go(next: number) {
    if (next < 0 || next > 2) return;
    setDir(next > page ? 1 : -1);
    setPage(next);
  }

  const PAGE_LABELS = ["Front", "Inside", "Back"];

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}>

      {/* ── Top bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-14 pb-3">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white/80 shadow-sm flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>

        {/* Page indicator dots */}
        <div className="flex items-center gap-2">
          {[0,1,2].map(i => (
            <button key={i} onClick={() => go(i)} className="flex flex-col items-center gap-1">
              <div className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: page === i ? "24px" : "6px",
                  background: page === i
                    ? `linear-gradient(90deg,${category.gradient_from},${category.gradient_to})`
                    : "#ddd"
                }} />
            </button>
          ))}
        </div>

        <div className="w-9 h-9 rounded-full bg-white/80 shadow-sm flex items-center justify-center">
          <span className="text-xs font-bold text-gray-400">{page + 1}/3</span>
        </div>
      </div>

      <p className="text-center text-xs font-semibold text-gray-400 mb-3 tracking-wider uppercase">
        {PAGE_LABELS[page]}
      </p>

      {/* ── Card ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center px-6 pb-4" style={{ perspective: "1400px" }}>
        <div className="w-full max-w-[320px] flex-1 relative" style={{ minHeight: "440px" }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={page}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl cursor-pointer"
              onClick={() => go(page < 2 ? page + 1 : page)}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* ── PAGE 0: FRONT COVER ─────────────────────── */}
              {page === 0 && (
                <div className="relative w-full h-full">
                  <Image
                    src={template.front_image_url}
                    alt={template.title}
                    fill priority
                    className="object-cover"
                    sizes="320px"
                  />
                  {/* Vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />

                  {/* Category badge */}
                  <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                    <span className="text-white text-xs font-semibold">{category.icon} {category.name}</span>
                  </div>

                  {/* Title */}
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h2 className="text-white text-2xl font-bold drop-shadow-lg">{template.title}</h2>
                    <p className="text-white/70 text-sm mt-1">
                      {category.subcategories?.find(s => s.id === template.subcategory_id)?.name ?? category.name}
                    </p>
                  </div>

                  {/* Tap hint */}
                  <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
                    <span className="text-white text-[10px] font-medium">Tap to open</span>
                    <ChevronRight className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}

              {/* ── PAGE 1: INSIDE ──────────────────────────── */}
              {page === 1 && (
                <div className="flex flex-col h-full bg-white">
                  {/* Inside top: pre-printed decorative section */}
                  <div className="relative flex flex-col items-center justify-center px-6 pt-8 pb-6"
                    style={{
                      background: `linear-gradient(160deg, ${category.gradient_from}18, ${category.gradient_to}30)`,
                      borderBottom: `2px dashed ${category.gradient_from}30`,
                      minHeight: "45%",
                    }}>
                    {/* Decorative corners */}
                    <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 rounded-tl-lg"
                      style={{ borderColor: `${category.gradient_from}50` }} />
                    <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 rounded-tr-lg"
                      style={{ borderColor: `${category.gradient_from}50` }} />

                    <span className="text-5xl mb-3">{category.icon}</span>
                    <h3 className="text-xl font-bold text-center text-gray-800 leading-snug">
                      {sentiment.headline}
                    </h3>
                    <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed italic">
                      {sentiment.subtext}
                    </p>
                  </div>

                  {/* Inside bottom: personal message */}
                  <div className="flex flex-col flex-1 px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-2">
                      Personal Message
                    </p>

                    {message ? (
                      <p className="text-gray-700 text-sm leading-relaxed italic flex-1">
                        &ldquo;{message}&rdquo;
                      </p>
                    ) : (
                      <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="Write something from the heart…"
                        maxLength={300}
                        rows={4}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 w-full text-sm text-gray-700 placeholder-gray-300 resize-none focus:outline-none font-['Georgia',serif] leading-relaxed bg-transparent italic"
                        autoFocus
                      />
                    )}

                    {/* Quick suggestions */}
                    {!message && suggestions.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-3">
                        <p className="text-[10px] text-gray-300 uppercase tracking-widest">Quick picks</p>
                        {suggestions.slice(0, 2).map((s, i) => (
                          <button key={i} onClick={e => { e.stopPropagation(); setMessage(s); }}
                            className="text-left text-xs px-3 py-2 rounded-xl bg-gray-50 text-gray-500 border border-gray-100 active:bg-gray-100">
                            {s}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Signature line */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <div className="flex-1 h-px bg-gray-100 mr-3" />
                      <Heart className="w-3 h-3 text-pink-300 fill-pink-300" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── PAGE 2: BACK COVER ──────────────────────── */}
              {page === 2 && (
                <div className="flex flex-col items-center justify-between h-full bg-white px-6 py-8">
                  {/* Back top: brand */}
                  <div className="flex flex-col items-center gap-2 mt-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
                      style={{ background: `linear-gradient(135deg, ${category.gradient_from}, ${category.gradient_to})` }}>
                      <Heart className="w-6 h-6 text-white fill-white" />
                    </div>
                    <p className="text-lg font-bold gradient-text">SayIt</p>
                    <p className="text-[10px] text-gray-300 uppercase tracking-widest">
                      Some moments deserve more than a text
                    </p>
                  </div>

                  {/* Card info */}
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-16 h-px bg-gray-100" />
                    <p className="text-xs font-semibold text-gray-500">{template.title}</p>
                    <p className="text-[10px] text-gray-300">{category.name} Collection</p>
                    <div className="w-16 h-px bg-gray-100" />
                  </div>

                  {/* Barcode-style decoration (aesthetic only) */}
                  <div className="flex flex-col items-center gap-3 w-full">
                    <div className="flex gap-0.5 h-8 items-end">
                      {Array.from({ length: 28 }).map((_, i) => (
                        <div key={i}
                          className="rounded-sm"
                          style={{
                            width: i % 3 === 0 ? "3px" : "1.5px",
                            height: `${50 + Math.sin(i * 1.3) * 30}%`,
                            background: "#ddd",
                          }} />
                      ))}
                    </div>
                    <p className="text-[9px] text-gray-200 font-mono">SYT-{template.id.slice(-6).toUpperCase()}</p>
                    <p className="text-[9px] text-gray-300">© 2025 SayIt · Made with ❤️</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Navigation arrows ─────────────────────────────── */}
        <div className="flex items-center justify-between w-full max-w-[320px] mt-4 px-1">
          <button onClick={() => go(page - 1)} disabled={page === 0}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center disabled:opacity-20">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>

          <p className="text-xs text-gray-400 font-medium">
            {page === 0 && "Tap card to open →"}
            {page === 1 && (message ? "Looking great! →" : "Write your message above")}
            {page === 2 && "Ready to send!"}
          </p>

          <button onClick={() => go(page + 1)} disabled={page === 2}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center disabled:opacity-20">
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* ── CTA button ────────────────────────────────────── */}
        <div className="w-full max-w-[320px] mt-4">
          {page === 2 ? (
            <Link href={`/send?templateId=${template.id}&message=${encodeURIComponent(message)}`}>
              <button
                className="w-full py-4 rounded-2xl text-white font-semibold shadow-lg flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg,${category.gradient_from},${category.gradient_to})` }}>
                <Send className="w-4 h-4" /> Send This Card
              </button>
            </Link>
          ) : page === 1 ? (
            <button
              onClick={() => go(2)}
              disabled={message.trim().length === 0}
              className="w-full py-4 rounded-2xl text-white font-semibold shadow-lg disabled:opacity-30 flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg,${category.gradient_from},${category.gradient_to})` }}>
              Preview Back Cover →
            </button>
          ) : (
            <button
              onClick={() => go(1)}
              className="w-full py-4 rounded-2xl text-white font-semibold shadow-lg flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg,${category.gradient_from},${category.gradient_to})` }}>
              Open Card 💌
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
