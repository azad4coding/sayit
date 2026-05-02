"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { getTemplateById, getCategoryById, type DBTemplate, type DBCategory } from "@/lib/supabase-data";
import { ArrowLeft, Sparkles, ChevronDown, CheckCircle2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const FREE_DAILY_LIMIT = 100; // TODO: set back to 3 before launch

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://sayit-gamma.vercel.app";

const COUNTRY_CODES = [
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+1",   flag: "🇺🇸", name: "US / Canada" },
  { code: "+44",  flag: "🇬🇧", name: "UK" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+65",  flag: "🇸🇬", name: "Singapore" },
  { code: "+61",  flag: "🇦🇺", name: "Australia" },
];

type FoundUser = { id: string; name: string; phone: string };
type SearchStatus = "idle" | "searching" | "found" | "not-found";

function SendPageInner() {
  const router   = useRouter();
  const params   = useSearchParams();
  const supabase = createClient();

  const templateId = params.get("templateId") ?? "";
  const cardType   = params.get("type") ?? "";          // "paw-moments" for paw flow
  const message    = params.get("message") ?? "";

  const isPawCard    = cardType === "paw-moments";
  const isCustomCard = cardType === "custom-card";
  const isMemeCard   = cardType === "meme";
  const categorySlug = params.get("category") ?? "";

  const [template, setTemplate] = useState<DBTemplate | null>(null);
  const [category, setCategory] = useState<DBCategory | null>(null);

  // Fetch template + category from Supabase when templateId is a UUID
  useEffect(() => {
    if (!templateId || isPawCard || isCustomCard || isMemeCard) return;
    getTemplateById(templateId).then(tmpl => {
      setTemplate(tmpl);
      if (tmpl?.category_id) {
        getCategoryById(tmpl.category_id).then(setCategory);
      }
    });
  }, [templateId]);

  const [phone,          setPhone]          = useState("");
  const [countryCode,    setCountryCode]    = useState("+1");
  const [showCCDropdown, setShowCCDropdown] = useState(false);
  const [sending,        setSending]        = useState(false);
  const [shortCode,      setShortCode]      = useState("");
  const [senderName,     setSenderName]     = useState("");
  const [shared,         setShared]         = useState(false);
  const [dailyCount,     setDailyCount]     = useState<number | null>(null);
  const [showUpgrade,    setShowUpgrade]    = useState(false);
  const [country,        setCountry]        = useState("US");
  const [foundUser,      setFoundUser]      = useState<FoundUser | null>(null);
  const [searchStatus,   setSearchStatus]   = useState<SearchStatus>("idle");
  const [recipientOnApp, setRecipientOnApp] = useState(false);

  // Unified search
  const [searchQuery,    setSearchQuery]    = useState("");
  const [suggestions,    setSuggestions]    = useState<FoundUser[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedContact, setSelectedContact] = useState<FoundUser | null>(null);

  // Fetch geo on mount
  useEffect(() => {
    fetch("/api/geo").then(r => r.json()).then(d => setCountry(d.country ?? "US")).catch(() => {});
  }, []);

  // Unified search: name OR phone
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || selectedContact) { setSuggestions([]); setShowSuggestions(false); return; }

    const isPhone = /^\+?[\d\s\-()]{4,}$/.test(q);
    const timer = setTimeout(async () => {
      if (isPhone) {
        const digits = q.replace(/\D/g, "");
        // Build exact-match variants to avoid partial/false matches
        const variants: string[] = [];
        if (digits.length >= 10) {
          variants.push(`+${digits}`);                    // already has country code digits
          if (!digits.startsWith("1"))  variants.push(`+1${digits}`);   // US
          if (!digits.startsWith("91")) variants.push(`+91${digits}`);  // India
          if (!digits.startsWith("44")) variants.push(`+44${digits}`);  // UK
          if (!digits.startsWith("971")) variants.push(`+971${digits}`); // UAE
        }
        // Also try with the currently selected country code
        variants.push(`${countryCode}${digits}`);
        // Deduplicate
        const uniqueVariants = Array.from(new Set(variants));

        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("phone", uniqueVariants)
          .limit(5);
        setSuggestions((data ?? []).map((p: any) => ({ id: p.id, name: p.full_name ?? p.phone, phone: p.phone })));
      } else {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .ilike("full_name", `%${q}%`)
          .not("phone", "is", null)
          .limit(6);
        setSuggestions((data ?? []).map((p: any) => ({ id: p.id, name: p.full_name ?? "SayIt User", phone: p.phone })));
      }
      setShowSuggestions(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedContact]);

  function selectContact(contact: FoundUser) {
    setSelectedContact(contact);
    setFoundUser(contact);
    setSearchStatus("found");
    setShowSuggestions(false);
    setSearchQuery(contact.name);
    // Parse phone into country code + local number
    const raw = contact.phone ?? "";
    const matched = COUNTRY_CODES.find(c => raw.startsWith(c.code));
    if (matched) {
      setCountryCode(matched.code);
      setPhone(raw.slice(matched.code.length).replace(/\D/g, ""));
    } else {
      setPhone(raw.replace(/\D/g, ""));
    }
  }

  function clearContact() {
    setSelectedContact(null);
    setFoundUser(null);
    setSearchStatus("idle");
    setSearchQuery("");
    setPhone("");
    setSuggestions([]);
  }

  // Fetch today's card count on mount
  useEffect(() => {
    async function fetchDailyCount() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("sent_cards")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", user.id)
        .gte("created_at", today.toISOString());
      const c = count ?? 0;
      setDailyCount(c);
      if (c >= FREE_DAILY_LIMIT) setShowUpgrade(true);
    }
    fetchDailyCount();
  }, []);

  const cardUrl = shortCode ? `${BASE_URL}/preview/${shortCode}` : "";

  async function handleSend() {
    if (!phone.trim()) return;

    // ── Daily limit check ─────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("sent_cards")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", user.id)
      .gte("created_at", today.toISOString());

    if ((todayCount ?? 0) >= FREE_DAILY_LIMIT) {
      setShowUpgrade(true);
      return;
    }

    setSending(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single();
    const name = profile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Someone";
    setSenderName(name);

    // Safety net: ensure a profile row exists before inserting sent_cards
    // (the trigger can silently fail for Google OAuth or manually created users)
    if (!profile) {
      await supabase.from("profiles").upsert({
        id:        user.id,
        full_name: name,
        phone:     user.phone ?? null,
      }, { onConflict: "id" });
    }

    const code = uuidv4().slice(0, 8);
    const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;

    // Read extra data from sessionStorage based on card type
    let pawPhotos: string[] | null = null;
    let pawFrame: string | null = null;
    let customBgPhoto: string | null = null;
    let memeImageUrl: string | null = null;
    let finalMessage = message;

    if (isPawCard) {
      try {
        pawPhotos    = JSON.parse(sessionStorage.getItem("paw_photos") ?? "[]");
        finalMessage = sessionStorage.getItem("paw_message") ?? message;
        pawFrame     = sessionStorage.getItem("paw_frame") ?? "wooden";
      } catch { pawPhotos = []; pawFrame = "wooden"; }
    }

    if (isCustomCard) {
      try {
        customBgPhoto = sessionStorage.getItem("custom_bg_photo");
        finalMessage  = sessionStorage.getItem("custom_message") ?? message;
      } catch { customBgPhoto = null; }
    }

    if (isMemeCard) {
      try {
        memeImageUrl  = sessionStorage.getItem("meme_image");     // base64 data URL
        finalMessage  = sessionStorage.getItem("card_message") ?? message;
      } catch { memeImageUrl = null; }
    }

    const recipientName = foundUser?.name ?? null;

    let { error } = await supabase.from("sent_cards").insert({
      sender_id:       user.id,
      recipient_phone: fullPhone,
      recipient_id:    foundUser?.id ?? null,   // set immediately if on SayIt
      recipient_name:  recipientName,
      template_id:     templateId || null,
      message:         finalMessage,
      short_code:      code,
      sender_name:     name,
      front_image_url: template?.front_image_url ?? null,
      ...(isPawCard    && { card_type: "paw-moments",  paw_photos: pawPhotos, paw_frame: pawFrame }),
      ...(isCustomCard && { card_type: "custom-card",  paw_photos: customBgPhoto ? [customBgPhoto] : [] }),
      ...(isMemeCard   && { card_type: "meme",         meme_image_url: memeImageUrl }),
    });

    if (error) {
      ({ error } = await supabase.from("sent_cards").insert({
        sender_id:       user.id,
        recipient_phone: fullPhone,
        recipient_id:    foundUser?.id ?? null,
        recipient_name:  recipientName,
        template_id:     templateId || null,
        message:         finalMessage,
        short_code:      code,
        sender_name:     name,
        ...(isPawCard    && { card_type: "paw-moments",  paw_photos: pawPhotos, paw_frame: pawFrame }),
        ...(isCustomCard && { card_type: "custom-card",  paw_photos: customBgPhoto ? [customBgPhoto] : [] }),
        ...(isMemeCard   && { card_type: "meme",         meme_image_url: memeImageUrl }),
      }));
    }

    if (error) { alert("Failed to send: " + error.message); setSending(false); return; }

    // ── Create/upsert a My Circle request for this recipient ──────────────
    const senderPhone = user.phone ?? (profile as any)?.phone ?? null;
    await supabase.from("circles").upsert({
      sender_id:       user.id,
      sender_phone:    senderPhone,
      sender_name:     name,
      recipient_phone: fullPhone,
      recipient_id:    foundUser?.id ?? null,
      status:          "accepted",
      updated_at:      new Date().toISOString(),
    }, { onConflict: "sender_id,recipient_phone", ignoreDuplicates: true });

    setSending(false);
    if (foundUser) setRecipientOnApp(true); // skip share sheet for SayIt users
    setShortCode(code);
  }

  async function cancelSend() {
    if (!shortCode) return;
    // Delete the card and restore the daily count
    await supabase.from("sent_cards").delete().eq("short_code", shortCode);
    setShortCode("");
    setDailyCount(prev => Math.max(0, (prev ?? 1) - 1));
  }

  // ── Upgrade screen ───────────────────────────────────────────────
  if (showUpgrade) {
    return (
      <div className="flex flex-col min-h-dvh px-6 py-10 items-center justify-center"
        style={{ background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}>

        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-lg"
          style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
          <Sparkles className="w-9 h-9 text-white" />
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-gray-800 text-center">You've sent {FREE_DAILY_LIMIT} cards today</h2>
        <p className="text-gray-400 text-sm text-center mt-2 leading-relaxed">
          Free accounts can send {FREE_DAILY_LIMIT} cards per day.<br />
          Upgrade to send unlimited cards, unlock premium templates, and more.
        </p>

        {/* Perks */}
        <div className="w-full mt-8 flex flex-col gap-3">
          {[
            { icon: "💌", text: "Unlimited cards every day" },
            { icon: "✨", text: "All premium templates unlocked" },
            { icon: "🔥", text: "Priority new template access" },
            { icon: "🎙️", text: "Voice notes on cards (coming soon)" },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
              <span className="text-xl">{icon}</span>
              <p className="text-sm font-medium text-gray-700">{text}</p>
            </div>
          ))}
        </div>

        {/* Pricing */}
        {(() => {
          const isIndia = country === "IN";
          const annual  = isIndia ? { price: "₹999 / year",  sub: "Just ₹83/month — save 44%" }
                                  : { price: "$9.99 / year", sub: "Just $0.83/month — save 50%" };
          const monthly = isIndia ? { price: "₹149 / month", sub: "Cancel anytime" }
                                  : { price: "$1.99 / month", sub: "Cancel anytime" };
          return (
            <div className="w-full mt-6 flex flex-col gap-3">
              {/* Annual — highlighted */}
              <button className="w-full rounded-2xl p-4 text-white shadow-lg relative overflow-hidden"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                <div className="absolute top-2 right-3 bg-white/20 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide">BEST VALUE</div>
                <p className="text-base font-bold text-left">{annual.price}</p>
                <p className="text-xs text-white/75 text-left mt-0.5">{annual.sub}</p>
              </button>

              {/* Monthly */}
              <button className="w-full rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
                <p className="text-base font-bold text-gray-800 text-left">{monthly.price}</p>
                <p className="text-xs text-gray-400 text-left mt-0.5">{monthly.sub}</p>
              </button>
            </div>
          );
        })()}

        <p className="text-[10px] text-gray-300 mt-4 text-center">Payment coming soon — tap to join the waitlist</p>

        {/* Dismiss */}
        <button onClick={() => setShowUpgrade(false)}
          className="mt-6 text-sm text-gray-400 font-medium">
          Maybe later — cards reset tomorrow
        </button>
      </div>
    );
  }

  // ── Direct delivery success (recipient is on SayIt) ─────────────
  if (shortCode && recipientOnApp && foundUser) {
    const initials = foundUser.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
    return (
      <div className="flex flex-col min-h-dvh items-center justify-center px-8 gap-6"
        style={{ background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}>
        {/* Avatar */}
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-2xl font-bold text-white shadow-xl"
          style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
          {initials}
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5" style={{ color: "#22c55e" }} />
            <span className="text-sm font-semibold text-green-600">Delivered on SayIt</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">
            Card sent to {foundUser.name.split(" ")[0]}! 🎉
          </h2>
          <p className="text-gray-400 text-sm mt-2 leading-relaxed">
            {foundUser.name.split(" ")[0]} will see it in their Chats tab right now.
            No link needed 💌
          </p>
        </div>
        <div className="w-full flex flex-col gap-3">
          <button onClick={() => router.push("/home")}
            className="w-full py-4 rounded-2xl text-white font-semibold shadow-md"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
            Send Another Card
          </button>
          <button onClick={() => router.push("/history")}
            className="w-full py-4 rounded-2xl bg-white border border-gray-100 text-gray-600 font-semibold shadow-sm">
            View Sent Cards
          </button>
        </div>
      </div>
    );
  }

  // ── Post-share confirmation (iMessage / WhatsApp flow) ───────────
  if (shortCode && shared) {
    const firstName = phone ? `+${countryCode.replace("+", "")}${phone}` : "them";
    const displayName = foundUser?.name?.split(" ")[0] ?? senderName.split(" ")[0] ?? firstName;
    return (
      <div className="flex flex-col min-h-dvh items-center justify-center px-8 gap-6"
        style={{ background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}>

        {/* Animated success ring + checkmark */}
        <div style={{ position: "relative", width: 96, height: 96 }}>
          <div className="absolute inset-0 rounded-full animate-ping"
            style={{ background: "linear-gradient(135deg,#FF6B8A40,#9B59B640)" }} />
          <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-xl relative"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">Card sent! 🎉</h2>
          <p className="text-gray-400 text-sm mt-2 leading-relaxed">
            Your card is on its way to{" "}
            <span className="font-semibold text-gray-700">{displayName}</span>.<br />
            They&apos;ll see it as soon as they tap the link 💌
          </p>
        </div>

        {/* Card thumbnail */}
        {template && (
          <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 w-full">
            <div className="relative w-10 h-14 rounded-xl overflow-hidden flex-shrink-0">
              <Image src={template.front_image_url} alt="" fill className="object-cover" sizes="40px" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400">Sent card</p>
              <p className="font-semibold text-gray-800 text-sm">{template.title}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: "#22c55e" }} />
          </div>
        )}

        {/* CTAs */}
        <div className="w-full flex flex-col gap-3">
          <button onClick={() => router.push("/home")}
            className="w-full py-4 rounded-2xl text-white font-semibold shadow-md"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
            Send Another Card
          </button>
          <button onClick={() => router.push("/history")}
            className="w-full py-4 rounded-2xl bg-white border border-gray-100 text-gray-600 font-semibold shadow-sm">
            View Sent Cards
          </button>
        </div>
      </div>
    );
  }

  // ── Share sheet ──────────────────────────────────────────────────
  if (shortCode) {
    const shareText = `${senderName} sent you a card 💌 Open it here: ${cardUrl}`;
    // Strip non-digits for WhatsApp (needs raw number)
    // Strip everything except digits, then ensure country code is present
    let rawPhone = phone.replace(/\D/g, "");
    // If no country code (10 digits = Indian mobile), prepend 91
    if (rawPhone.length === 10) rawPhone = "91" + rawPhone;
    const smsHref = `sms:${phone.trim()}&body=${encodeURIComponent(shareText)}`;
    const waHref  = `https://wa.me/${rawPhone}?text=${encodeURIComponent(shareText)}`;

    return (
      <div className="flex flex-col min-h-dvh" style={{ background: "linear-gradient(160deg,#FFF5F7,#F8F0FF)" }}>
        {/* Header */}
        <div className="px-5 pt-14 pb-2 flex items-center gap-3">
          <button onClick={async () => { await cancelSend(); router.push("/home"); }}
            className="w-9 h-9 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex flex-col items-center px-6 pt-4 pb-10 gap-6 flex-1">
          {/* Card preview */}
          {isPawCard ? (
            <div className="w-44 h-44 rounded-3xl shadow-2xl flex items-center justify-center text-6xl overflow-hidden"
              style={{ background: "linear-gradient(135deg,#9B59B6,#C39BD3)" }}>
              🐾
            </div>
          ) : isCustomCard && (() => { try { return sessionStorage.getItem("custom_bg_photo"); } catch { return null; } })() ? (
            <div className="relative w-44 h-60 rounded-3xl overflow-hidden shadow-2xl">
              <img
                src={(() => { try { return sessionStorage.getItem("custom_bg_photo") ?? ""; } catch { return ""; } })()}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <span className="text-white text-xs font-semibold tracking-wider">{category?.icon} {category?.name}</span>
              </div>
            </div>
          ) : template ? (
            <div className="relative w-44 h-60 rounded-3xl overflow-hidden shadow-2xl">
              <Image src={template.front_image_url} alt="" fill className="object-cover" sizes="176px" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
          ) : (
            <div className="w-44 h-60 rounded-3xl shadow-2xl flex items-center justify-center text-6xl"
              style={{ background: `linear-gradient(135deg,${category?.gradient_from ?? "#FF6B8A"},${category?.gradient_to ?? "#9B59B6"})` }}>
              💌
            </div>
          )}

          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">Card Ready! 🎉</h2>
            <p className="text-gray-400 text-sm mt-1">Now choose how to deliver it</p>
          </div>

          {/* Share buttons */}
          <div className="w-full flex flex-col gap-3">
            {/* iMessage / SMS */}
            <a href={smsHref}
              onClick={() => setTimeout(() => setShared(true), 600)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-white font-semibold shadow-lg"
              style={{ background: "linear-gradient(135deg,#34C759,#30D158)" }}>
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl flex-shrink-0">💬</div>
              <div className="flex-1">
                <p className="text-sm font-bold">iMessage / SMS</p>
                <p className="text-xs text-white/75">Opens Messages app</p>
              </div>
              <span className="text-white/60 text-lg">›</span>
            </a>

            {/* WhatsApp */}
            <a href={waHref} target="_blank" rel="noopener noreferrer"
              onClick={() => setTimeout(() => setShared(true), 600)}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-white font-semibold shadow-lg"
              style={{ background: "linear-gradient(135deg,#25D366,#128C7E)" }}>
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl flex-shrink-0">💚</div>
              <div className="flex-1">
                <p className="text-sm font-bold">WhatsApp</p>
                <p className="text-xs text-white/75">Opens WhatsApp chat</p>
              </div>
              <span className="text-white/60 text-lg">›</span>
            </a>

          </div>

          {/* Cancel — restores daily count */}
          <button
            onClick={async () => { await cancelSend(); router.push("/home"); }}
            className="w-full py-4 rounded-2xl bg-white border border-gray-100 text-gray-500 font-semibold text-sm shadow-sm mt-1">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-gray-800">Send Card</h2>
          <p className="text-xs text-gray-400">Search by name or enter a number</p>
        </div>
        {template && (
          <div className="relative w-10 h-14 rounded-xl overflow-hidden shadow-sm">
            <Image src={template.front_image_url} alt="" fill className="object-cover" sizes="40px" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 px-5 py-8">
        {/* Card preview strip */}
        {template && (
          <div className="flex gap-3 items-center bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
            <div className="relative w-12 h-16 rounded-xl overflow-hidden flex-shrink-0">
              <Image src={template.front_image_url} alt="" fill className="object-cover" sizes="48px" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Sending</p>
              <p className="font-semibold text-gray-800 text-sm">{template.title}</p>
              {message && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 italic">"{message}"</p>}
            </div>
          </div>
        )}

        {/* Unified recipient search */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <label className="text-xs font-semibold text-gray-500 mb-2 block">Send To</label>

          {/* Search input or selected contact chip */}
          {selectedContact ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: "linear-gradient(135deg,#FF6B8A10,#9B59B610)", border: "1px solid #FF6B8A30" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                {selectedContact.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{selectedContact.name}</p>
                <p className="text-[11px] text-green-600 font-medium">✓ On SayIt — card will be delivered directly</p>
              </div>
              <button onClick={clearContact} className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">✕</button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or enter phone number"
                value={searchQuery}
                onChange={e => {
                  const v = e.target.value;
                  setSearchQuery(v);
                  // If it looks like a phone, also update the phone state
                  if (/^\+?[\d\s\-()]+$/.test(v)) {
                    setPhone(v.replace(/\D/g, ""));
                    setFoundUser(null);
                    setSearchStatus("idle");
                  }
                }}
                onFocus={() => searchQuery && setShowSuggestions(true)}
                className="w-full px-4 py-3.5 rounded-xl border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 bg-gray-50"
                autoFocus
              />
              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  {suggestions.map(s => (
                    <button key={s.id} onClick={() => selectContact(s)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 border-b border-gray-50 last:border-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                        {s.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                        <p className="text-[11px] text-green-600">✓ On SayIt</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manual phone input shown when query looks like a phone number and no contact selected */}
          {!selectedContact && phone.length >= 6 && (
            <div className="mt-3">
              <div className="flex gap-2">
                <div className="relative">
                  <button type="button" onClick={() => setShowCCDropdown(v => !v)}
                    className="h-full px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap">
                    <span>{COUNTRY_CODES.find(c => c.code === countryCode)?.flag}</span>
                    <span className="text-gray-700">{countryCode}</span>
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </button>
                  {showCCDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50" style={{ minWidth: 180 }}>
                      {COUNTRY_CODES.map(c => (
                        <button key={c.code} type="button"
                          onClick={() => { setCountryCode(c.code); setShowCCDropdown(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 text-left"
                          style={{ fontWeight: c.code === countryCode ? 700 : 400, color: c.code === countryCode ? "#FF6B8A" : "#333" }}>
                          <span>{c.flag}</span><span>{c.name}</span>
                          <span className="ml-auto text-gray-400 text-xs">{c.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600">
                  {phone}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2 px-1">👋 Not on SayIt yet — you can invite them via WhatsApp or SMS</p>
            </div>
          )}
        </div>

        {/* Daily limit indicator */}
        {dailyCount !== null && (
          <div className="flex items-center justify-between px-1">
            <div className="flex gap-1.5 items-center">
              {Array.from({ length: FREE_DAILY_LIMIT }).map((_, i) => (
                <div key={i} className="w-8 h-1.5 rounded-full transition-all"
                  style={{ background: i < dailyCount
                    ? "linear-gradient(135deg,#FF6B8A,#9B59B6)"
                    : "#E5E7EB" }} />
              ))}
            </div>
            <p className="text-[11px] text-gray-400">
              {FREE_DAILY_LIMIT - dailyCount} of {FREE_DAILY_LIMIT} cards left today
              {dailyCount >= FREE_DAILY_LIMIT - 1 && (
                <span className="ml-1 font-semibold" style={{ color: "#FF6B8A" }}>
                  {dailyCount >= FREE_DAILY_LIMIT ? "· Limit reached" : "· Last one!"}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Send button — or upgrade CTA if limit hit */}
        {dailyCount !== null && dailyCount >= FREE_DAILY_LIMIT ? (
          <button
            onClick={() => setShowUpgrade(true)}
            className="w-full py-4 rounded-2xl text-white font-semibold shadow-md flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
            <Sparkles className="w-4 h-4" /> Upgrade to Send More
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={(!phone.trim() && !selectedContact) || sending}
            className="w-full py-4 text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg,#FF6B8A,#9B59B6)",
              borderRadius: 30,
              boxShadow: "0 4px 18px rgba(255,107,138,0.35)",
              fontSize: 15,
              letterSpacing: 0.5,
            }}>
            {sending
              ? <><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Sending…</>
              : selectedContact
                ? <>✨ SayIt to {selectedContact.name.split(" ")[0]}</>
                : foundUser
                ? <>✨ SayIt to {foundUser.name.split(" ")[0]}</>
                : <>✨ SayIt</>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function SendPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    }>
      <SendPageInner />
    </Suspense>
  );
}
