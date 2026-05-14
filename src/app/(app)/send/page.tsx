"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { getTemplateById, getCategoryById, type DBTemplate, type DBCategory } from "@/lib/supabase-data";
import { ensurePlus } from "@/lib/phone";
import { isValidPhoneNumber } from "libphonenumber-js";
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
  { code: "+92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+94",  flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+977", flag: "🇳🇵", name: "Nepal" },
  { code: "+60",  flag: "🇲🇾", name: "Malaysia" },
  { code: "+62",  flag: "🇮🇩", name: "Indonesia" },
  { code: "+63",  flag: "🇵🇭", name: "Philippines" },
  { code: "+66",  flag: "🇹🇭", name: "Thailand" },
  { code: "+84",  flag: "🇻🇳", name: "Vietnam" },
  { code: "+81",  flag: "🇯🇵", name: "Japan" },
  { code: "+82",  flag: "🇰🇷", name: "South Korea" },
  { code: "+86",  flag: "🇨🇳", name: "China" },
  { code: "+852", flag: "🇭🇰", name: "Hong Kong" },
  { code: "+886", flag: "🇹🇼", name: "Taiwan" },
  { code: "+64",  flag: "🇳🇿", name: "New Zealand" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+965", flag: "🇰🇼", name: "Kuwait" },
  { code: "+974", flag: "🇶🇦", name: "Qatar" },
  { code: "+973", flag: "🇧🇭", name: "Bahrain" },
  { code: "+968", flag: "🇴🇲", name: "Oman" },
  { code: "+962", flag: "🇯🇴", name: "Jordan" },
  { code: "+20",  flag: "🇪🇬", name: "Egypt" },
  { code: "+27",  flag: "🇿🇦", name: "South Africa" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+251", flag: "🇪🇹", name: "Ethiopia" },
  { code: "+49",  flag: "🇩🇪", name: "Germany" },
  { code: "+33",  flag: "🇫🇷", name: "France" },
  { code: "+39",  flag: "🇮🇹", name: "Italy" },
  { code: "+34",  flag: "🇪🇸", name: "Spain" },
  { code: "+31",  flag: "🇳🇱", name: "Netherlands" },
  { code: "+46",  flag: "🇸🇪", name: "Sweden" },
  { code: "+47",  flag: "🇳🇴", name: "Norway" },
  { code: "+45",  flag: "🇩🇰", name: "Denmark" },
  { code: "+41",  flag: "🇨🇭", name: "Switzerland" },
  { code: "+32",  flag: "🇧🇪", name: "Belgium" },
  { code: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "+90",  flag: "🇹🇷", name: "Turkey" },
  { code: "+7",   flag: "🇷🇺", name: "Russia" },
  { code: "+55",  flag: "🇧🇷", name: "Brazil" },
  { code: "+52",  flag: "🇲🇽", name: "Mexico" },
  { code: "+54",  flag: "🇦🇷", name: "Argentina" },
  { code: "+57",  flag: "🇨🇴", name: "Colombia" },
  { code: "+56",  flag: "🇨🇱", name: "Chile" },
];

// Expected local digit counts (after the country code) per country
const DIGIT_RULES: Record<string, { min: number; max: number; label: string }> = {
  "+91":  { min: 10, max: 10, label: "10" },
  "+1":   { min: 10, max: 10, label: "10" },
  "+44":  { min: 9,  max: 10, label: "9–10" },
  "+971": { min: 9,  max: 9,  label: "9"  },
  "+65":  { min: 8,  max: 8,  label: "8"  },
  "+61":  { min: 9,  max: 9,  label: "9"  },
  "+92":  { min: 10, max: 10, label: "10" },
  "+880": { min: 10, max: 10, label: "10" },
  "+94":  { min: 9,  max: 9,  label: "9"  },
  "+977": { min: 9,  max: 10, label: "9–10" },
  "+60":  { min: 9,  max: 10, label: "9–10" },
  "+62":  { min: 9,  max: 12, label: "9–12" },
  "+63":  { min: 10, max: 10, label: "10" },
  "+66":  { min: 9,  max: 9,  label: "9"  },
  "+84":  { min: 9,  max: 10, label: "9–10" },
  "+81":  { min: 10, max: 10, label: "10" },
  "+82":  { min: 9,  max: 10, label: "9–10" },
  "+86":  { min: 11, max: 11, label: "11" },
  "+852": { min: 8,  max: 8,  label: "8"  },
  "+886": { min: 9,  max: 10, label: "9–10" },
  "+64":  { min: 8,  max: 10, label: "8–10" },
  "+966": { min: 9,  max: 9,  label: "9"  },
  "+965": { min: 8,  max: 8,  label: "8"  },
  "+974": { min: 8,  max: 8,  label: "8"  },
  "+973": { min: 8,  max: 8,  label: "8"  },
  "+968": { min: 8,  max: 8,  label: "8"  },
  "+962": { min: 9,  max: 9,  label: "9"  },
  "+20":  { min: 10, max: 10, label: "10" },
  "+27":  { min: 9,  max: 9,  label: "9"  },
  "+234": { min: 10, max: 10, label: "10" },
  "+254": { min: 9,  max: 9,  label: "9"  },
  "+233": { min: 9,  max: 9,  label: "9"  },
  "+49":  { min: 10, max: 11, label: "10–11" },
  "+33":  { min: 9,  max: 9,  label: "9"  },
  "+39":  { min: 9,  max: 10, label: "9–10" },
  "+34":  { min: 9,  max: 9,  label: "9"  },
  "+31":  { min: 9,  max: 9,  label: "9"  },
  "+46":  { min: 9,  max: 9,  label: "9"  },
  "+47":  { min: 8,  max: 8,  label: "8"  },
  "+45":  { min: 8,  max: 8,  label: "8"  },
  "+41":  { min: 9,  max: 9,  label: "9"  },
  "+32":  { min: 9,  max: 9,  label: "9"  },
  "+351": { min: 9,  max: 9,  label: "9"  },
  "+90":  { min: 10, max: 10, label: "10" },
  "+7":   { min: 10, max: 10, label: "10" },
  "+55":  { min: 10, max: 11, label: "10–11" },
  "+52":  { min: 10, max: 10, label: "10" },
  "+54":  { min: 10, max: 10, label: "10" },
  "+57":  { min: 10, max: 10, label: "10" },
  "+56":  { min: 9,  max: 9,  label: "9"  },
};

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
  const [countryCode,    setCountryCode]    = useState<string | null>(null);
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

  // ── Parse __sayitNativeContacts directly (no dynamic import, no intermediate fn) ──
  // Phase 1: show contacts instantly for name search
  // Phase 2: enrich with Supabase in background for "On SayIt" badges
  function applyNativeContacts() {
    const native: any[] = (window as any).__sayitNativeContacts;
    if (!Array.isArray(native) || native.length === 0) return;

    const raw: SayItContact[] = native
      .filter((c: any) => c.displayName && Array.isArray(c.phones) && c.phones.length > 0)
      .map((c: any) => {
        const phones = c.phones
          .map((p: string) => { const d = String(p).replace(/\D/g, ""); return d.length >= 6 ? `+${d}` : ""; })
          .filter(Boolean) as string[];
        return { displayName: c.displayName, phones, userId: null as null, onSayIt: false, primaryPhone: phones[0] ?? "" };
      })
      .filter((c: SayItContact) => c.phones.length > 0);

    if (raw.length === 0) return;

    // Phase 1 — immediately available for name search
    setContactsGranted(true);
    setSayItContacts(raw);
    setContactsLoading(false);

    // Phase 2 — Supabase match in background (adds "On SayIt" indicator)
    import("@/lib/contacts").then(({ clearContactsCache, loadDeviceContacts, matchContactsWithSayIt }) => {
      clearContactsCache();
      return loadDeviceContacts(true).then(device => matchContactsWithSayIt(device, supabase));
    }).then(enriched => {
      if (enriched.length > 0) setSayItContacts(enriched);
    }).catch(() => {}); // enrichment failure is non-fatal
  }

  // ── Load device contacts on mount + request permission ───────────────
  async function loadContacts() {
    setContactsLoading(true);
    try {
      const { granted, contacts } = await getOrRequestContacts(supabase);
      setContactsGranted(granted);
      if (contacts.length > 0) {
        setSayItContacts(contacts);
        setContactsLoading(false);
        return;
      }
      if (!granted) { setContactsLoading(false); return; }
      // granted but empty → Android native injection not arrived yet; poll will handle it
    } catch { setContactsLoading(false); }
  }

  useEffect(() => {
    // Callback: Java calls this after injecting __sayitNativeContacts
    (window as any).__sayitContactsReady = applyNativeContacts;

    // Fast-path: if Java already injected before JS mounted
    if ((window as any).__sayitNativeContacts?.length > 0) {
      (window as any).__sayitContactsGranted = true;
      applyNativeContacts();
    }

    loadContacts();

    // Poll every 400 ms for up to 10 s — catches the case where Java fires before
    // the callback was registered, or fires and the callback silently failed.
    let pollDone = false;
    const pollTimer = setInterval(() => {
      if (pollDone) return;
      if ((window as any).__sayitNativeContacts?.length > 0) {
        pollDone = true;
        clearInterval(pollTimer);
        applyNativeContacts();
      }
    }, 400);
    const pollStop = setTimeout(() => {
      pollDone = true;
      clearInterval(pollTimer);
      setContactsLoading(false); // give up waiting
    }, 10000);

    return () => {
      delete (window as any).__sayitContactsReady;
      pollDone = true;
      clearInterval(pollTimer);
      clearTimeout(pollStop);
    };
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
        variants.push(digits);                               // no-+ bare form
        if (!digits.startsWith("1"))   { variants.push(`+1${digits}`);   variants.push(`1${digits}`); }
        if (!digits.startsWith("91"))  { variants.push(`+91${digits}`);  variants.push(`91${digits}`); }
        if (!digits.startsWith("44"))  { variants.push(`+44${digits}`);  variants.push(`44${digits}`); }
        if (!digits.startsWith("971")) { variants.push(`+971${digits}`); variants.push(`971${digits}`); }
      }
      const ccDigits = countryCode ? `${countryCode}${digits}` : `+${digits}`;
      variants.push(ccDigits);
      variants.push(ccDigits.replace(/^\+/, ""));            // no-+ form of country+digits
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
    setCountryCode(null);
    setSuggestions([]);
    setFirstContactForced(false);
  }

  const cardUrl = shortCode ? `${BASE_URL}/preview/${shortCode}` : "";

  async function handleSend() {
    setPhoneError(null);
    if (!selectedContact && !phone.trim()) {
      setPhoneError("Please enter a phone number or select a contact");
      return;
    }

    // Only validate manual phone entry — skip for selected contacts (trust their stored number)
    if (!selectedContact) {
      if (!countryCode) {
        setPhoneError("Please select a country code");
        return;
      }
      const digits = phone.replace(/\D/g, "");
      const rule = DIGIT_RULES[countryCode];
      if (rule) {
        if (digits.length < rule.min) {
          setPhoneError(`Too short — enter ${rule.label} digits for ${countryCode}`);
          return;
        }
        if (digits.length > rule.max) {
          setPhoneError(`Too long — enter ${rule.label} digits for ${countryCode}`);
          return;
        }
      } else {
        if (digits.length < 6)  { setPhoneError("Please enter a valid phone number"); return; }
        if (digits.length > 12) { setPhoneError("Phone number is too long"); return; }
      }
      // Deep validation — catches invalid numbers that pass the digit count check
      try {
        if (!isValidPhoneNumber(`${countryCode}${digits}`)) {
          setPhoneError("Invalid phone number — please check the number and try again");
          return;
        }
      } catch {
        setPhoneError("Invalid phone number — please check the number and try again");
        return;
      }
    }

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
    const fullPhone = selectedContact?.primaryPhone
      ? ensurePlus(selectedContact.primaryPhone)
      : `${countryCode ?? ""}${phone.replace(/\D/g, "")}`;

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

    // ── Resolve recipient SayIt status ───────────────────────────────
    // If the user typed a number manually (no suggestion tapped), foundUser is
    // still null even if the recipient IS registered.  Do a fresh lookup now
    // using all phone variants (with and without + prefix, with country code).
    let effectiveFoundUser = foundUser;
    if (!effectiveFoundUser) {
      const digits = phone.replace(/\D/g, "");
      const naked  = fullPhone.replace(/^\+/, "");           // "918452910272"
      const lookupVariants = Array.from(new Set([
        fullPhone,  // "+918452910272"
        naked,      // "918452910272"
        digits,     // "8452910272"
        `+${digits}`,
      ]));
      const { data: lu } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("phone", lookupVariants)
        .neq("id", user.id)
        .limit(1);
      if (lu && lu.length > 0) {
        effectiveFoundUser = { id: lu[0].id, name: lu[0].full_name ?? lu[0].phone, phone: lu[0].phone };
        setFoundUser(effectiveFoundUser);
        // Patch payloads — they were built before this lookup resolved
        cardPayload.recipient_id   = effectiveFoundUser.id;
        cardPayload.recipient_name = effectiveFoundUser.name;
        circlePayload.recipient_id = effectiveFoundUser.id;
      }
    }

    // ── Privacy: first-contact check ──────────────────────────────────
    // If recipient is on SayIt, check for mutual history.
    // "Mutual" = they have previously sent a card to us.
    // First-timers go via WhatsApp/SMS so recipient decides whether to engage.
    if (effectiveFoundUser) {
      // alias for readability — use effectiveFoundUser throughout this block
      const foundUser = effectiveFoundUser;
      const myPhone = ensurePlus(user.phone ?? (profile as any)?.phone ?? "") || "";
      const withoutPlus = myPhone.replace(/^\+/, "");

      const recipientPhone      = foundUser.phone ?? fullPhone;
      const recipientPhoneNaked = recipientPhone.replace(/^\+/, "");

      // Check both directions:
      // 1. Have THEY previously sent to US?
      // 2. Have WE previously sent to THEM?
      // Either means we have a history → direct in-app delivery.
      // Only a true first-ever contact goes via WhatsApp/SMS.
      const [{ data: theySentToMe }, { data: weSentToThem }] = await Promise.all([
        supabase
          .from("sent_cards")
          .select("id")
          .eq("sender_id", foundUser.id)
          .or(
            myPhone
              ? `recipient_id.eq.${user.id},recipient_phone.eq.${myPhone},recipient_phone.eq.${withoutPlus}`
              : `recipient_id.eq.${user.id}`
          )
          .limit(1),
        supabase
          .from("sent_cards")
          .select("id")
          .eq("sender_id", user.id)
          .or(`recipient_id.eq.${foundUser.id},recipient_phone.eq.${recipientPhone},recipient_phone.eq.${recipientPhoneNaked}`)
          .limit(1),
      ]);

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

      const isMutual =
        (theySentToMe ?? []).length > 0 ||
        (weSentToThem ?? []).length > 0;

      if (!isMutual) {
        // First contact → stage for WhatsApp/SMS, strip recipient_id for privacy.
        // But still fire a push so the recipient knows on their device immediately.
        setSending(false);
        setFirstContactForced(true);
        setPendingPayload({ ...cardPayload, recipient_id: null });
        setPendingCircle(circlePayload);
        setCardSaved(false);
        setShortCode(code);
        // Fire push in background — recipient is registered so we have their ID
        supabase.auth.getSession().then(({ data: { session: pushSession } }) => {
          fetch("/api/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${pushSession?.access_token ?? ""}` },
            body: JSON.stringify({
              recipientId: foundUser.id,
              senderName:  name,
              cardCode:    code,
              firstContact: true,
            }),
          }).catch(() => {});
        });
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

    // Full international phone for WhatsApp (wa.me needs digits only, no +)
    let rawPhone = phone.replace(/\D/g, "");
    if (rawPhone.length === 10) rawPhone = "91" + rawPhone; // India fallback for bare 10-digit
    // If contact selected, prefer their stored number
    const waPhone = selectedContact?.primaryPhone
      ? selectedContact.primaryPhone.replace(/\D/g, "")
      : rawPhone;

    // Full international phone for SMS (E.164 with +)
    const smsPhone = selectedContact?.primaryPhone
      ? selectedContact.primaryPhone
      : countryCode
        ? `${countryCode}${phone.replace(/\D/g, "")}`
        : `+${rawPhone}`;

    const smsHref = `sms:${smsPhone}&body=${encodeURIComponent(shareText)}`;
    const waHref  = `https://wa.me/${waPhone}?text=${encodeURIComponent(shareText)}`;

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
            {/* iMessage / SMS — first */}
            <button
              onClick={() => {
                saveCardNow();
                // Use visibilitychange to detect when user returns from SMS app.
                // This works on both iOS and Android: app goes hidden → user sends → comes back → visible.
                let wentHidden = false;
                let done = false;
                const onVis = () => {
                  if (document.visibilityState === "hidden") { wentHidden = true; return; }
                  if (document.visibilityState === "visible" && wentHidden && !done) {
                    done = true;
                    document.removeEventListener("visibilitychange", onVis);
                    setShared(true);
                  }
                };
                document.addEventListener("visibilitychange", onVis);
                // Fallback: mark sent after 60 s (in case visibility never fires)
                setTimeout(() => { if (!done) { done = true; document.removeEventListener("visibilitychange", onVis); setShared(true); } }, 60000);
                window.location.href = smsHref;
              }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-white font-semibold shadow-lg"
              style={{ background: "linear-gradient(135deg,#007AFF,#0055CC)", border: "none", cursor: "pointer" }}>
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl flex-shrink-0">📱</div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold">Send via iMessage / SMS</p>
                <p className="text-xs text-white/75">Opens Messages with your card link</p>
              </div>
              <span className="text-white/60 text-lg">›</span>
            </button>

            {/* WhatsApp — second */}
            <button
              onClick={() => {
                saveCardNow();
                let wentHidden = false;
                let done = false;
                const onVis = () => {
                  if (document.visibilityState === "hidden") { wentHidden = true; return; }
                  if (document.visibilityState === "visible" && wentHidden && !done) {
                    done = true;
                    document.removeEventListener("visibilitychange", onVis);
                    setShared(true);
                  }
                };
                document.addEventListener("visibilitychange", onVis);
                setTimeout(() => { if (!done) { done = true; document.removeEventListener("visibilitychange", onVis); setShared(true); } }, 60000);
                window.open(waHref, "_blank");
              }}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-semibold shadow-sm"
              style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", cursor: "pointer" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#25D36620,#128C7E10)" }}>💬</div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-gray-800">Send via WhatsApp</p>
                <p className="text-xs text-gray-400">Opens WhatsApp with your card link</p>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </button>
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


        {/* Recipient search */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <label className="text-xs font-semibold text-gray-500 mb-2 block">Send To</label>

          {selectedContact ? (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: "linear-gradient(135deg,#FF6B8A10,#9B59B610)", border: "1px solid #FF6B8A30" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: foundUser ? "linear-gradient(135deg,#FF6B8A,#9B59B6)" : "linear-gradient(135deg,#9ca3af,#6b7280)" }}>
                {selectedContact.displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">{selectedContact.displayName}</p>
                <p className="text-[11px] font-medium" style={{ color: foundUser ? "#22c55e" : "#9ca3af" }}>
                  {foundUser
                    ? "✓ On SayIt — delivers directly to their app"
                    : "📱 Not on SayIt — will send via WhatsApp / SMS"}
                </p>
              </div>
              <button onClick={clearContact}
                className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">✕</button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Search contacts or enter phone number"
                value={searchQuery}
                onChange={e => {
                  const v = e.target.value;
                  setPhoneError(null);
                  const looksLikePhone = /^\+?[\d\s\-()]+$/.test(v) && v.trim().length > 0;
                  if (looksLikePhone) {
                    const raw = v.replace(/\D/g, "");
                    const maxDigits = countryCode ? (DIGIT_RULES[countryCode]?.max ?? 15) : 15;
                    if (raw.length > maxDigits) return; // hard cap — ignore extra digits
                    setPhone(raw);
                    setFoundUser(null);
                    // Do NOT auto-open the country code dropdown — user must tap it explicitly
                  } else {
                    setPhone(""); // not phone mode — typing a name
                  }
                  setSearchQuery(v);
                }}
                onFocus={() => searchQuery && setShowSuggestions(true)}
                className="w-full px-4 py-3.5 rounded-xl border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 bg-gray-50"
                autoFocus
              />
              {/* Loading hint while contacts are still being fetched on Android */}
              {(contactsLoading || sayItContacts.length === 0) && searchQuery && !selectedContact && !/^\+?[\d\s\-()]{4,}$/.test(searchQuery) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 z-50 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-pink-200 border-t-pink-400 rounded-full animate-spin flex-shrink-0" />
                  <p className="text-sm text-gray-400">Loading contacts…</p>
                </div>
              )}
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
          {!selectedContact && /^\+?[\d\s\-()]+$/.test(searchQuery) && searchQuery.trim().length > 0 && (
            <div className="mt-3">
              <div className="flex gap-2">
                <div className="relative">
                  <button type="button" onClick={() => setShowCCDropdown(v => !v)}
                    className="h-full px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap">
                    {countryCode ? (
                      <>
                        <span>{COUNTRY_CODES.find(c => c.code === countryCode)?.flag}</span>
                        <span className="text-gray-700">{countryCode}</span>
                      </>
                    ) : (
                      <span className="text-gray-400 text-xs">🌐 Code</span>
                    )}
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </button>
                  {showCCDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 overflow-y-auto" style={{ minWidth: 200, maxHeight: 300 }}>
                      {COUNTRY_CODES.map(c => (
                        <button key={c.code} type="button"
                          onClick={() => { setCountryCode(c.code); setShowCCDropdown(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm active:bg-gray-50 text-left border-b border-gray-50 last:border-0"
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
              <p className="text-xs text-gray-400 mt-2 px-1">
                {!countryCode
                  ? "Select a country code first"
                  : DIGIT_RULES[countryCode]
                    ? `Enter ${DIGIT_RULES[countryCode].label} digits for ${countryCode} · ${phone.length}/${DIGIT_RULES[countryCode].max}`
                    : "Enter the local number without country code"}
              </p>
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
            disabled={(!selectedContact && (!phone.trim() || !countryCode)) || sending}
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
