"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Search, ArrowLeft, ChevronDown, CheckCircle2, X, Share2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://sayit-gamma.vercel.app";

const AMOUNTS = [10, 15, 25, 50, 75, 100];

const COUNTRY_CODES = [
  { code: "+91",  flag: "🇮🇳", name: "India"        },
  { code: "+1",   flag: "🇺🇸", name: "US / Canada"  },
  { code: "+44",  flag: "🇬🇧", name: "UK"           },
  { code: "+971", flag: "🇦🇪", name: "UAE"          },
  { code: "+65",  flag: "🇸🇬", name: "Singapore"    },
  { code: "+61",  flag: "🇦🇺", name: "Australia"    },
];

const VENDORS = [
  { id: "starbucks",  name: "Starbucks",  emoji: "☕", color: "#00704A", bg: "#E8F5E9", website: "https://www.starbucks.com/gift" },
  { id: "target",     name: "Target",     emoji: "🎯", color: "#CC0000", bg: "#FFEBEE", website: "https://www.target.com/gift-cards" },
  { id: "amazon",     name: "Amazon",     emoji: "📦", color: "#FF9900", bg: "#FFF8E1", website: "https://www.amazon.com/gift-cards" },
  { id: "netflix",    name: "Netflix",    emoji: "🎬", color: "#E50914", bg: "#FFEBEE", website: "https://www.netflix.com/giftcards" },
  { id: "spotify",    name: "Spotify",    emoji: "🎵", color: "#1DB954", bg: "#E8F5E9", website: "https://www.spotify.com/gift-card" },
  { id: "apple",      name: "Apple",      emoji: "🍎", color: "#555555", bg: "#F5F5F5", website: "https://www.apple.com/shop/gift-cards" },
  { id: "doordash",   name: "DoorDash",   emoji: "🚗", color: "#FF3008", bg: "#FFEBEE", website: "https://www.doordash.com/giftcard" },
  { id: "ubereats",   name: "Uber Eats",  emoji: "🍔", color: "#06C167", bg: "#E8F5E9", website: "https://www.ubereats.com" },
  { id: "sephora",    name: "Sephora",    emoji: "💄", color: "#333333", bg: "#F5F5F5", website: "https://www.sephora.com/gift-cards" },
  { id: "bestbuy",    name: "Best Buy",   emoji: "💻", color: "#0046BE", bg: "#E3F2FD", website: "https://www.bestbuy.com/gift-cards" },
  { id: "walmart",    name: "Walmart",    emoji: "🛒", color: "#0071CE", bg: "#E3F2FD", website: "https://www.walmart.com/cp/gift-cards" },
  { id: "dunkin",     name: "Dunkin'",    emoji: "🍩", color: "#FF6319", bg: "#FFF3E0", website: "https://www.dunkindonuts.com/en/gift-cards" },
  { id: "airbnb",     name: "Airbnb",     emoji: "🏠", color: "#FF5A5F", bg: "#FFEBEE", website: "https://www.airbnb.com/gift-cards" },
  { id: "nordstrom",  name: "Nordstrom",  emoji: "👗", color: "#1E1E1E", bg: "#F5F5F5", website: "https://www.nordstrom.com/gift-cards" },
  { id: "gap",        name: "Gap",        emoji: "👕", color: "#005580", bg: "#E3F2FD", website: "https://www.gap.com/gift-cards" },
  { id: "gamestop",   name: "GameStop",   emoji: "🎮", color: "#E31837", bg: "#FFEBEE", website: "https://www.gamestop.com/gift-cards" },
];

type Step = "browse" | "amount" | "send" | "done";
type Vendor = typeof VENDORS[0];
type FoundUser = { id: string; name: string; phone: string };

