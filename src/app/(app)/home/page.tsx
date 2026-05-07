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
    <div className="flex flex-col min-h-dvh" style={{ background: "linear-gradient(180deg, #FFF5F7 0%, #ffffff 40%)" }}>
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
              background: "linear-gradient(135deg, #1a1a2e 0%, #0f3460 50%, #533483 100%)",
              boxShadow: "0 8px 32px rgba(83,52,131,0.35)",
            }}
          >
            {/* Stars bg decoration */}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="absolute rounded-full bg-white"
                  style={{
                    width: Math.random() * 3 + 1,
                    height: Math.random() * 3 + 1,
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                    opacity: Math.random() * 0.6 + 0.2,
                  }}
                />
              ))}
              {/* Decorative circles — same as hero cards */}
              <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-20 bg-white" />
              <div className="absolute -right-2 bottom-2 w-20 h-20 rounded-full opacity-10 bg-white" />
            </div>

            {/* Icon */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 z-10"
              style={{ background: "linear-gradient(135deg, #FFD700, #FF9500)" }}
            >
              <span className="text-2xl">✨</span>
            </div>

            {/* Text */}
            <div className="z-10 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-white font-bold text-base">AI Card Creator</span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "#FFD700", color: "#1a1a2e" }}
                >
                  NEW
                </span>
              </div>
              <p className="text-white/60 text-xs leading-snug">
                Place yourselves in 50 exotic locations around the world
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-white/40 text-xs">❤️ Couple Cards</span>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-white/40 text-xs">✨ AI Generated</span>
              </div>
            </div>

          </div>
        </Link>
      </div>

      {/* ── Circle categories (Birthday, Occasions, Holidays) ─────── */}
      <div className="px-5 mb-2">
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
