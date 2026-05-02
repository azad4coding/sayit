"use client";

import React, { useEffect, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { getTemplateById, getCategoryById, type DBTemplate, type DBCategory } from "@/lib/supabase-data";
import { ArrowLeft } from "lucide-react";

const REACTION_EMOJIS = ["❤️", "😭", "😍", "🔥", "🤗"];

interface CardData {
  id: string;
  short_code: string;
  template_id: string | null;
  sender_id: string | null;
  message: string | null;
  sender_name: string | null;
  recipient_name: string | null;
  recipient_id: string | null;
  front_image_url: string | null;
  meme_image_url: string | null;
  voice_note_url: string | null;
  card_type: string | null;
  paw_photos: string[] | null;
  paw_frame: string | null;
  created_at: string | null;
  viewed_at: string | null;
}

const CARD_EXPIRY_DAYS = 30;

function PreviewInner() {
  const params     = useParams();
  const search     = useSearchParams();
  const code       = params.code as string;
  const backParam  = search.get("back");

  const [card, setCard]             = useState<CardData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [notFound, setNotFound]     = useState(false);
  const [expired, setExpired]       = useState(false);
  const [cardRevealed,  setCardRevealed]  = useState(false);
  const [previewStage, setPreviewStage] = useState<"envelope" | "card" | "opening">("envelope");
  const [stageFading,  setStageFading]   = useState(false);
  const [isExternalOpen, setIsExternalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked,    setAuthChecked]    = useState(false);
  const [wasAlreadyViewed, setWasAlreadyViewed] = useState(false);

  const [myCardReaction,  setMyCardReaction]  = useState<string | null>(null);
  const [reactionCounts,  setReactionCounts]  = useState<Record<string, number>>({});
  const [reactionTrayOpen, setReactionTrayOpen] = useState(false);
  const [reactionLoaded,  setReactionLoaded]  = useState(false);

  // My Circle
  const [userPhone, setUserPhone] = useState<string | null>(null);

  // Recipient display name (shown on sender's view of the card)
  const [recipientDisplayName, setRecipientDisplayName] = useState<string>("your friend");

  const [dbTemplate, setDbTemplate] = useState<DBTemplate | null>(null);
  const [dbCategory, setDbCategory] = useState<DBCategory | null>(null);

  const supabase = createClient();

  useEffect(() => {
    // Detect if opened from an external source (iMessage, etc.)
    const ref = document.referrer;
    const sameOrigin = ref && (ref.startsWith(window.location.origin) || ref.includes("localhost"));
    setIsExternalOpen(!sameOrigin && !backParam);

    // Check auth state for viral loop CTA + silently claim the card
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setIsLoggedIn(!!user);
      setUserId(user?.id ?? null);
      setAuthChecked(true);
      if (user) {
        // Claim this card for the logged-in recipient (only if unclaimed)
        await supabase
          .from("sent_cards")
          .update({ recipient_id: user.id })
          .eq("short_code", code)
          .is("recipient_id", null);

        // Fetch user's phone for circle check
        const phone = user.phone ?? null;
        if (!phone) {
          const { data: prof } = await supabase.from("profiles").select("phone").eq("id", user.id).single();
          if (prof?.phone) setUserPhone(prof.phone);
        } else {
          setUserPhone(phone);
        }
      }
    });

    fetchCard();
  }, [code]);

  // Skip the envelope/card-flip experience when:
  //   • The viewer is the sender (they've already seen it — go directly to revealed)
  //   • It's a Meme, Paw Moments, or AI card (no greeting-card flip needed)
  // Registered recipients skip the envelope but still get the card-flip.
  // Returning recipients (wasAlreadyViewed) still see the full greeting card experience.
  useEffect(() => {
    if (!card || !authChecked) return;
    const isSenderViewing = userId !== null && userId === card.sender_id;
    // Instant reveal: card types that have no greeting-card flip experience
    const isInstantReveal =
      card.card_type === "meme" ||
      card.card_type === "paw-moments" ||
      card.card_type === "ai-card" ||
      card.card_type === "gift-card" ||
      !!card.meme_image_url;
    // custom-card and template-based cards always show the closed-card animation,
    // even for the sender (isSenderViewing no longer bypasses the flip)
    if (isInstantReveal) {
      setCardRevealed(true);
    } else if (isLoggedIn) {
      // Both recipients and the sender skip the envelope and go straight to closed card
      setPreviewStage("card");
    }
  }, [card, authChecked, userId, isLoggedIn]);

  // Auto-open the card for logged-in recipients when they reach the "card" stage
  useEffect(() => {
    if (!card || !authChecked || !isLoggedIn || previewStage !== "card") return;
    const isSenderViewing = userId !== null && userId === card.sender_id;
    if (isSenderViewing) return;
    const t = setTimeout(() => handleCardOpen(), 700);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewStage, isLoggedIn, authChecked, card, userId]);

  // Fetch reactions only once both card.id and userId are resolved
  useEffect(() => {
    if (!card?.id || userId === null || !isLoggedIn) return;
    setReactionLoaded(false);
    supabase
      .from("card_reactions")
      .select("emoji, user_id")
      .eq("card_id", card.id)
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        let mine: string | null = null;
        for (const r of data ?? []) {
          counts[r.emoji] = (counts[r.emoji] || 0) + 1;
          if (r.user_id === userId) mine = r.emoji;
        }
        setReactionCounts(counts);
        setMyCardReaction(mine);
        setReactionLoaded(true);
      });
  }, [card?.id, userId, isLoggedIn]);

  // Resolve recipient display name once card is loaded
  useEffect(() => {
    if (!card) return;
    // Priority 1: saved recipient_name (from when the card was sent)
    if (card.recipient_name?.trim()) {
      setRecipientDisplayName(card.recipient_name.trim());
      return;
    }
    // Priority 2: registered SayIt user's profile name
    if (card.recipient_id) {
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", card.recipient_id)
        .single()
        .then(({ data }) => {
          if (data?.full_name?.trim()) {
            setRecipientDisplayName(data.full_name.trim());
          }
          // else stays as "your friend"
        });
      return;
    }
    // Fallback
    setRecipientDisplayName("your friend");
  }, [card?.id]);

  // Fetch template + category from Supabase once card.template_id is known
  useEffect(() => {
    if (!card?.template_id) return;
    getTemplateById(card.template_id).then(tmpl => {
      if (!tmpl) return;
      setDbTemplate(tmpl);
      getCategoryById(tmpl.category_id).then(cat => {
        if (cat) setDbCategory(cat);
      });
    });
  }, [card?.template_id]);

  async function reactToCard(emoji: string) {
    if (!userId || !card?.id) return;
    if (myCardReaction === emoji) {
      setMyCardReaction(null);
      setReactionCounts(prev => ({ ...prev, [emoji]: Math.max(0, (prev[emoji] ?? 0) - 1) }));
      setReactionTrayOpen(false);
      await supabase.from("card_reactions").delete().eq("card_id", card.id).eq("user_id", userId);
    } else {
      const prev = myCardReaction;
      setMyCardReaction(emoji);
      setReactionCounts(c => ({
        ...c,
        ...(prev ? { [prev]: Math.max(0, (c[prev] ?? 0) - 1) } : {}),
        [emoji]: (c[emoji] ?? 0) + 1,
      }));
      setReactionTrayOpen(false);
      await supabase.from("card_reactions").delete().eq("card_id", card.id).eq("user_id", userId);
      await supabase.from("card_reactions").insert({ card_id: card.id, user_id: userId, emoji });
    }
  }

  async function fetchCard() {
    setFetchError(false);
    setLoading(true);
    try {
      // ── Use the server API route so anonymous recipients (no auth) can read the card ──
      const res = await fetch(`/api/card/${encodeURIComponent(code)}`);

      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        // 5xx means server/env issue — treat as not found, not a network error
        if (res.status >= 500) {
          setNotFound(true);
        } else {
          setFetchError(true);
        }
        setLoading(false);
        return;
      }

      const data = await res.json();

      // ── Expiry check: cards older than 30 days are expired ──
      if (data.created_at) {
        const created = new Date(data.created_at);
        const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays > CARD_EXPIRY_DAYS) {
          setExpired(true);
          setLoading(false);
          return;
        }
      }

      const profileName = (data.profiles as { full_name?: string } | null)?.full_name ?? null;
      const cardData: CardData = { ...data, sender_name: data.sender_name ?? profileName };
      setCard(cardData);

      // Track if this card was already opened before (viewed_at already set)
      setWasAlreadyViewed(!!data.viewed_at);

      // ── Persist card info so auth on another device can redirect back ──
      try {
        sessionStorage.setItem("sayit_pending_card", JSON.stringify({
          code,
          senderName: cardData.sender_name ?? "Someone special",
        }));
      } catch {}

      // Mark as viewed (only first time) — uses anon client, fine if it fails due to RLS
      if (!data.viewed_at) {
        supabase.from("sent_cards").update({ viewed_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
      }
    } catch {
      setFetchError(true);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Network / fetch error — with retry ─────────────────────────
  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-5 px-8 text-center"
        style={{ background: "linear-gradient(160deg,#FFF5F7,#F8F0FF)" }}>
        <span className="text-5xl">📡</span>
        <h2 className="text-xl font-bold text-gray-800">No connection</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          We couldn&apos;t load this card. Check your internet connection and try again.
        </p>
        <button onClick={fetchCard}
          className="px-8 py-3.5 rounded-2xl text-white font-semibold shadow-md"
          style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
          Retry
        </button>
      </div>
    );
  }

  // ── Card not found (deleted or invalid link) ───────────────────
  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-5 px-8 text-center"
        style={{ background: "linear-gradient(160deg,#FFF5F7,#F8F0FF)" }}>
        <span className="text-5xl">💔</span>
        <h2 className="text-xl font-bold text-gray-800">Card not found</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          This card may have been deleted by the sender, or the link is incorrect.
        </p>
        <Link href="/register"
          className="px-8 py-3.5 rounded-2xl text-white font-semibold shadow-md"
          style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
          Join SayIt Free
        </Link>
      </div>
    );
  }

  // ── Card expired ───────────────────────────────────────────────
  if (expired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-5 px-8 text-center"
        style={{ background: "linear-gradient(160deg,#FFF5F7,#F8F0FF)" }}>
        <span className="text-5xl">⏳</span>
        <h2 className="text-xl font-bold text-gray-800">This card has expired</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Cards are available for {CARD_EXPIRY_DAYS} days after they&apos;re sent.
          Ask your friend to send a new one!
        </p>
        <Link href="/register"
          className="px-8 py-3.5 rounded-2xl text-white font-semibold shadow-md"
          style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
          Join SayIt Free
        </Link>
      </div>
    );
  }

  // Use Supabase-fetched template/category; fall back to stored front_image_url
  const cardImageUrl = dbTemplate?.front_image_url ?? card?.front_image_url ?? null;
  const senderName  = card?.sender_name ?? "Someone special";
  const message     = card?.message ?? "";
  const isMeme      = card?.card_type === "meme" || !!card?.meme_image_url;
  const isPaw       = card?.card_type === "paw-moments";
  const isCustom    = card?.card_type === "custom-card";
  const isAiCard    = card?.card_type === "ai-card";
  const isGiftCard  = card?.card_type === "gift-card";
  // Parse gift card metadata from message JSON
  let gcData: { vendor: string; vendorName: string; vendorEmoji: string; vendorColor: string; vendorBg: string; vendorWebsite: string; amount: number; note: string } | null = null;
  if (isGiftCard) {
    try { gcData = JSON.parse(message); } catch {}
  }
  // Use slug for comparisons (Supabase category.id is a UUID)
  const catSlug     = dbCategory?.slug ?? null;
  const isVibes     = !isMeme && !isPaw && !isCustom && !isAiCard && !isGiftCard && catSlug === "vibes";

  // "Say it Back" destination — AI cards go back to the AI card creator
  const sayitBackCategorySlug = new Set(["birthday", "invitations", "thank-you"]).has(catSlug ?? "")
    ? "thank-you"
    : (catSlug ?? null);
  const sayitBackUrl = isGiftCard
    ? "/gift-cards"
    : isAiCard
    ? "/create"
    : isMeme
    ? "/meme-cards"
    : isPaw
    ? "/category/paw-moments"
    : sayitBackCategorySlug
    ? `/category/${sayitBackCategorySlug}`
    : "/home";
  const sayitBackIcon = isGiftCard ? "🎁" : isAiCard ? "✨" : isMeme ? "🔥" : isPaw ? "🐾" : (dbCategory?.icon ?? "💌");


  // If the logged-in user is the one who sent this card, hide reactions & Say it Back
  const isSender    = isLoggedIn && userId !== null && userId === (card as any)?.sender_id;

  const goldAccent  = "#C9A84C";
  const CLOSED_W    = 310;   // full-size closed card (3:4, matches app preview)
  const CLOSED_H    = 413;   // 310 * 4/3
  const PANEL_W     = 175;   // each panel of the open two-panel view
  const SPREAD_W    = 350;   // total width when open
  const CARD_H      = 480;   // height of open view
  const isOpening   = previewStage === "opening";

  // ── Envelope stage ───────────────────────────────────────────────
  if (!cardRevealed && previewStage === "envelope") {
    return (
      <div style={{ minHeight: "100dvh", background: "linear-gradient(160deg,#FDF6EE,#F7EBE0,#F0DDD0)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, fontFamily: "Georgia, serif" }}>
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <p style={{ color: "#9ca3af", fontSize: 14, margin: 0 }}>
            <span style={{ fontWeight: 700, color: "#1f2937" }}>{senderName}</span> sent you something special ✨
          </p>
        </div>

        {/* Sealed envelope */}
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 16 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setPreviewStage("card")}
          style={{ width: 220, height: 150, position: "relative", cursor: "pointer", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.15))" }}
        >
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#FBF6EE,#F5EAD8)", borderRadius: 6, border: "1px solid #D4B896" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, background: "linear-gradient(160deg,#F5EAD8,#EAD9C0)", clipPath: "polygon(0 0,50% 60%,100% 0)" }} />
          <div style={{ position: "absolute", top: 38, left: "50%", transform: "translateX(-50%)", width: 32, height: 32, borderRadius: "50%", background: "radial-gradient(circle,#D4A853,#B8892A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, boxShadow: "0 2px 6px rgba(0,0,0,0.3)", zIndex: 2 }}>
            ✦
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={() => setPreviewStage("card")}
          style={{ color: goldAccent, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", margin: 0 }}
        >
          Tap to open
        </motion.p>
      </div>
    );
  }

  function handleCardOpen() {
    if (isOpening) return;
    setPreviewStage("opening");
    // Keep the card open (inside visible) for 5.5 seconds, then close and reveal final view
    const OPEN_MS = 5500;
    setTimeout(() => setStageFading(true), OPEN_MS);
    setTimeout(() => setCardRevealed(true), OPEN_MS + 600);
  }

  // ── Card stage (closed + opening animation) ──────────────────────
  if (!cardRevealed) {
    const coverUrl = isMeme ? card?.meme_image_url : (isPaw || isCustom) ? card?.paw_photos?.[0] : cardImageUrl;

    return (
      <motion.div
        animate={{ opacity: stageFading ? 0 : 1 }}
        transition={{ duration: 0.55, ease: "easeInOut" }}
        style={{ minHeight: "100dvh", position: "relative", background: "radial-gradient(ellipse at 50% 40%,#FDF6EE,#F7EBE0,#F0DDD0)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "Georgia, serif" }}
      >

        {/* Circle back button — consistent with revealed state */}
        {backParam && (
          <a href={backParam} style={{ position: "absolute", top: 48, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.8)", backdropFilter: "blur(8px)", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, WebkitTapHighlightColor: "transparent" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#6b7280" }}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </a>
        )}

        <AnimatePresence mode="wait">
          {!isOpening ? (
            /* ── CLOSED: full-size card matching the app preview ── */
            <motion.div
              key="closed"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 80, damping: 16 }}
              onClick={handleCardOpen}
              style={{ width: CLOSED_W, height: CLOSED_H, borderRadius: 16, overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.18)", cursor: "pointer", WebkitTapHighlightColor: "transparent", position: "relative", flexShrink: 0 }}
            >
              {(isPaw || isMeme) ? (
                <div style={{ width: "100%", height: "100%", background: isPaw ? "linear-gradient(135deg,#9B59B6,#C39BD3)" : "linear-gradient(135deg,#FF6B8A,#FF8C42)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 80 }}>{isPaw ? "🐾" : "🔥"}</span>
                </div>
              ) : coverUrl ? (
                <img src={coverUrl} alt={dbTemplate?.title ?? "Card"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg,${dbCategory?.gradient_from ?? "#FF6B8A"},${dbCategory?.gradient_to ?? "#9B59B6"})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 64 }}>{dbCategory?.icon ?? "💌"}</span>
                </div>
              )}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,0) 55%,rgba(30,10,5,0.28) 100%)" }} />
              {/* Spine hint */}
              <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg,transparent,${goldAccent},transparent)`, opacity: 0.5 }} />
            </motion.div>
          ) : (
            /* ── OPEN: original two-panel layout ── */
            <motion.div
              key="open"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              style={{ perspective: 1200 }}
            >
              <div style={{ position: "relative", paddingBottom: 14 }}>
                <motion.div
                  animate={{ width: SPREAD_W }}
                  initial={{ width: PANEL_W }}
                  transition={{ duration: 0.42, ease: "easeInOut" }}
                  style={{ height: CARD_H, position: "relative", display: "flex", flexShrink: 0, boxShadow: "0 12px 32px rgba(0,0,0,0.18)", borderRadius: 16 }}
                >
                  {/* LEFT PANEL — inside decoration */}
                  <div style={{ width: PANEL_W, height: CARD_H, flexShrink: 0, position: "relative", overflow: "hidden", background: "radial-gradient(ellipse at 50% 30%,#FFFDF9,#FBF7F0,#F5EDDF)", borderRadius: "16px 0 0 16px" }}>
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 16px", gap: 10 }}>
                      <p style={{ fontSize: 8, letterSpacing: 3, color: goldAccent, opacity: 0.7, textTransform: "uppercase", margin: 0 }}>{dbCategory?.name ?? "With Love"}</p>
                      <svg viewBox="0 0 140 12" style={{ width: 140, height: 12 }}><line x1="0" y1="6" x2="60" y2="6" stroke={goldAccent} strokeWidth="0.8" opacity="0.6" /><polygon points="70,2 74,6 70,10 66,6" fill={goldAccent} opacity="0.8" /><line x1="80" y1="6" x2="140" y2="6" stroke={goldAccent} strokeWidth="0.8" opacity="0.6" /></svg>
                      <div style={{ width: 110, height: 110, borderRadius: "50%", overflow: "hidden", border: `3px solid ${goldAccent}`, boxShadow: `0 0 0 4px rgba(201,168,76,0.12),0 4px 16px rgba(0,0,0,0.12)`, display: "flex", alignItems: "center", justifyContent: "center", background: isPaw ? "linear-gradient(135deg,#9B59B6,#C39BD3)" : isMeme ? "linear-gradient(135deg,#FF6B8A,#FF8C42)" : `linear-gradient(135deg,${dbCategory?.gradient_from ?? "#FF6B8A"},${dbCategory?.gradient_to ?? "#9B59B6"})` }}>
                        {(isPaw || isMeme)
                          ? <span style={{ fontSize: 42 }}>{isPaw ? "🐾" : "🔥"}</span>
                          : coverUrl
                            ? <img src={coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <span style={{ fontSize: 38 }}>{dbCategory?.icon ?? "💌"}</span>
                        }
                      </div>
                      <svg viewBox="0 0 140 12" style={{ width: 140, height: 12 }}><line x1="0" y1="6" x2="60" y2="6" stroke={goldAccent} strokeWidth="0.8" opacity="0.6" /><polygon points="70,2 74,6 70,10 66,6" fill={goldAccent} opacity="0.8" /><line x1="80" y1="6" x2="140" y2="6" stroke={goldAccent} strokeWidth="0.8" opacity="0.6" /></svg>
                    </div>
                  </div>

                  {/* RIGHT PANEL — message */}
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.38, duration: 0.25 }}
                    style={{ width: PANEL_W, height: CARD_H, flexShrink: 0, position: "relative", background: "linear-gradient(170deg,#FFFCF8,#FDF8F2)", borderRadius: "0 16px 16px 0", overflow: "hidden" }}
                  >
                    <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(transparent,transparent 23px,rgba(201,168,76,0.08) 24px)", backgroundSize: "100% 24px", backgroundPosition: "0 40px", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "0 0 16px" }}>
                      <div style={{ padding: "12px 14px 8px" }}>
                        <p style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: goldAccent, margin: 0 }}>✦ A personal note</p>
                      </div>
                      <div style={{ flex: 1, padding: "4px 16px", overflowY: "auto" }}>
                        {message && (
                          <p style={{ fontFamily: "Georgia,serif", fontSize: 11, lineHeight: "24px", color: "#5C3D2E", fontStyle: "italic", margin: 0 }}>&ldquo;{message}&rdquo;</p>
                        )}
                      </div>
                      <div style={{ borderTop: `1px solid ${goldAccent}`, paddingTop: 8, opacity: 0.7, margin: "0 16px" }}>
                        <p style={{ fontFamily: "Georgia,serif", fontStyle: "italic", fontSize: 11, color: "#7A5240", margin: 0 }}>— {senderName}</p>
                      </div>
                    </div>
                  </motion.div>

                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tap to open text */}
        {!isOpening && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={handleCardOpen}
            style={{ color: goldAccent, fontSize: 13, letterSpacing: 2, textTransform: "uppercase", marginTop: 20, cursor: "pointer" }}
          >
            Tap to open
          </motion.p>
        )}

        {/* CTA buttons shown while card is open */}
        {isOpening && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.4 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 24, width: "100%", maxWidth: SPREAD_W }}
          >
            {isLoggedIn && !isSender && (
              <a href={sayitBackUrl} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px 20px", borderRadius: 16, background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", color: "white", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px rgba(255,107,138,0.35)" }}>
                ✨ Say it Back
              </a>
            )}
            {!isLoggedIn && (
              <a href={`/register?card=${code}&sender=${encodeURIComponent(senderName)}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px 20px", borderRadius: 16, background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", color: "white", fontSize: 14, fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 14px rgba(255,107,138,0.35)" }}>
                Join SayIt Free
              </a>
            )}
            {/* Sender uses the circle back button at top — no separate CTA needed */}
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, ease: "easeIn" }}
      className="flex flex-col min-h-dvh pb-10" style={{ background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}
    >

      {/* Back button — shown whenever there's a back destination */}
      {backParam && (
        <div className="px-5 pt-10 pb-5">
          <Link href={backParam}
            className="w-9 h-9 rounded-full bg-white/80 shadow-sm flex items-center justify-center"
            style={{ border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </Link>
        </div>
      )}


      {/* ── Sender / Recipient label ── */}
      {(isSender || isLoggedIn) && (
        <p style={{
          fontSize: 13,
          color: "#9ca3af",
          textAlign: "center",
          margin: backParam ? "4px 0 14px 0" : "40px 0 14px 0",
          padding: "0 16px",
        }}>
          {isSender ? (
            <>Sent to <span style={{ fontWeight: 700, color: "#5C3D2E" }}>{recipientDisplayName}</span></>
          ) : (
            <>Received from <span style={{ fontWeight: 700, color: "#5C3D2E" }}>{senderName}</span></>
          )}
        </p>
      )}

      {/* ── Card image area (relative wrapper for badge positioning) ── */}
      <div style={{ position: "relative" }}>

      {/* ── Gift Card ─────────────────────────────────────────────── */}
      {isGiftCard && gcData && (
        <div className="px-4 mb-6">
          {/* Gift card visual */}
          <div className="rounded-3xl overflow-hidden shadow-2xl relative" style={{ height: 220,
            background: `linear-gradient(135deg, ${gcData.vendorColor}DD, ${gcData.vendorColor})` }}>
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-20 bg-white" />
            <div className="absolute -right-4 bottom-6 w-28 h-28 rounded-full opacity-10 bg-white" />
            <div className="absolute inset-0 flex items-center px-8 gap-6">
              <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center text-4xl shadow-xl flex-shrink-0">
                {gcData.vendorEmoji}
              </div>
              <div>
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest">Gift Card</p>
                <p className="text-white font-bold text-2xl mt-0.5">{gcData.vendorName}</p>
                <p className="text-white font-black text-4xl mt-1">${gcData.amount}</p>
              </div>
            </div>
            <div className="absolute bottom-0 inset-x-0 px-8 py-3 flex justify-between items-center"
              style={{ background: "rgba(0,0,0,0.2)" }}>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider">Sent via SayIt 💌</p>
              <p className="text-white/60 text-[10px]">sayit.app</p>
            </div>
          </div>

          {/* Personal note */}
          {gcData.note && (
            <div className="mt-4 rounded-2xl bg-white px-5 py-4 shadow-sm border border-gray-50">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Personal Note</p>
              <p className="text-sm text-gray-700 leading-relaxed italic">&ldquo;{gcData.note}&rdquo;</p>
              <p className="text-xs text-gray-400 mt-2">— {senderName}</p>
            </div>
          )}

          {/* Redeem button — visible to recipient */}
          {!isSender && (
            <a
              href={gcData.vendorWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg"
              style={{ background: `linear-gradient(135deg,${gcData.vendorColor},${gcData.vendorColor}BB)` }}>
              {gcData.vendorEmoji} Redeem at {gcData.vendorName}
            </a>
          )}
        </div>
      )}

      {/* ── Meme card ─────────────────────────────────────────────── */}
      {isMeme && card?.meme_image_url && (
        <div className="px-4 mb-6">
          <div className="rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: "#1a1a1a", border: "2px solid #FF6B8A33" }}>
            <div className="relative w-full" style={{ aspectRatio: "3/4" }}>
              <Image src={card.meme_image_url} alt="Meme card" fill className="object-contain" sizes="(max-width:430px) 100vw,430px" priority />
            </div>
          </div>
        </div>
      )}

      {/* ── Paw Moments card — framed collage ────────────────────── */}
      {isPaw && card?.paw_photos && card.paw_photos.length > 0 && (
        <div className="px-4 mb-6">
          {/* Collage */}
          <PawCollage
            photos={card.paw_photos}
            message={message}
            frame={(card.paw_frame ?? "wooden") as PawFrameType}
            showLabel={false}
            showMessage={false}
            height={460}
          />

          {/* Reaction badge — below collage, aligned right */}
          <AnimatePresence>
            {isLoggedIn && !isSender && reactionLoaded && myCardReaction && !reactionTrayOpen && (
              <motion.div
                key="paw-badge"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}
              >
                <button
                  onClick={() => setReactionTrayOpen(true)}
                  style={{
                    background: "white", borderRadius: 20,
                    padding: "5px 10px 5px 7px",
                    border: "1.5px solid rgba(0,0,0,0.07)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
                    display: "flex", alignItems: "center", gap: 4,
                    cursor: "pointer", WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span style={{ fontSize: 20, lineHeight: 1 }}>{myCardReaction}</span>
                  {(reactionCounts[myCardReaction] ?? 0) > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#FF6B8A", lineHeight: 1 }}>
                      {reactionCounts[myCardReaction]}
                    </span>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Message — plain text, no box */}
          {message && (
            <p style={{
              fontFamily: "Georgia, serif", fontStyle: "italic",
              fontSize: 14, color: "#5C3D2E", textAlign: "center",
              lineHeight: 1.6, margin: "12px 0 4px", padding: "0 8px",
            }}>
              &ldquo;{message}&rdquo;
            </p>
          )}

          {/* PAW MOMENTS label — below message */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: message ? 6 : 10 }}>
            <div style={{ background: "linear-gradient(135deg,#C8A45A,#A07830)", borderRadius: 4, padding: "4px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
              <span style={{ fontSize: 9, color: "#FFF3D0", letterSpacing: 3, fontFamily: "Georgia,serif" }}>PAW MOMENTS</span>
            </div>
          </div>
        </div>
      )}

      {/* ── AI card — full-bleed composited image ────────────────── */}
      {isAiCard && card?.front_image_url && (
        <div className="px-8 mb-6">
          <div className="rounded-3xl overflow-hidden shadow-xl border border-gray-200">
            <div className="relative" style={{ aspectRatio: "9/16" }}>
              <img
                src={card.front_image_url}
                alt="AI Card"
                className="w-full h-full object-cover"
                style={{ display: "block" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
              {/* AI badge */}
              <div className="absolute top-4 left-4">
                <span
                  className="text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest"
                  style={{ background: "rgba(255,215,0,0.25)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,215,0,0.45)", color: "#FFD700" }}
                >
                  ✨ AI Card
                </span>
              </div>
              {/* Message overlay */}
              {message && (
                <div className="absolute bottom-0 left-0 right-0 px-5 py-6">
                  <p
                    className="text-white font-semibold text-base leading-snug drop-shadow-lg"
                    style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
                  >
                    &ldquo;{message}&rdquo;
                  </p>
                  <p className="text-white/60 text-xs mt-1.5">— {senderName}</p>
                </div>
              )}
              {!message && (
                <div className="absolute bottom-0 left-0 right-0 px-5 py-5">
                  <p className="text-white/60 text-sm" style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}>
                    — with love, {senderName}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Custom card — user's own photo as background ─────────── */}
      {isCustom && card?.paw_photos && card.paw_photos.length > 0 && (
        <div className="px-8 mb-6">
          <div className="rounded-3xl overflow-hidden shadow-xl border border-gray-200">
            {/* Full-bleed photo */}
            <div className="relative aspect-[3/4]">
              <img src={card.paw_photos[0]} alt="Custom card" className="w-full h-full object-cover" style={{ display: "block" }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
              {/* Category badge */}
              <div className="absolute top-4 left-4">
                <span className="text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest"
                  style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.25)" }}>
                  {dbCategory?.icon} {dbCategory?.name}
                </span>
              </div>
              {/* Message overlay at bottom */}
              {message && (
                <div className="absolute bottom-0 left-0 right-0 px-5 py-5">
                  <p className="text-white font-semibold text-base leading-snug drop-shadow-lg" style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}>
                    &ldquo;{message}&rdquo;
                  </p>
                  <p className="text-white/60 text-xs mt-1.5">— {senderName}</p>
                </div>
              )}
            </div>
            {/* Bottom strip if no message overlay */}
            {!message && (
              <div className="px-5 py-4" style={{ background: `linear-gradient(135deg,${dbCategory?.gradient_from ?? "#FF6B8A"}22,${dbCategory?.gradient_to ?? "#9B59B6"}22)` }}>
                <p className="text-sm font-medium text-gray-600 text-center">— with love, {senderName}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Vibes / meme-style card ───────────────────────────────── */}
      {isVibes && cardImageUrl && (
        <div className="px-6 mb-6">
          <div className="rounded-3xl overflow-hidden shadow-2xl" style={{ background: "#0f0f0f" }}>
            {/* Image fills square, edge-to-edge */}
            <div className="relative w-full" style={{ aspectRatio: "1/1" }}>
              <Image src={cardImageUrl} alt={dbTemplate?.title ?? "Vibes"} fill className="object-cover"
                sizes="(max-width:430px) 100vw,430px" priority />
              {/* Subtle dark overlay at bottom for text */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              {/* Category badge top-left */}
              <div className="absolute top-4 left-4">
                <span className="bg-white/10 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-white/20">
                  ✨ Vibes
                </span>
              </div>
              {/* Title bottom */}
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-white font-black text-xl leading-tight drop-shadow-lg">{dbTemplate?.title}</p>
                <p className="text-white/60 text-xs mt-0.5">— {senderName}</p>
              </div>
            </div>
            {/* Message strip */}
            {message && (
              <div className="px-5 py-4 border-t border-white/10">
                <p className="text-white/80 text-sm italic text-center leading-relaxed">&ldquo;{message}&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Vibes fallback (no image) ─────────────────────────────── */}
      {isVibes && !cardImageUrl && (
        <div className="px-6 mb-6">
          <div className="rounded-3xl overflow-hidden shadow-2xl" style={{ background: "#0f0f0f", minHeight: "280px" }}>
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <span className="text-6xl">{dbCategory?.icon ?? "✨"}</span>
              {message && <p className="text-white text-center text-base px-8 italic">&ldquo;{message}&rdquo;</p>}
              <p className="text-white/40 text-sm">— {senderName}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Regular greeting card ─────────────────────────────────── */}
      {/* dbCategory guard prevents a brief flash as regular card before isVibes resolves */}
      {!isMeme && !isPaw && !isCustom && !isAiCard && !isVibes && cardImageUrl && (!card?.template_id || dbCategory) && (
        <div className="px-4 mb-6">
          <div className="rounded-3xl overflow-hidden shadow-xl bg-white border border-gray-200">
            {/* Front image — clean, no text overlay */}
            <div className="relative aspect-[3/4]">
              <Image src={cardImageUrl} alt={dbTemplate?.title ?? "Card"} fill className="object-cover"
                sizes="(max-width:430px) 100vw,430px" priority />
            </div>
            {/* Message — only shown if sender added one */}
            {message && (
              <div className="px-6 py-5"
                style={{ background: `linear-gradient(135deg,${dbCategory?.gradient_from ?? "#FF6B8A"}15,${dbCategory?.gradient_to ?? "#9B59B6"}20)` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{dbCategory?.icon ?? "💌"}</span>
                  <span className="text-xs text-gray-400 font-medium">Personal message from {senderName}</span>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed italic">&ldquo;{message}&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Fallback when no image available ─────────────────────── */}
      {!isMeme && !isPaw && !isCustom && !isAiCard && !isVibes && !cardImageUrl && (!card?.template_id || dbCategory) && (
        <div className="px-8 mb-6">
          <div className="rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", minHeight: "280px" }}>
            <div className="flex flex-col items-center justify-center h-full py-16 gap-4">
              <span className="text-6xl">💌</span>
              {message && (
                <p className="text-white text-center text-base leading-relaxed px-8 italic">&ldquo;{message}&rdquo;</p>
              )}
              <p className="text-white/60 text-sm">— with love, {senderName}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── WhatsApp-style reaction badge clipped to card corner (non-paw cards only) ── */}
      <AnimatePresence>
        {isLoggedIn && !isSender && reactionLoaded && myCardReaction && !reactionTrayOpen && !isPaw && (
          <motion.button
            key="preview-badge"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            onClick={() => setReactionTrayOpen(true)}
            style={{
              position: "absolute",
              bottom: 18,
              right: 22,
              background: "white",
              borderRadius: 20,
              padding: "5px 10px 5px 7px",
              border: "1.5px solid rgba(0,0,0,0.07)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.14)",
              display: "flex", alignItems: "center", gap: 4,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
              zIndex: 10,
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{myCardReaction}</span>
            {(reactionCounts[myCardReaction] ?? 0) > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#FF6B8A", lineHeight: 1 }}>
                {reactionCounts[myCardReaction]}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      </div>{/* end relative wrapper */}

      {/* ── WhatsApp-style floating emoji picker pill ── */}
      <AnimatePresence>
        {isLoggedIn && !isSender && reactionLoaded && (reactionTrayOpen || !myCardReaction) && (
          <motion.div
            key="preview-picker"
            initial={{ opacity: 0, y: 10, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.88 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <div style={{
              background: "white",
              borderRadius: 40,
              padding: "6px 10px",
              display: "flex",
              alignItems: "center",
              gap: 2,
              boxShadow: "0 4px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.07)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}>
              {reactionTrayOpen && (
                <button
                  onClick={() => setReactionTrayOpen(false)}
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "#f3f4f6", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginRight: 2, WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#6b7280" }}>✕</span>
                </button>
              )}
              {REACTION_EMOJIS.map(emoji => {
                const isMine = myCardReaction === emoji;
                return (
                  <motion.button
                    key={emoji}
                    onClick={() => reactToCard(emoji)}
                    whileTap={{ scale: 0.82 }}
                    animate={{ scale: isMine ? 1.18 : 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    style={{
                      width: 46, height: 46, borderRadius: "50%",
                      background: isMine ? "rgba(255,107,138,0.1)" : "transparent",
                      border: isMine ? "2px solid rgba(255,107,138,0.35)" : "2px solid transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", WebkitTapHighlightColor: "transparent",
                      transition: "background 0.15s, border 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CTA buttons — logged-in recipient only ── */}
      {isLoggedIn && !isSender && (
        <div className="flex justify-center px-8 pb-2 mt-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Link href={sayitBackUrl} style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 32px", borderRadius: 30, background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", color: "white", fontSize: 14, fontWeight: 700, letterSpacing: 0.5, boxShadow: "0 4px 18px rgba(255,107,138,0.35)", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
              ✨ Say it Back
            </Link>
          </motion.div>
        </div>
      )}

      {/* ── CTA button — sender viewing their own card ── */}
      {isLoggedIn && isSender && (
        <div className="flex justify-center px-8 pb-2 mt-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Link href={sayitBackUrl} style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 32px", borderRadius: 30, background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", color: "white", fontSize: 14, fontWeight: 700, letterSpacing: 0.5, boxShadow: "0 4px 18px rgba(255,107,138,0.35)", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
              ✨ Say it Again
            </Link>
          </motion.div>
        </div>
      )}

      {/* ── Guest CTA — prominent card below the card ── */}
      {!isLoggedIn && (
        <div className="mx-6 mt-2 mb-6 rounded-3xl overflow-hidden"
          style={{ background: "white", boxShadow: "0 4px 24px rgba(0,0,0,0.09)", border: "1px solid rgba(0,0,0,0.06)" }}>
          {/* Pink gradient top strip */}
          <div className="px-5 pt-5 pb-4 text-center"
            style={{ background: "linear-gradient(135deg,#FFF0F3,#F5EEFF)" }}>
            <p className="text-base font-bold text-gray-800 mb-0.5">
              {senderName.split(" ")[0]} sent you a SayIt card 💌
            </p>
            <p className="text-xs text-gray-500 leading-relaxed mb-2">
              Send beautiful cards like this for free
            </p>
            <div className="inline-flex items-center px-3 py-1.5 rounded-full"
              style={{ background: "linear-gradient(135deg,#FF6B8A18,#9B59B618)", border: "1px solid #FF6B8A30" }}>
              <p className="text-[11px] font-bold tracking-wide" style={{ color: "#9B59B6" }}>
                SEND CARD VIA CHAT, NOT EMAILS
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="px-5 py-4 flex flex-col gap-2.5">
            {/* Primary: Join Free */}
            <Link
              href={`/register?card=${code}&sender=${encodeURIComponent(senderName)}`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "13px 20px",
                borderRadius: 16,
                background: "linear-gradient(135deg,#FF6B8A,#9B59B6)",
                color: "white",
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
                boxShadow: "0 4px 14px rgba(255,107,138,0.35)",
              }}>
              <span>💌</span> Join SayIt Free
            </Link>

            {/* App store buttons row */}
            <div className="flex gap-2">
              <Link href="https://apps.apple.com" target="_blank"
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "11px 12px",
                  borderRadius: 14,
                  background: "#111",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: "none",
                }}>
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: "white", flexShrink: 0 }}>
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                App Store
              </Link>
              <Link href="https://play.google.com" target="_blank"
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "11px 12px",
                  borderRadius: 14,
                  background: "#111",
                  color: "white",
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: "none",
                }}>
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, flexShrink: 0 }} fill="none">
                  <path d="M3 20.5v-17c0-.83.94-1.3 1.6-.8l14 8.5c.6.36.6 1.24 0 1.6l-14 8.5c-.66.5-1.6.03-1.6-.8z" fill="#fff"/>
                </svg>
                Google Play
              </Link>
            </div>

            {/* Sign in link */}
            <p className="text-center text-xs text-gray-400 pt-0.5">
              Already have an account?{" "}
              <Link href={`/login?card=${code}&sender=${encodeURIComponent(senderName)}`}
                className="font-bold" style={{ color: "#FF6B8A" }}>Sign In</Link>
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Paw collage — 5 frame styles ─────────────────────────────────────────────
type PawFrameType = "wooden" | "film" | "polaroid" | "gold" | "minimal";

function PawGrid({ photos, filter = "sepia(10%) contrast(1.05)" }: { photos: string[]; filter?: string }) {
  const n = photos.length;
  const imgS: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block", filter };
  const cell = (p: string, i: number) => <div key={i} style={{ overflow: "hidden", borderRadius: 2 }}><img src={p} alt="" style={imgS} /></div>;
  if (n === 0) return null;
  // 1 photo — full frame
  if (n === 1) return <div style={{ width: "100%", height: "100%", overflow: "hidden" }}><img src={photos[0]} alt="" style={imgS} /></div>;
  // 2 photos — side by side
  if (n === 2) return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, width: "100%", height: "100%" }}>{photos.map(cell)}</div>;
  // 3 photos — 1 large top, 2 equal bottom
  if (n === 3) return (
    <div style={{ display: "grid", gridTemplateRows: "1.4fr 1fr", gap: 3, width: "100%", height: "100%" }}>
      {cell(photos[0], 0)}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>{cell(photos[1], 1)}{cell(photos[2], 2)}</div>
    </div>
  );
  // 4 photos — 2×2 grid
  if (n === 4) return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 3, width: "100%", height: "100%" }}>{photos.map(cell)}</div>;
  // 5 photos — 3 top + 2 bottom equal rows
  return (
    <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 3, width: "100%", height: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>{photos.slice(0, 3).map(cell)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>{photos.slice(3, 5).map((p, i) => cell(p, i + 3))}</div>
    </div>
  );
}

function PawCollage({ photos, message, frame, showLabel = true, showMessage = true, height }: { photos: string[]; message: string; frame: PawFrameType; showLabel?: boolean; showMessage?: boolean; height?: number }) {
  const H = height ?? 340;

  const MessageBox = ({ bg = "rgba(139,94,60,0.08)", color = "#5C3317" }: { bg?: string; color?: string }) =>
    message && showMessage ? (
      <div style={{ marginTop: 12, padding: "12px 16px", background: bg, borderRadius: 16 }}>
        <p style={{ color, fontFamily: "Georgia,serif", fontStyle: "italic", fontSize: 14, textAlign: "center", lineHeight: 1.6 }}>
          &ldquo;{message}&rdquo;
        </p>
      </div>
    ) : null;

  // ── Wooden ──────────────────────────────────────────────────────────────
  if (frame === "wooden") return (
    <div>
      <div style={{ position: "relative", width: "100%", height: H, borderRadius: 8, background: "linear-gradient(135deg,#7A4F2D 0%,#9B6B4A 15%,#5C3317 35%,#8B5E3C 55%,#6B3F1F 75%,#A07850 100%)", padding: 14, boxShadow: "3px 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.25)" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 4, background: "#1E0A00", boxShadow: "inset 0 3px 10px rgba(0,0,0,0.8)", overflow: "hidden" }}>
          <PawGrid photos={photos} />
        </div>
        <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: "repeating-linear-gradient(88deg,transparent 0,transparent 5px,rgba(0,0,0,0.025) 5px,rgba(0,0,0,0.025) 6px)", pointerEvents: "none" }} />
        {([{ top: 7, left: 7 }, { top: 7, right: 7 }, { bottom: 7, left: 7 }, { bottom: 7, right: 7 }] as React.CSSProperties[]).map((p, i) => (
          <div key={i} style={{ position: "absolute", ...p, width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%,#D4B07A,#6B4020)", boxShadow: "0 2px 4px rgba(0,0,0,0.6)", zIndex: 3 }} />
        ))}
      </div>
      {showLabel && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <div style={{ background: "linear-gradient(135deg,#C8A45A,#A07830)", borderRadius: 4, padding: "4px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
            <span style={{ fontSize: 9, color: "#FFF3D0", letterSpacing: 3, fontFamily: "Georgia,serif" }}>PAW MOMENTS</span>
          </div>
        </div>
      )}
      <MessageBox />
    </div>
  );

  // ── Film strip ───────────────────────────────────────────────────────────
  if (frame === "film") return (
    <div>
      <div style={{ position: "relative", width: "100%", height: H, background: "linear-gradient(180deg,#0f0f0f,#1a1a2e)", borderRadius: 6, boxShadow: "0 4px 20px rgba(0,0,0,0.7)", display: "flex", alignItems: "center" }}>
        <div style={{ width: 18, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", padding: "8px 0", flexShrink: 0 }}>
          {Array.from({ length: 7 }).map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: "#e94560", boxShadow: "0 0 4px #e94560" }} />)}
        </div>
        <div style={{ flex: 1, height: "calc(100% - 20px)", margin: "10px 0", borderRadius: 2, overflow: "hidden", background: "#111" }}>
          <PawGrid photos={photos} filter="contrast(1.1) saturate(0.85)" />
        </div>
        <div style={{ width: 18, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", padding: "8px 0", flexShrink: 0 }}>
          {Array.from({ length: 7 }).map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: 2, background: "#e94560", boxShadow: "0 0 4px #e94560" }} />)}
        </div>
      </div>
      {showLabel && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <span style={{ fontSize: 9, color: "#e94560", letterSpacing: 3, fontFamily: "monospace", fontWeight: 700 }}>PAW MOMENTS</span>
        </div>
      )}
      <MessageBox bg="rgba(233,69,96,0.08)" color="#c0392b" />
    </div>
  );

  // ── Polaroid ─────────────────────────────────────────────────────────────
  if (frame === "polaroid") return (
    <div>
      <div style={{ background: "#fff", borderRadius: 4, padding: "14px 14px 48px", boxShadow: "0 8px 30px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)", position: "relative" }}>
        <div style={{ height: H - 62, background: "#f0f0f0", overflow: "hidden", borderRadius: 2 }}>
          <PawGrid photos={photos} filter="brightness(0.97) saturate(1.1)" />
        </div>
        <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center" }}>
          <span style={{ fontSize: 12, color: "#888", fontFamily: "cursive, Georgia, serif", letterSpacing: 1 }}>Paw Moments 🐾</span>
        </div>
      </div>
      <MessageBox bg="rgba(0,0,0,0.04)" color="#444" />
    </div>
  );

  // ── Gold ─────────────────────────────────────────────────────────────────
  if (frame === "gold") return (
    <div>
      <div style={{ position: "relative", width: "100%", height: H, background: "linear-gradient(135deg,#B8860B,#FFD700,#C8A45A,#FFD700,#B8860B)", borderRadius: 6, padding: 16, boxShadow: "0 4px 20px rgba(184,134,11,0.5), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.2)" }}>
        <div style={{ position: "absolute", inset: 6, borderRadius: 4, border: "1px solid rgba(255,255,255,0.5)", pointerEvents: "none", zIndex: 2 }} />
        <div style={{ width: "100%", height: "100%", borderRadius: 2, overflow: "hidden", background: "#fff8e7" }}>
          <PawGrid photos={photos} filter="brightness(1.02) contrast(1.05)" />
        </div>
        {([{ top: 4, left: 4 }, { top: 4, right: 4 }, { bottom: 4, left: 4 }, { bottom: 4, right: 4 }] as React.CSSProperties[]).map((p, i) => (
          <div key={i} style={{ position: "absolute", ...p, width: 14, height: 14, zIndex: 3, fontSize: 10, lineHeight: "14px", textAlign: "center" }}>✦</div>
        ))}
      </div>
      {showLabel && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <div style={{ background: "linear-gradient(135deg,#C8A45A,#FFD700,#C8A45A)", borderRadius: 4, padding: "3px 16px", boxShadow: "0 1px 4px rgba(184,134,11,0.4)" }}>
            <span style={{ fontSize: 9, color: "#5a3e00", letterSpacing: 3, fontFamily: "Georgia,serif", fontWeight: 700 }}>PAW MOMENTS</span>
          </div>
        </div>
      )}
      <MessageBox bg="rgba(184,134,11,0.08)" color="#5a3e00" />
    </div>
  );

  // ── Minimal ──────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ position: "relative", width: "100%", height: H, background: "#fff", border: "2px solid #111", borderRadius: 4, padding: 10, boxShadow: "4px 4px 0px #111" }}>
        <div style={{ width: "100%", height: "100%", overflow: "hidden", background: "#f5f5f5" }}>
          <PawGrid photos={photos} filter="" />
        </div>
      </div>
      {showLabel && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <span style={{ fontSize: 9, color: "#111", letterSpacing: 3, fontFamily: "monospace", fontWeight: 900, textTransform: "uppercase" }}>Paw Moments</span>
        </div>
      )}
      <MessageBox bg="rgba(0,0,0,0.04)" color="#111" />
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    }>
      <PreviewInner />
    </Suspense>
  );
}
