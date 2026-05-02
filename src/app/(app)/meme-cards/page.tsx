"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Shuffle, Send } from "lucide-react";

interface MemeTemplate {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  box_count: number;
}

export default function MemeCardsPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [templates, setTemplates] = useState<MemeTemplate[]>([]);
  const [filtered, setFiltered] = useState<MemeTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MemeTemplate | null>(null);
  const [topText, setTopText] = useState("");
  const [bottomText, setBottomText] = useState("");
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"browse" | "customize">("browse");
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    fetch("/api/memes")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.memes || []);
        setFiltered(data.memes || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? templates.filter((t) => t.name.toLowerCase().includes(q)) : templates);
  }, [search, templates]);

  // Pre-load image via proxy when step changes to customize
  useEffect(() => {
    if (step !== "customize" || !selected) return;
    setImageReady(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImageReady(true);
    img.src = `/api/memes/proxy?url=${encodeURIComponent(selected.url)}`;
  }, [selected, step]);

  const drawMeme = useCallback(() => {
    if (!selected || !canvasRef.current || !imageReady) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const maxW = canvas.parentElement?.offsetWidth || 340;
      const ratio = maxW / img.width;
      canvas.width = maxW;
      canvas.height = img.height * ratio;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const fontSize = Math.max(22, Math.floor(canvas.width / 10));
      ctx.font = `900 ${fontSize}px Impact, "Arial Black", sans-serif`;
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = fontSize / 4;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#fff";
      ctx.miterLimit = 2;

      const draw = (text: string, y: number) => {
        const u = text.toUpperCase();
        ctx.strokeText(u, canvas.width / 2, y, canvas.width - 24);
        ctx.fillText(u, canvas.width / 2, y, canvas.width - 24);
      };

      if (topText) draw(topText, fontSize + 10);
      if (bottomText) draw(bottomText, canvas.height - 14);
    };
    img.src = `/api/memes/proxy?url=${encodeURIComponent(selected.url)}`;
  }, [selected, topText, bottomText, imageReady]);

  useEffect(() => {
    if (imageReady) drawMeme();
  }, [imageReady, drawMeme]);

  useEffect(() => {
    if (imageReady) drawMeme();
  }, [topText, bottomText]);

  const handleSelect = (t: MemeTemplate) => {
    setSelected(t);
    setTopText("");
    setBottomText("");
    setStep("customize");
  };

  const randomize = () => {
    if (!templates.length) return;
    handleSelect(templates[Math.floor(Math.random() * templates.length)]);
  };

  const handleSend = () => {
    if (!canvasRef.current || !selected) return;
    try {
      const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.82);
      sessionStorage.setItem("meme_image", dataUrl);
      sessionStorage.setItem("card_template_id", `meme-${selected.id}`);
      sessionStorage.setItem("card_category", "vibes");
      sessionStorage.setItem(
        "card_message",
        [topText, bottomText].filter(Boolean).join(" / ") || selected.name
      );
      router.push("/send?type=meme");
    } catch {
      alert("Could not prepare meme — try a smaller one.");
    }
  };

  /* ── Customize step ──────────────────────────────────────────────────────── */
  if (step === "customize" && selected) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex items-center gap-3 px-4 pt-12 pb-4">
          <button
            onClick={() => setStep("browse")}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-black">Make It Yours</h1>
          <button
            onClick={randomize}
            className="ml-auto w-9 h-9 flex items-center justify-center rounded-full bg-white/10"
            title="Random meme"
          >
            <Shuffle size={16} />
          </button>
        </div>

        <div className="px-4 pb-52">
          {/* Canvas preview */}
          <div className="rounded-2xl overflow-hidden mb-5 bg-zinc-900 min-h-[200px] flex items-center justify-center">
            {!imageReady && (
              <div className="absolute w-full h-40 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <canvas ref={canvasRef} className="w-full block" />
          </div>

          {/* Inputs */}
          <div className="space-y-3 mb-4">
            <input
              type="text"
              value={topText}
              onChange={(e) => setTopText(e.target.value)}
              placeholder="TOP TEXT (optional)"
              maxLength={80}
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 text-white placeholder-zinc-600 font-bold uppercase text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <input
              type="text"
              value={bottomText}
              onChange={(e) => setBottomText(e.target.value)}
              placeholder="BOTTOM TEXT (optional)"
              maxLength={80}
              className="w-full bg-zinc-900 rounded-xl px-4 py-3 text-white placeholder-zinc-600 font-bold uppercase text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>
        </div>

        {/* Fixed send button */}
        <div className="fixed bottom-16 left-0 right-0 flex justify-center bg-gradient-to-t from-black via-black/95 to-transparent p-4">
          <button
            onClick={handleSend}
            className="w-full max-w-sm py-3 rounded-2xl font-bold text-base flex items-center justify-center gap-2 active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg,#FF1493,#FF6B00)" }}
          >
            <Send size={20} />
            Send This Meme 🔥
          </button>
        </div>
      </div>
    );
  }

  /* ── Browse step ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-black">Meme Cards 🔥</h1>
        </div>
        <p className="text-zinc-500 text-sm mb-4 pl-12">Send the meme. Say it louder. 📣</p>

        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 100+ memes..."
            className="w-full bg-zinc-900 rounded-xl pl-9 pr-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
      </div>

      <div className="px-4 pb-10">
        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="aspect-square bg-zinc-900 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <p className="text-zinc-600 text-xs mb-3">{filtered.length} memes • tap to customise</p>
            <div className="grid grid-cols-3 gap-2">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  className="relative aspect-square rounded-xl overflow-hidden bg-zinc-900 active:scale-95 transition-transform ring-0 focus:ring-2 focus:ring-pink-500"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.url}
                    alt={t.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-1">
                    <p className="text-white text-[9px] font-bold leading-tight line-clamp-2">
                      {t.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
