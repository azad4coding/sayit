"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { getTemplateById, getCategoryById, type DBTemplate, type DBCategory } from "@/lib/supabase-data";
import { ensurePlus } from "@/lib/phone";
import { getOrRequestContacts, type SayItContact } from "@/lib/contacts";
import { ArrowLeft, Sparkles, ChevronDown, CheckCircle2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const FREE_DAILY_LIMIT = 10;
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

function SendPageInner() {
  const router   = useRouter();
  const params   = useSearchParams();
  const supabase = createClient();

  const templateId     = params.get("templateId") ?? "";
  const cardType       = params.get("type") ?? "";
  const message        = params.get("message") ?? "";
  const signatureParam = params.get("signature") ?? "";

  const isPawCard    = cardType === "paw-moments";
  const isCustomCard = cardType === "custom-card";
  const isMemeCard   = cardType === "meme";
  const categorySlug = params.get("category") ?? "";

  const [template, setTemplate] = useState<DBTemplate | null>(null);
  const [category, setCategory] = useState<DBCategory | null>(null);

  useEffect(() => {
    if (!templateId || isPawCard || isCustomCard || isMemeCard) return;
    getTemplateById(templateId).then(tmpl => {
      setTemplate(tmpl);
      if (tmpl?.category_id) getCategoryById(tmpl.category_id).then(setCategory);
    });
  }, [templateId]);

  // ── Contact state ─────────────────────────────────────────────────────
  const [sayItContacts,   setSayItContacts]   = useState<SayItContact[]>([]);
  const [contactsGranted, setContactsGranted] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [searchQuery,     setSearchQuery]     = useState("");
  const [suggestions,     setSuggestions]     = useState<SayItContact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedContact, setSelectedContact] = useState<SayItContact | null>(null);

  // Phone input (for manual entry when no contact selected)
  const [phone,          setPhone]          = useState("");
  const [countryCode,    setCountryCode]    = useState("+1");
  const [showCCDropdown, setShowCCDropdown] = useState(false);

  // Send state
  const [sending,        setSending]        = useState(false);
  const [shortCode,      setShortCode]      = useState("");
  const [senderName,     setSenderName]     = useState("");
  const [shared,         setShared]         = useState(false);
  const [dailyCount,     setDailyCount]     = useState<number | null>(null);
  const [showUpgrade,    setShowUpgrade]    = useState(false);
  const [country,        setCountry]        = useState("US");
  const [foundUser,      setFoundUser]      = useState<FoundUser | null>(null);
  const [phoneError,     setPhoneError]     = useState<string | null>(null);
  const [recipientOnApp, setRecipientOnApp] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [pendingCircle,  setPendingCircle]  = useState<Record<string, unknown> | null>(null);
  const [cardSaved,      setCardSaved]      = useState(false);
  // True when registered recipient hasn't received from us before → WhatsApp/SMS forced
  const [firstContactForced, setFirstContactForced] = useState(false);

  // ── Load device contacts on mount + request permission ───────────────
  useEffect(() => {
    getOrRequestContacts(supabase).then(({ granted, contacts }) => {
      setContactsGranted(granted);
      setSayItContacts(contacts);
      setContactsLoading(false);
    });
  }, []);

  // ── Geo + daily count ─────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/geo").then(r => r.json()).then(d => setCountry(d.country ?? "US")).catch(() => {});
  }, []);

  useEffect(() => {
    async function fetchDailyCount() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("sent_cards").select("id", { count: "exact", head: true })
        .eq("sender_id", user.id).gte("created_at", today.toISOString());
      const c = count ?? 0;
      setDailyCount(c);
      if (c >= FREE_DAILY_LIMIT) setShowUpgrade(true);
    }
    fetchDailyCount();
  }, []);

  // ── Pre-fill from Circle page ─────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("circle_contact");
      if (!raw) return;
      sessionStorage.removeItem("circle_contact");
      const contact: FoundUser = JSON.parse(raw);
      if (!contact?.phone) return;
      // Find in sayItContacts or create a synthetic entry
      const match = sayItContacts.find(c => c.phones.includes(contact.phone) || c.primaryPhone === contact.phone);
      if (match) {
        selectContact(match);
      } else {
        // Synthetic contact (they're on SayIt but not in device contacts)
        const synthetic: SayItContact = {
          displayName: contact.name,
          phones: [contact.phone],
          userId: contact.id,
          onSayIt: true,
          primaryPhone: contact.phone,
        };
        selectContact(synthetic);
      }
    } catch { /* ignore */ }
  }, [sayItContacts]);

  // ── Search: filter device contacts by name or phone ──────────────────
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || selectedContact) { setSuggestions([]); setShowSuggestions(false); return; }

    const isPhone = /^\+?[\d\s\-()]{4,}$/.test(q);

    if (isPhone) {
      // Phone typed: check Supabase for that specific number (still allowed)
      const digits = q.replace(/\D/g, "");
      setPhone(digits);
      const variants: string[] = [];
      if (digits.length >= 10) {
        variants.push(`+${digits}`);
        if (!digits.startsWith("1"))   variants.push(`+1${digits}`);
        if (!digits.startsWith("91"))  variants.push(`+91${digits}`);
        if (!digits.startsWith("44"))  variants.push(`+44${digits}`);
        if (!digits.startsWith("971")) variants.push(`+971${digits}`);
      }
      variants.push(`${countryCode}${digits}`);
      const unique = Array.from(new Set(variants));

      supabase.from("profiles").select("id, full_name, phone")
        .in("phone", unique).limit(5).then(({ data }: any) => {
          const results: SayItContact[] = (data ?? []).map((p: any) => ({
            displayName: p.full_name ?? p.phone,
            phones: [p.phone],
            userId: p.id,
            onSayIt: true,
            primaryPhone: p.phone,
          }));
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        });
    } else {
      // Name typed: filter device contacts (privacy-safe — no global search)
      const ql = q.toLowerCase();
      const matched = sayItContacts
        .filter(c => c.displayName.toLowerCase().includes(ql))
        .slice(0, 8);

      // Also include non-SayIt device contacts so user can send via WhatsApp
      // (these come from the device contacts list, enriched by matchContactsWithSayIt)
      setSuggestions(matched);
      setShowSuggestions(matched.length > 0);
    }
  }, [searchQuery, selectedContact, sayItContacts, countryCode]);

  function selectContact(contact: SayItContact) {
    setSelectedContact(contact);
    setFoundUser(contact.onSayIt && contact.userId
      ? { id: contact.userId, name: contact.displayName, phone: contact.primaryPhone }
      : null
    );
    setShowSuggestions(false);
    setSearchQuery(contact.displayName);
    const raw = contact.primaryPhone ?? "";
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
    setSearchQuery("");
    setPhone("");
    setSuggestions([]);
    setFirstContactForced(false);
  }

  const cardUrl = shortCode ? `${BASE_URL}/preview/${shortCode}` : "";

  async function handleSend() {
    setPhoneError(null);
    if (!phone.trim() && !selectedContact) {
      setPhoneError("Please enter a phone number or select a contact");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) { setPhoneError("Please enter a valid phone number"); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    // Daily limit check
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("sent_cards").select("id", { count: "exact", head: true })
      .eq("sender_id", user.id).gte("created_at", today.toISOString());
    if ((todayCount ?? 0) >= FREE_DAILY_LIMIT) { setShowUpgrade(true); return; }

    setSending(true);

    const { data: profile } = await supabase
      .from("profiles").select("full_name, phone").eq("id", user.id).single();
    const profileName = profile?.full_name ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Someone";
    const pawSignature = (() => { try { return sessionStorage.getItem("card_signature") ?? ""; } catch { return ""; } })();
    const name = signatureParam.trim() || pawSignature.trim() || profileName;
    setSenderName(name);

    if (!profile) {
      await supabase.from("profiles").upsert({
        id: user.id, full_name: name, phone: ensurePlus(user.phone),
      }, { onConflict: "id" });
    }

    const code = uuidv4().slice(0, 8);
    const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;

    let pawPhotos: string[] | null = null;
    let pawFrame: string | null = null;
    let customBgPhoto: string | null = null;
    let memeImageUrl: string | null = null;
    let finalMessage = message;

    if (isPawCard) {
      try { pawPhotos = JSON.parse(sessionStorage.getItem("paw_photos") ?? "[]"); finalMessage = sessionStorage.getItem("paw_message") ?? message; pawFrame = sessionStorage.getItem("paw_frame") ?? "wooden"; }
      catch { pawPhotos = []; pawFrame = "wooden"; }
    }
    if (isCustomCard) {
      try { customBgPhoto = sessionStorage.getItem("custom_bg_photo"); finalMessage = sessionStorage.getItem("custom_message") ?? message; }
      catch { customBgPhoto = null; }
    }
    if (isMemeCard) {
      try { memeImageUrl = sessionStorage.getItem("meme_image"); finalMessage = sessionStorage.getItem("card_message") ?? message; }
      catch { memeImageUrl = null; }
    }

    const senderPhone = ensurePlus(user.phone ?? (profile as any)?.phone);

    const cardPayload: Record<string, unknown> = {
      sender_id:       user.id,
      recipient_phone: fullPhone,
      recipient_id:    foundUser?.id ?? null,
      recipient_name:  foundUser?.name ?? selectedContact?.displayName ?? null,
      template_id:     templateId || null,
      message:         finalMessage,
      short_code:      code,
      sender_name:     name,
      front_image_url: template?.front_image_url ?? null,
      ...(isPawCard    && { card_type: "paw-moments", paw_photos: pawPhotos, paw_frame: pawFrame }),
      ...(isCustomCard && { card_type: "custom-card", paw_photos: customBgPhoto ? [customBgPhoto] : [] }),
      ...(isMemeCard   && { card_type: "meme", meme_image_url: memeImageUrl }),
    };

    const circlePayload: Record<string, unknown> = {
      sender_id:       user.id,
      sender_phone:    senderPhone,
      sender_name:     name,
      recipient_phone: fullPhone,
      recipient_id:    foundUser?.id ?? null,
      status:          "accepted",
      updated_at:      new Date().toISOString(),
    };

    // ── Privacy: first-contact check ──────────────────────────────────
    // If recipient is on SayIt, check for mutual history.
    // "Mutual" = they have previously sent a card to us.
    // First-timers go via WhatsApp/SMS so recipient decides whether to engage.
    if (foundUser) {
      const myPhone = ensurePlus(user.phone ?? (profile as any)?.phone ?? "") || "";
      const withoutPlus = myPhone.replace(/^\+/, "");

      const { data: recipientSentToMe } = await supabase
        .from("sent_cards")
        .select("id")
        .eq("sender_id", foundUser.id)
        .or(
          myPhone
            ? `recipient_id.eq.${user.id},recipient_phone.eq.${myPhone},recipient_phone.eq.${withoutPlus}`
            : `recipient_id.eq.${user.id}`
        )
        .limit(1);

      // Also check if sender is blocked
      const { data: blockRow } = await supabase
        .from("blocked_contacts")
        .select("id")
        .eq("blocked_user_id", user.id)
        .eq("user_id", foundUser.id)
        .maybeSingle();

      if (blockRow) {
        // Sender is blocked by this recipient — silently force external route
        // (don't tell sender they're blocked)
        setSending(false);
        setFirstContactForced(true);
        setPendingPayload({ ...cardPayload, recipient_id: null }); // strip recipient_id
        setPendingCircle(circlePayload);
        setCardSaved(false);
        setShortCode(code);
        return;
      }

      const isMutual = (recipientSentToMe ?? []).length > 0;

      if (!isMutual) {
        // First contact → stage for WhatsApp/SMS, strip recipient_id so no push
        setSending(false);
        setFirstContactForced(true);
        setPendingPayload({ ...cardPayload, recipient_id: null });
        setPendingCircle(circlePayload);
        setCardSaved(false);
        setShortCode(code);
        return;
      }

      // ── Mutual contact: direct in-app delivery ─────────────────────
      let { error } = await supabase.from("sent_cards").insert(cardPayload);
      if (error) {
        const { front_image_url: _, ...slim } = cardPayload;
        ({ error } = await supabase.from("sent_cards").insert(slim));
      }
      if (error) { alert("Failed to send: " + error.message); setSending(false); return; }

      await supabase.from("circles").upsert(circlePayload, { onConflict: "sender_id,recipient_phone", ignoreDuplicates: true });

      supabase.auth.getSession().then(({ data: { session: pushSession } }) => {
        fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${pushSession?.access_token ?? ""}` },
          body: JSON.stringify({ recipientId: foundUser.id, senderName: name, cardCode: code }),
        }).catch(() => {});
      });

      setDailyCount(prev => (prev ?? 0) + 1);
      setSending(false);
      setRecipientOnApp(true);
      setShortCode(code);
      return;
    }

    // ── External recipient (not on SayIt): stage for WhatsApp/SMS ────
    setPendingPayload(cardPayload);
    setPendingCircle(circlePayload);
    setCardSaved(false);
    setSending(false);
    setShortCode(code);
  }

  async function saveCardNow() {
    if (cardSaved || !pendingPayload) return;
    setCardSaved(true);
    let { error } = await supabase.from("sent_cards").insert(pendingPayload);
    if (error) {
      const { front_image_url: _, ...slim } = pendingPayload;
      ({ error } = await supabase.from("sent_cards").insert(slim));
    }
    if (!error && pendingCircle) {
      await supabase.from("circles").upsert(pendingCircle, { onConflict: "sender_id,recipient_phone", ignoreDuplicates: true });
      setDailyCount(prev => (prev ?? 0) + 1);
    }
  }

  function cancelSend() {
    setPendingPayload(null); setPendingCircle(null);
    setCardSaved(false); setShortCode("");
    setFirstContactForced(false);
  }

  // ── Upgrade screen ────────────────────────────────────────────────────
  if (showUpgrade) {
    return (
      <div className="flex flex-col min-h-dvh px-6 py-10 items-center justify-center"
        style={{ background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}>
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-lg"
          style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
          <Sparkles className="w-9 h-9 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 text-center">You&apos;ve sent {FREE_DAILY_LIMIT} cards today</h2>
        <p className="text-gray-400 text-sm text-center mt-2 leading-relaxed">
          Free accounts can send {FREE_DAILY_LIMIT} cards per day.<br />Upgrade for unlimited cards.
        </p>
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
        {(() => {
          const isIndia = country === "IN";
          const annual  = isIndia ? { price: "₹999 / year",  sub: "Just ₹83/month" } : { price: "$9.99 / year", sub: "Just $0.83/month" };
          const monthly = isIndia ? { price: "₹149 / month", sub: "Cancel anytime" }  : { price: "$1.99 / month", sub: "Cancel anytime" };
          return (
            <div className="w-full mt-6 flex flex-col gap-3">
              <button className="w-full rounded-2xl p-4 text-white shadow-lg relative overflow-hidden"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                <div className="absolute top-2 right-3 bg-white/20 rounded-full px-2 py-0.5 text-[10px] font-bold">BEST VALUE</div>
                <p className="text-base font-bold text-left">{annual.price}</p>
                <p className="text-xs text-white/75 text-left mt-0.5">{annual.sub}</p>
              </button>
              <button className="w-full rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
                <p className="text-base font-bold text-gray-800 text-left">{monthly.price}</p>
                <p className="text-xs text-gray-400 text-left mt-0.5">{monthly.sub}</p>
              </button>
            </div>
          );
        })()}
        <p className="text-[10px] text-gray-300 mt-4 text-center">Payment coming soon — tap to join the waitlist</p>
        <button onClick={() => setShowUpgrade(false)} className="mt-6 text-sm text-gray-400 font-medium">
          Maybe later — cards reset tomorrow
        </button>
      </div>
    );
  }

  // ── Direct delivery success ───────────────────────────────────────────
  if (shortCode && recipientOnApp && foundUser) {
    const initials = foundUser.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
    return (
      <div className="flex flex-col min-h-dvh items-center justify-center px-8 gap-6"
        style={{ background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}>
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-2xl font-bold text-white shadow-xl"
          style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
          {initials}
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5" style={{ color: "#22c55e" }} />
            <span className="text-sm font-semibold text-green-600">Delivered on SayIt</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Card sent to {foundUser.name.split(" ")[0]}! 🎉</h2>
          <p className="text-gray-400 text-sm mt-2 leading-relaxed">
            {foundUser.name.split(" ")[0]} will see it in their Chats tab right now. No link needed 💌
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

  // ── Post-share confirmation ───────────────────────────────────────────
  if (shortCode && shared) {
    const displayName = foundUser?.name?.split(" ")[0] ?? senderName.split(" ")[0] ?? "them";
    return (
      <div className="flex flex-col min-h-dvh items-center justify-center px-8 gap-6"
        style={{ background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}>
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
            Your card is on its way to <span className="font-semibold text-gray-700">{displayName}</span>.<br />
            They&apos;ll see it as soon as they tap the link 💌
          </p>
          {firstContactForced && (
            <p className="text-xs text-purple-400 mt-2">
              Once they&apos;re on SayIt and connect back, future cards will arrive directly in-app ✨
            </p>
          )}
        </div>
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

  // ── Share sheet ───────────────────────────────────────────────────────
  if (shortCode) {
    const shareText = firstContactForced && foundUser
      ? `${senderName} sent you a card on SayIt 💌 Open it here: ${cardUrl}\n\nDownload SayIt to send cards back!`
      : `${senderName} sent you a card 💌 Open it here: ${cardUrl}`;
    let rawPhone = phone.replace(/\D/g, "");
    if (rawPhone.length === 10) rawPhone = "91" + rawPhone;
    const smsHref = `sms:${phone.trim()}&body=${encodeURIComponent(shareText)}`;
    const waHref  = `https://wa.me/${rawPhone}?text=${encodeURIComponent(shareText)}`;

    return (
      <div className="flex flex-col min-h-dvh" style={{ background: "linear-gradient(160deg,#FFF5F7,#F8F0FF)" }}>
        <div className="px-5 pt-14 pb-2 flex items-center gap-3">
          <button onClick={() => { cancelSend(); router.push("/home"); }}
            className="w-9 h-9 rounded-full bg-white/80 flex items-center justify-center shadow-sm">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="flex flex-col items-center px-6 pt-4 pb-10 gap-6 flex-1">
          {/* First-contact notice */}
          {firstContactForced && (
            <div className="w-full rounded-2xl px-4 py-3 flex items-start gap-3"
              style={{ background: "linear-gradient(135deg,#F8F0FF,#FFF5F7)", border: "1px solid rgba(155,89,182,0.2)" }}>
              <span className="text-lg mt-0.5">🔒</span>
              <div>
                <p className="text-xs font-bold text-purple-700">First card to {foundUser?.name?.split(" ")[0] ?? "this person"}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  For privacy, first-time cards are always shared via WhatsApp or SMS.
                  Once they&apos;re on SayIt and connect back, future cards arrive directly in-app.
                </p>
              </div>
            </div>
          )}

          {/* Card preview */}
          {template ? (
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

          <div className="w-full flex flex-col gap-3">
            <a href={smsHref}
              onClick={() => { saveCardNow(); setTimeout(() => setShared(true), 600); }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-white font-semibold shadow-lg"
              style={{ background: "linear-gradient(135deg,#34C759,#30D158)", textDecoration: "none" }}>
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl flex-shrink-0">💬</div>
              <div className="flex-1"><p className="text-sm font-bold">iMessage / SMS</p><p className="text-xs text-white/75">Opens Messages app</p></div>
              <span className="text-white/60 text-lg">›</span>
            </a>
            <a href={waHref} target="_blank" rel="noopener noreferrer"
              onClick={() => { saveCardNow(); setTimeout(() => setShared(true), 600); }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-white font-semibold shadow-lg"
              style={{ background: "linear-gradient(135deg,#25D366,#128C7E)", textDecoration: "none" }}>
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl flex-shrink-0">💚</div>
              <div className="flex-1"><p className="text-sm font-bold">WhatsApp</p><p className="text-xs text-white/75">Opens WhatsApp chat</p></div>
              <span className="text-white/60 text-lg">›</span>
            </a>
          </div>
          <button onClick={() => { cancelSend(); router.push("/home"); }}
            className="w-full py-4 rounded-2xl bg-white border border-gray-100 text-gray-500 font-semibold text-sm shadow-sm mt-1">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Main send form ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-dvh bg-gray-50">
      <div className="bg-white px-5 pt-14 pb-4 flex items-center gap-3 shadow-sm">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-gray-800">Send Card</h2>
          <p className="text-xs text-gray-400">
            {contactsGranted ? "Search your contacts or enter a number" : "Enter a phone number to send"}
          </p>
        </div>
        {template && (
          <div className="relative w-10 h-14 rounded-xl overflow-hidden shadow-sm">
            <Image src={template.front_image_url} alt="" fill className="object-cover" sizes="40px" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 px-5 py-8">
        {template && (
          <div className="flex gap-3 items-center bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
            <div className="relative w-12 h-16 rounded-xl overflow-hidden flex-shrink-0">
              <Image src={template.front_image_url} alt="" fill className="object-cover" sizes="48px" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Sending</p>
              <p className="font-semibold text-gray-800 text-sm">{template.title}</p>
              {message && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 italic">&ldquo;{message}&rdquo;</p>}
            </div>
          </div>
        )}

        {/* Contacts permission banner */}
        {!contactsGranted && !contactsLoading && (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: "linear-gradient(135deg,#F8F0FF,#FFF5F7)", border: "1px solid rgba(155,89,182,0.2)" }}>
            <span className="text-xl">📋</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-purple-700">Find friends on SayIt</p>
              <p className="text-xs text-gray-500">Allow contacts access to search by name</p>
            </div>
            <button
              onClick={async () => {
                const { Contacts } = await import("@capacitor-community/contacts").catch(() => ({ Contacts: null }));
                if (!Contacts) return;
                const result = await Contacts.requestPermissions();
                if (result.contacts === "granted") {
                  setContactsGranted(true);
                  const { contacts } = await getOrRequestContacts(supabase);
                  setSayItContacts(contacts);
                }
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-full text-white"
              style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
              Allow
            </button>
          </div>
        )}

        {/* Recipient search */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <label className="text-xs font-semibold text-gray-500 mb-2 block">Send To</label>

          {selectedContact ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: "linear-gradient(135deg,#FF6B8A10,#9B59B610)", border: "1px solid #FF6B8A30" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                {selectedContact.displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{selectedContact.displayName}</p>
                <p className="text-[11px] font-medium" style={{ color: selectedContact.onSayIt ? "#22c55e" : "#9ca3af" }}>
                  {selectedContact.onSayIt ? "✓ On SayIt" : "📱 Send via WhatsApp / SMS"}
                </p>
              </div>
              <button onClick={clearContact}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">✕</button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder={contactsGranted ? "Search contacts or enter phone number" : "Enter phone number"}
                value={searchQuery}
                onChange={e => {
                  const v = e.target.value;
                  setSearchQuery(v);
                  setPhoneError(null);
                  if (/^\+?[\d\s\-()]+$/.test(v)) {
                    setPhone(v.replace(/\D/g, ""));
                    setFoundUser(null);
                  }
                }}
                onFocus={() => searchQuery && setShowSuggestions(true)}
                className="w-full px-4 py-3.5 rounded-xl border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 bg-gray-50"
                autoFocus
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  {suggestions.map((s, i) => (
                    <button key={`${s.userId ?? s.primaryPhone}-${i}`}
                      onClick={() => selectContact(s)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 border-b border-gray-50 last:border-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: s.onSayIt
                            ? "linear-gradient(135deg,#FF6B8A,#9B59B6)"
                            : "linear-gradient(135deg,#e5e7eb,#d1d5db)",
                          color: s.onSayIt ? "white" : "#9ca3af",
                        }}>
                        {s.displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{s.displayName}</p>
                        <p className="text-[11px]" style={{ color: s.onSayIt ? "#22c55e" : "#9ca3af" }}>
                          {s.onSayIt ? "✓ On SayIt" : s.primaryPhone}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manual phone display when typing a number */}
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
                <div className="flex-1 px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-600">{phone}</div>
              </div>
              <p className="text-xs text-gray-400 mt-2 px-1">👋 Not on SayIt yet — you can invite them via WhatsApp or SMS</p>
            </div>
          )}
        </div>

        {phoneError && <p className="text-sm text-red-500 px-1 -mt-2">{phoneError}</p>}

        {/* Daily limit indicator */}
        {dailyCount !== null && (
          <div className="flex items-center justify-between px-1">
            <div className="flex gap-1.5 items-center">
              {Array.from({ length: FREE_DAILY_LIMIT }).map((_, i) => (
                <div key={i} className="w-8 h-1.5 rounded-full transition-all"
                  style={{ background: i < dailyCount ? "linear-gradient(135deg,#FF6B8A,#9B59B6)" : "#E5E7EB" }} />
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

        {dailyCount !== null && dailyCount >= FREE_DAILY_LIMIT ? (
          <button onClick={() => setShowUpgrade(true)}
            className="w-full py-4 rounded-2xl text-white font-semibold shadow-md flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
            <Sparkles className="w-4 h-4" /> Upgrade to Send More
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={(!phone.trim() && !selectedContact) || sending}
            className="w-full py-4 text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", borderRadius: 30, boxShadow: "0 4px 18px rgba(255,107,138,0.35)", fontSize: 15 }}>
            {sending
              ? <><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Sending…</>
              : selectedContact
                ? <>✨ SayIt to {selectedContact.displayName.split(" ")[0]}</>
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
