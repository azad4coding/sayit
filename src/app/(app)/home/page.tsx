"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { getCategories, type DBCategory } from "@/lib/supabase-data";
import type { Profile } from "@/lib/types";

export default function HomePage() {
  const supabase = createClient();
  const [profile,          setProfile]          = useState<Profile | null>(null);
  const [greeting,         setGreeting]         = useState("Good morning");
  const [heroCategories,   setHeroCategories]   = useState<DBCategory[]>([]);
  const [circleCategories, setCircleCategories] = useState<DBCategory[]>([]);
  const [catsLoading,      setCatsLoading]      = useState(true);

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 12 && h < 17) setGreeting("Good afternoon");
    else if (h >= 17) setGreeting("Good evening");

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const metaName = data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? "";
        if (metaName) setProfile(prev => prev ?? ({ full_name: metaName } as Profile));
        supabase.from("profiles").select("*").eq("id", data.user.id).single()
          .then(({ data: p }) => { if (p) setProfile(p); });
      }
    });

    // Fetch categories from Supabase
    getCategories().then(cats => {
      setHeroCategories(cats.filter(c => c.is_hero));
      const INSTANT_SLUGS = ["birthday", "thank-you", "occasions"];
      setCircleCategories(
        INSTANT_SLUGS.map(slug => cats.find(c => c.slug === slug)).filter(Boolean) as DBCategory[]
      );
      setCatsLoading(false);
    });
  }, []);

  const firstName = profile?.full_name?.split(" ")[0] ?? "Guest";

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh", background: "linear-gradient(180deg, #FFF5F7 0%, #F8F0FF 60%, #fff5f7 100%)" }}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 44px) + 16px)" }}>
        <div>
          <p className="text-xs text-gray-400 font-medium">{greeting} 👋</p>
          <h2 className="text-xl font-bold text-gray-800">{firstName}</h2>
        </div>
      </header>

      {/* ── Section title ─────────────────────────────────────────── */}
      <div className="px-5 mb-4">
        <h3 className="text-lg font-bold text-gray-800">What would you like to send?</h3>
        <p className="text-xs text-gray-400 mt-0.5">Choose a category to get started</p>
      </div>

      {/* ── Hero categories (Romance, Paw Moments, Morning Wishes) ── */}
      <div className="flex flex-col gap-4 px-5 mb-6">
        {catsLoading ? (
          // Skeleton placeholders — same height as real cards to prevent layout shift
          [0, 1, 2].map(i => (
            <div key={i} className="rounded-3xl h-[140px] bg-gray-200 animate-pulse" />
          ))
        ) : (
          heroCategories.map(cat => (
            <Link key={cat.id} href={cat.slug === "vibes" ? "/meme-cards" : `/category/${cat.slug}`}>
              <div
                className="relative rounded-3xl overflow-hidden shadow-md h-[140px] flex items-center px-7"
                style={{ background: `linear-gradient(135deg, ${cat.gradient_from}, ${cat.gradient_to})` }}
              >
                {/* Decorative circles */}
                <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-20 bg-white" />
                <div className="absolute -right-2 bottom-2 w-20 h-20 rounded-full opacity-10 bg-white" />

                <div className="flex items-center gap-4 z-10">
                  <span className="text-4xl">{cat.icon}</span>
                  <div>
                    <p className="text-white font-bold text-2xl">{cat.name}</p>
                    {cat.subcategories && (
                      <p className="text-white/70 text-xs mt-0.5">
                        {cat.subcategories.map(s => s.name).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

              </div>
            </Link>
          ))
        )}
      </div>

      {/* ── AI Card Creator banner ─────────────────────────────────────── */}
      <div className="px-5 mb-6">
        <Link href="/create">
          <div
            className="relative rounded-3xl overflow-hidden px-6 py-5 flex items-center gap-4"
            style={{
              background: "linear-gradient(135deg, #0d0221 0%, #3a0d7a 35%, #7b2ff7 70%, #c850c0 100%)",
              boxShadow: "0 12px 40px rgba(123,47,247,0.45)",
            }}
          >
            {/* Premium shimmer overlay */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
                backgroundSize: "200% 100%",
              }}
            />

            {/* Decorative orbs */}
            <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full opacity-25"
              style={{ background: "radial-gradient(circle, #c850c0, transparent)" }} />
            <div className="absolute right-8 bottom-0 w-20 h-20 rounded-full opacity-15"
              style={{ background: "radial-gradient(circle, #7b2ff7, transparent)" }} />

            {/* Stars */}
            {[
              [15, 20], [40, 70], [60, 15], [75, 55], [85, 30], [25, 85],
              [50, 40], [90, 70], [10, 60], [65, 80], [35, 10], [80, 45],
            ].map(([t, l], i) => (
              <div key={i} className="absolute rounded-full bg-white"
                style={{ width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2, top: `${t}%`, left: `${l}%`, opacity: i % 2 === 0 ? 0.7 : 0.4 }}
              />
            ))}

            {/* Gold icon */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 z-10"
              style={{
                background: "linear-gradient(135deg, #FFD700 0%, #FF9500 60%, #FF6B00 100%)",
                boxShadow: "0 4px 16px rgba(255,165,0,0.5)",
              }}
            >
              <span className="text-2xl">✨</span>
            </div>

            {/* Text */}
            <div className="z-10 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-bold text-base tracking-tight">AI Card Creator</span>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide"
                  style={{ background: "linear-gradient(90deg,#FFD700,#FF9500)", color: "#1a0533" }}
                >
                  NEW
                </span>
              </div>
              <p className="text-white/70 text-xs leading-snug">
                Place yourselves in 50 exotic locations around the world
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-white/50 text-[11px]">❤️ Couple Cards</span>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-white/50 text-[11px]">✨ AI Generated</span>
              </div>
            </div>

          </div>
        </Link>
      </div>

      {/* ── Circle categories (Birthday, Occasions, Holidays) ─────── */}
      <div className="px-5 pb-8">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Instant Moments</h3>
        <div className="grid grid-cols-3 gap-4">
          {catsLoading ? (
            [0, 1, 2].map(i => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-[72px] h-[72px] rounded-full bg-gray-200 animate-pulse" />
                <div className="h-3 w-14 rounded-full bg-gray-200 animate-pulse" />
              </div>
            ))
          ) : (
            circleCategories.map(cat => (
              <Link key={cat.id} href={cat.id === "vibes" ? "/meme-cards" : `/category/${cat.slug}`} className="flex flex-col items-center gap-2">
                <div
                  className="w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-md text-2xl"
                  style={{ background: `linear-gradient(135deg, ${cat.gradient_from}, ${cat.gradient_to})` }}
                >
                  {cat.icon}
                </div>
                <span className="text-xs font-semibold text-gray-600">{cat.name}</span>
              </Link>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