export default function GiftCardsPage() {
  const router = useRouter();
  const [step,            setStep]            = useState<Step>("browse");
  const [searchQuery,     setSearchQuery]     = useState("");
  const [selectedVendor,  setSelectedVendor]  = useState<Vendor | null>(null);
  const [selectedAmount,  setSelectedAmount]  = useState<number | null>(null);
  const [note,            setNote]            = useState("");

  // Send step
  const [phoneSearch,     setPhoneSearch]     = useState("");
  const [phone,           setPhone]           = useState("");
  const [countryCode,     setCountryCode]     = useState("+1");
  const [showCC,          setShowCC]          = useState(false);
  const [suggestions,     setSuggestions]     = useState<FoundUser[]>([]);
  const [selectedContact, setSelectedContact] = useState<FoundUser | null>(null);
  const [sending,         setSending]         = useState(false);
  const [shortCode,       setShortCode]       = useState("");
  const [senderName,      setSenderName]      = useState("");
  const [error,           setError]           = useState("");

  const accent = "#FF6B8A";

  // ── Vendor search ────────────────────────────────────────────────
  const filteredVendors = VENDORS.filter(v =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Contact search ───────────────────────────────────────────────
  useEffect(() => {
    if (!phoneSearch.trim() || selectedContact) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .ilike("full_name", `%${phoneSearch}%`)
        .not("phone", "is", null)
        .limit(6);
      setSuggestions((data ?? []).map((p: any) => ({
        id: p.id, name: p.full_name ?? "SayIt User", phone: p.phone,
      })));
    }, 350);
    return () => clearTimeout(timer);
  }, [phoneSearch, selectedContact]);

  function selectContact(c: FoundUser) {
    setSelectedContact(c);
    setPhoneSearch(c.name);
    setSuggestions([]);
    const raw = c.phone ?? "";
    const matched = COUNTRY_CODES.find(cc => raw.startsWith(cc.code));
    if (matched) {
      setCountryCode(matched.code);
      setPhone(raw.slice(matched.code.length).replace(/\D/g, ""));
    } else {
      setPhone(raw.replace(/\D/g, ""));
    }
  }

  function clearContact() {
    setSelectedContact(null);
    setPhoneSearch("");
    setPhone("");
    setSuggestions([]);
  }

  // ── Send ─────────────────────────────────────────────────────────
  async function handleSend() {
    const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;
    if (!selectedVendor || !selectedAmount || !fullPhone || fullPhone.replace(/\D/g, "").length < 7) {
      setError("Please enter a recipient phone number"); return;
    }
    setSending(true); setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profile } = await supabase
      .from("profiles").select("full_name").eq("id", user.id).single();
    const name = profile?.full_name ?? user.user_metadata?.full_name ?? "Someone";
    setSenderName(name);

    const code = uuidv4().slice(0, 8);

    // Store gift card metadata as JSON in the message field
    const gcData = JSON.stringify({
      vendor:        selectedVendor.id,
      vendorName:    selectedVendor.name,
      vendorEmoji:   selectedVendor.emoji,
      vendorColor:   selectedVendor.color,
      vendorBg:      selectedVendor.bg,
      vendorWebsite: selectedVendor.website,
      amount:        selectedAmount,
      note:          note.trim(),
    });

    const { error: dbErr } = await supabase.from("sent_cards").insert({
      sender_id:       user.id,
      recipient_phone: fullPhone,
      recipient_id:    selectedContact?.id ?? null,
      recipient_name:  selectedContact?.name ?? null,
      template_id:     null,
      message:         gcData,
      short_code:      code,
      sender_name:     name,
      card_type:       "gift-card",
      front_image_url: null,
    });

    if (dbErr) { setError("Failed to send: " + dbErr.message); setSending(false); return; }

    setSending(false);
    setShortCode(code);
    setStep("done");
  }

  const cardUrl = shortCode ? `${BASE_URL}/preview/${shortCode}` : "";

  // ─────────────────────────────────────────────────────────────────
  // STEP: BROWSE
  // ─────────────────────────────────────────────────────────────────
  if (step === "browse") {
    return (
      <div className="flex flex-col min-h-dvh pb-28" style={{ background: "linear-gradient(180deg,#FAFAF8,#F2F1EE)" }}>
        <style>{`#gc-search::placeholder { color: rgba(255,255,255,0.8); opacity: 1; }`}</style>

        {/* Premium gradient header */}
        <div style={{ background: "linear-gradient(135deg,#FF9900 0%,#FF6B8A 50%,#9B59B6 100%)", padding: "100px 20px 28px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -25, right: -25, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", bottom: -15, right: 50, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
          <div style={{ position: "absolute", top: 25, left: -20, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
          {/* Back button */}
          <button onClick={() => router.push("/home")}
            style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div style={{ marginTop: 4 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>✨ A new way to celebrate</p>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "white", margin: "4px 0 2px", letterSpacing: -0.5, lineHeight: 1.2 }}>SayIt with a<br/>GIFT CARD 🎁</h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", margin: 0 }}>Pick a brand, choose an amount, send love</p>
          </div>
          {/* Search bar inside header */}
          <div style={{ marginTop: 16, position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.6)" }} />
            <input
              id="gc-search"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Starbucks, Amazon…"
              style={{ width: "100%", background: "rgba(255,255,255,0.22)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 14, padding: "11px 40px 11px 38px", color: "white", fontSize: 14, outline: "none", boxSizing: "border-box", WebkitTextFillColor: "white" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
                <X style={{ width: 14, height: 14, color: "rgba(255,255,255,0.7)" }} />
              </button>
            )}
          </div>
        </div>

        {/* Vendor grid */}
        <div className="px-4 pt-4">
          {!searchQuery && (
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Popular Brands</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {filteredVendors.map(vendor => (
              <button
                key={vendor.id}
                onClick={() => { setSelectedVendor(vendor); setStep("amount"); }}
                className="text-left active:scale-95 transition-transform"
                style={{ background: "white", borderRadius: 20, padding: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.07)", border: `1px solid ${vendor.color}20` }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 10, background: `linear-gradient(135deg,${vendor.color}22,${vendor.color}11)`, boxShadow: `0 3px 10px ${vendor.color}30` }}>
                  {vendor.emoji}
                </div>
                <p style={{ fontWeight: 700, fontSize: 14, color: "#111827", margin: "0 0 2px" }}>{vendor.name}</p>
                <p style={{ fontSize: 11, color: vendor.color, fontWeight: 600, margin: 0 }}>Gift Card</p>
              </button>
            ))}
          </div>

          {filteredVendors.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🎁</p>
              <p className="text-sm">No brands found for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP: AMOUNT
  // ─────────────────────────────────────────────────────────────────
  if (step === "amount" && selectedVendor) {
    return (
      <div className="flex flex-col min-h-dvh pb-28" style={{ background: "linear-gradient(180deg,#FFF5F7 0%,#f9f9f9 40%)" }}>

        {/* Header */}
        <div className="px-5 pt-14 pb-5 flex items-center gap-3">
          <button onClick={() => setStep("browse")}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center border border-gray-100">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div>
            <p className="text-xs text-gray-400">Customize</p>
            <h2 className="text-lg font-bold text-gray-800">{selectedVendor.name} Gift Card</h2>
          </div>
        </div>

        {/* Gift card preview */}
        <div className="px-5 mb-6">
          <div className="rounded-3xl overflow-hidden shadow-xl relative"
            style={{ background: `linear-gradient(135deg, ${selectedVendor.color}CC, ${selectedVendor.color})`, height: 180 }}>
            {/* Decorative circles */}
            <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full opacity-20 bg-white" />
            <div className="absolute -right-2 bottom-4 w-24 h-24 rounded-full opacity-10 bg-white" />
            {/* Content */}
            <div className="absolute inset-0 flex items-center px-7 gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-3xl shadow-lg flex-shrink-0">
                {selectedVendor.emoji}
              </div>
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">Gift Card</p>
                <p className="text-white font-bold text-2xl mt-0.5">{selectedVendor.name}</p>
                {selectedAmount && (
                  <p className="text-white/90 text-3xl font-black mt-1">${selectedAmount}</p>
                )}
              </div>
            </div>
            {/* Bottom strip */}
            <div className="absolute bottom-0 inset-x-0 px-7 py-2.5 flex justify-between items-center"
              style={{ background: "rgba(0,0,0,0.2)" }}>
              <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider">Sent via SayIt 💌</p>
              <p className="text-white/60 text-[10px]">sayit.app</p>
            </div>
          </div>
        </div>

        {/* Amount selection */}
        <div className="px-5 mb-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Choose Amount</p>
          <div className="grid grid-cols-3 gap-2.5">
            {AMOUNTS.map(amt => (
              <button
                key={amt}
                onClick={() => setSelectedAmount(amt)}
                className="py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
                style={selectedAmount === amt
                  ? { background: `linear-gradient(135deg, ${selectedVendor.color}, ${selectedVendor.color}CC)`, color: "white", boxShadow: `0 4px 16px ${selectedVendor.color}55` }
                  : { background: "white", color: "#374151", border: "1.5px solid #e5e7eb" }
                }>
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* Personal note */}
        <div className="px-5 mb-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Personal Note (optional)</p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Write a heartfelt message…"
            rows={3}
            className="w-full rounded-2xl border border-gray-100 bg-white px-4 py-3.5 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-200 shadow-sm resize-none"
          />
        </div>

        {/* CTA */}
        <div className="px-5">
          <button
            onClick={() => { if (selectedAmount) setStep("send"); }}
            disabled={!selectedAmount}
            className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg disabled:opacity-40 transition-opacity"
            style={{ background: selectedAmount ? `linear-gradient(135deg,#FF6B8A,#9B59B6)` : "#e5e7eb" }}>
            SayIt with Gift Card 🎁
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP: SEND (recipient picker) — mirrors card send page styling
  // ─────────────────────────────────────────────────────────────────
  if (step === "send" && selectedVendor && selectedAmount) {
    return (
      <div className="flex flex-col min-h-dvh bg-gray-50">

        {/* Header — matches card send page exactly */}
        <div className="bg-white px-5 pt-14 pb-4 flex items-center gap-3 shadow-sm">
          <button onClick={() => setStep("amount")}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h2 className="font-bold text-gray-800">Send Gift Card</h2>
            <p className="text-xs text-gray-400">Search by name or enter a number</p>
          </div>
          {/* Gift card thumbnail in top-right */}
          <div className="w-10 h-14 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 text-2xl"
            style={{ background: `linear-gradient(135deg,${selectedVendor.color}CC,${selectedVendor.color})` }}>
            {selectedVendor.emoji}
          </div>
        </div>

        <div className="flex flex-col gap-4 px-5 py-6">

          {/* Gift card preview strip — matches card preview strip */}
          <div className="flex gap-3 items-center bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
            <div className="w-12 h-16 rounded-xl flex items-center justify-center text-2xl shadow-sm flex-shrink-0"
              style={{ background: `linear-gradient(135deg,${selectedVendor.color}CC,${selectedVendor.color})` }}>
              {selectedVendor.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">Sending</p>
              <p className="font-semibold text-gray-800 text-sm">{selectedVendor.name} Gift Card · ${selectedAmount}</p>
              {note && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 italic">&ldquo;{note}&rdquo;</p>}
            </div>
          </div>

          {/* Unified recipient search — matches card send page */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="text-xs font-semibold text-gray-500 mb-2 block">Send To</label>

            {/* Selected contact chip */}
            {selectedContact ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: "linear-gradient(135deg,#FF6B8A10,#9B59B610)", border: "1px solid #FF6B8A30" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                  {selectedContact.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{selectedContact.name}</p>
                  <p className="text-[11px] text-green-600 font-medium">✓ On SayIt — gift card will be delivered directly</p>
                </div>
                <button onClick={clearContact}
                  className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">✕</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name or enter phone number"
                  value={phoneSearch}
                  onChange={e => {
                    setPhoneSearch(e.target.value);
                    if (/^\+?[\d\s\-()]+$/.test(e.target.value)) {
                      setPhone(e.target.value.replace(/\D/g, ""));
                    }
                  }}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 bg-gray-50"
                  autoFocus
                />
                {/* Suggestions dropdown */}
                {suggestions.length > 0 && (
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

            {/* Phone input — shows when typing a phone number */}
            {!selectedContact && phone.length >= 6 && (
              <div className="mt-3">
                <div className="flex gap-2">
                  <div className="relative">
                    <button onClick={() => setShowCC(v => !v)}
                      className="h-full px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap">
                      <span>{COUNTRY_CODES.find(c => c.code === countryCode)?.flag}</span>
                      <span className="text-gray-700">{countryCode}</span>
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    </button>
                    {showCC && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50" style={{ minWidth: 180 }}>
                        {COUNTRY_CODES.map(c => (
                          <button key={c.code} onClick={() => { setCountryCode(c.code); setShowCC(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 text-left"
                            style={{ fontWeight: c.code === countryCode ? 700 : 400, color: c.code === countryCode ? "#FF6B8A" : "#333" }}>
                            <span>{c.flag}</span><span>{c.name}</span>
                            <span className="ml-auto text-gray-400 text-xs">{c.code}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600">{phone}</div>
                </div>
                <p className="text-xs text-gray-400 mt-2 px-1">👋 Not on SayIt yet — you can share the link with them</p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 text-red-500 text-xs px-4 py-3 rounded-2xl">{error}</div>
          )}

          {/* SayIt with GIFT CARD button — pill style matching app */}
          <button
            onClick={handleSend}
            disabled={sending || (!phone.trim() && !selectedContact)}
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
                ? <>✨ SayIt with GIFT CARD to {selectedContact.name.split(" ")[0]}</>
                : <>✨ SayIt with GIFT CARD</>}
          </button>

        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // STEP: DONE
  // ─────────────────────────────────────────────────────────────────
  if (step === "done" && selectedVendor && selectedAmount) {
    return (
      <div className="flex flex-col min-h-dvh items-center justify-center px-6 pb-28"
        style={{ background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}>

        {/* Success icon */}
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-xl mb-6"
          style={{ background: `linear-gradient(135deg,${selectedVendor.color}CC,${selectedVendor.color})` }}>
          {selectedVendor.emoji}
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-2">Gift Card Sent! 🎉</h2>
        <p className="text-sm text-gray-400 text-center mb-6 leading-relaxed">
          Your <span className="font-semibold text-gray-700">${selectedAmount} {selectedVendor.name}</span> gift card<br />is on its way
        </p>

        {/* Share */}
        {cardUrl && (
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: `${selectedVendor.name} Gift Card from ${senderName}`, text: `I sent you a $${selectedAmount} ${selectedVendor.name} gift card! Open it here:`, url: cardUrl });
              } else {
                navigator.clipboard.writeText(cardUrl);
              }
            }}
            className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg flex items-center justify-center gap-2 mb-3"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
            <Share2 className="w-4 h-4" />
            Share Gift Card Link
          </button>
        )}

        <button
          onClick={() => router.push("/history")}
          className="w-full py-3.5 rounded-2xl bg-white border border-gray-100 shadow-sm text-sm font-semibold text-gray-600">
          View in Chat History
        </button>

        <button
          onClick={() => { setStep("browse"); setSelectedVendor(null); setSelectedAmount(null); setNote(""); setPhone(""); setPhoneSearch(""); setSelectedContact(null); setShortCode(""); }}
          className="mt-3 text-sm font-semibold" style={{ color: accent }}>
          Send Another Gift Card
        </button>
      </div>
    );
  }

  return null;
}
