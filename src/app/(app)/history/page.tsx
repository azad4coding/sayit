"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { type DBTemplate, type DBCategory } from "@/lib/supabase-data";
import { Search } from "lucide-react";

// Lightweight maps built from Supabase batch-fetches at load time
type TemplateMap = Record<string, Pick<DBTemplate, "id" | "category_id" | "front_image_url" | "color_accent">>;
type CategoryMap = Record<string, Pick<DBCategory, "id" | "name" | "slug">>;

function getCardCategory(card: CardWithDir, templateMap: TemplateMap, categoryMap: CategoryMap): string {
  if (card.card_type === "meme")        return "Meme";
  if (card.card_type === "paw-moments") return "Paw Moments";
  if (card.card_type === "custom-card") return "Custom Card";
  if (card.card_type === "ai-card")     return "Couple Card ✨";
  if (card.card_type === "gift-card") return "Gift Card";
  const tmpl = card.template_id ? templateMap[card.template_id] : null;
  if (!tmpl) return "Greeting Card";
  const cat = categoryMap[tmpl.category_id];
  return cat?.name ?? "Greeting Card";
}

type CardWithDir = {
  id: string;
  short_code: string;
  recipient_name: string | null;
  recipient_phone: string;
  sender_name: string | null;
  sender_id: string | null;
  message: string | null;
  template_id: string | null;
  front_image_url: string | null;
  meme_image_url: string | null;
  paw_photos: string[] | null;
  card_type: string;
  created_at: string;
  viewed_at: string | null;
  direction: "sent" | "received";
};

type Contact = {
  key: string;
  label: string;
  phone: string;
  initials: string;
  color: string;
  cards: CardWithDir[];
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function getInitials(name: string): string {
  if (name && !/^[+\d\s\-()]+$/.test(name.trim())) {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  }
  return "";
}

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const COLORS = ["#FF6B8A","#9B59B6","#F39C12","#27AE60","#3498DB","#E74C3C","#1ABC9C","#E67E22"];
function colorFor(str: string) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % COLORS.length;
  return COLORS[h];
}

function CardThumb({ card, small, templateMap }: { card: CardWithDir; small?: boolean; templateMap: TemplateMap }) {
  const tmpl = card.template_id ? templateMap[card.template_id] ?? null : null;

  const w = small ? "w-10" : "w-12";
  const h = small ? "h-14" : "h-16";

  // Gift card thumbnail
  if (card.card_type === "gift-card") {
    let gc: any = {};
    try { gc = JSON.parse(card.message ?? "{}"); } catch {}
    return (
      <div className={`${w} ${h} rounded-xl flex items-center justify-center flex-shrink-0 text-xl font-bold relative overflow-hidden`}
        style={{ background: `linear-gradient(135deg,${gc.vendorColor ?? "#FF6B8A"}CC,${gc.vendorColor ?? "#9B59B6"})` }}>
        <span>{gc.vendorEmoji ?? "🎁"}</span>
      </div>
    );
  }

  let imgUrl: string | null = null;
  if (card.card_type === "meme") {
    imgUrl = card.meme_image_url ?? null;
  } else if (card.card_type === "paw-moments" || card.card_type === "custom-card") {
    imgUrl = card.paw_photos?.[0] ?? null;
  } else {
    // Prefer Supabase template image, fall back to stored front_image_url
    imgUrl = tmpl?.front_image_url ?? card.front_image_url ?? null;
  }

  if (imgUrl) {
    return (
      <div className={`relative ${w} ${h} rounded-xl overflow-hidden flex-shrink-0`}>
        <Image src={imgUrl} alt="" fill
          className={card.card_type === "meme" ? "object-contain bg-black" : "object-cover"}
          sizes="48px" />
      </div>
    );
  }
  return (
    <div className={`${w} ${h} rounded-xl flex items-center justify-center flex-shrink-0 text-2xl`}
      style={{ background: card.card_type === "paw-moments" ? "rgba(139,94,60,0.1)" : card.card_type === "meme" ? "rgba(255,20,147,0.1)" : "rgba(147,51,234,0.1)" }}>
      {card.card_type === "paw-moments" ? "🐾" : card.card_type === "meme" ? "🔥" : "💌"}
    </div>
  );
}

function CardStack({ cards, templateMap }: { cards: CardWithDir[]; templateMap: TemplateMap }) {
  const count = cards.length;
  if (count === 1) return <CardThumb card={cards[0]} templateMap={templateMap} />;

  const visible = cards.slice(0, Math.min(3, count)).reverse();
  const offsets = visible.length === 2 ? [6, 0] : [12, 6, 0];

  return (
    <div className="relative flex-shrink-0" style={{ width: 48 + (visible.length - 1) * 5, height: 64 }}>
      {visible.map((card, i) => {
        const offset = offsets[i];
        const rotate = visible.length === 2
          ? (i === 0 ? -6 : 0)
          : (i === 0 ? -10 : i === 1 ? -4 : 0);
        return (
          <div key={card.id}
            className="absolute bottom-0"
            style={{
              left: offset,
              transform: `rotate(${rotate}deg)`,
              transformOrigin: "bottom center",
              zIndex: i + 1,
              filter: i < visible.length - 1 ? "brightness(0.85)" : "none",
            }}>
            <CardThumb card={card} small templateMap={templateMap} />
          </div>
        );
      })}
      {count > 3 && (
        <div className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold"
          style={{ fontSize: 9 }}>
          {count}
        </div>
      )}
    </div>
  );
}

// ── Thread View ────────────────────────────────────────────────────────────────
function ThreadView({
  contact, onBack, templateMap, categoryMap,
}: {
  contact: Contact;
  onBack: () => void;
  templateMap: TemplateMap;
  categoryMap: CategoryMap;
}) {
  const router = useRouter();
  const sorted = [...contact.cards].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const [reactionMap, setReactionMap] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    const supabase = createClient();
    const ids = contact.cards.map(c => c.id);
    if (!ids.length) return;
    supabase.from("card_reactions").select("card_id, emoji").in("card_id", ids)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, Record<string, number>> = {};
        for (const r of data) {
          if (!map[r.card_id]) map[r.card_id] = {};
          map[r.card_id][r.emoji] = (map[r.card_id][r.emoji] || 0) + 1;
        }
        setReactionMap(map);
      });
  }, [contact.cards]);

  function openCard(card: CardWithDir) {
    const backUrl = `/history?contact=${encodeURIComponent(contact.phone)}`;
    if (card.template_id) {
      const firstTimeReceived = card.direction === "received" && !card.viewed_at;
      const params = new URLSearchParams({
        view: "true", cardId: card.id,
        message: card.message ?? "", sender: card.sender_name ?? "",
        back: backUrl, direction: card.direction,
        ...(firstTimeReceived ? { startEnvelope: "true" } : {}),
      });
      router.push(`/card/${card.template_id}?${params.toString()}`);
    } else {
      router.push(`/preview/${card.short_code}?back=${encodeURIComponent(backUrl)}`);
    }
  }

  return (
    <div className="flex flex-col" style={{ minHeight: "100%", background: "linear-gradient(180deg,#FAFAF8 0%,#F2F1EE 100%)" }}>
      {/* Header */}
      <div style={{ background: "white", borderBottom: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 12px rgba(0,0,0,0.04)", paddingTop: "calc(env(safe-area-inset-top, 44px) + 12px)" }}
        className="flex items-center gap-3 px-4 pb-4">
        <button onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: "rgba(0,0,0,0.05)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#6b7280" }}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm"
          style={{ background: contact.color, boxShadow: `0 2px 8px ${contact.color}55` }}>
          {contact.initials || <PersonIcon />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900">{contact.label}</p>
        </div>
      </div>

      {/* Cards timeline */}
      <div className="flex-1 py-6 px-4">
        <div className="flex flex-col">
          {sorted.map((card, i) => {
            const isSent       = card.direction === "sent";
            const prev         = i > 0 ? sorted[i - 1] : null;
            const showDate     = i === 0 || (prev &&
              new Date(card.created_at).toDateString() !== new Date(prev.created_at).toDateString());
            const category     = getCardCategory(card, templateMap, categoryMap);
            const prevCat      = prev ? getCardCategory(prev, templateMap, categoryMap) : null;
            const showCatLabel = i === 0 || prevCat !== category;
            const showDivider  = !showDate && !showCatLabel && i > 0;

            return (
              <div key={card.id}>
                {showDate && (
                  <div className="flex items-center gap-2 my-5">
                    <div className="flex-1" style={{ height: 1.5, background: "rgba(0,0,0,0.18)", borderRadius: 1 }} />
                    <p className="text-[10px] font-semibold uppercase tracking-widest px-2" style={{ color: "#666" }}>
                      {new Date(card.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <div className="flex-1" style={{ height: 1.5, background: "rgba(0,0,0,0.18)", borderRadius: 1 }} />
                  </div>
                )}

                {showCatLabel && (
                  <div className="flex items-center gap-2 my-4">
                    <div className="flex-1 h-px" style={{ background: "rgba(0,0,0,0.07)" }} />
                    <span className="text-[9px] font-semibold uppercase tracking-widest px-2" style={{ color: "#aaa" }}>{category}</span>
                    <div className="flex-1 h-px" style={{ background: "rgba(0,0,0,0.07)" }} />
                  </div>
                )}

                {showDivider && (
                  <div className="flex justify-center my-3">
                    <div style={{ width: "76%", height: 1, background: "rgba(0,0,0,0.06)", borderRadius: 1 }} />
                  </div>
                )}

                <div className="flex justify-center mb-1">
                  <button onClick={() => openCard(card)}
                    className="w-[90%] text-left overflow-hidden active:scale-[0.985] transition-transform"
                    style={{
                      borderRadius: 18,
                      background: "white",
                      boxShadow: isSent
                        ? "0 3px 20px rgba(245,200,66,0.18), 0 1px 6px rgba(0,0,0,0.06)"
                        : "0 3px 20px rgba(76,175,80,0.15), 0 1px 6px rgba(0,0,0,0.06)",
                      border: `1.5px solid ${isSent ? "rgba(245,200,66,0.45)" : "rgba(76,175,80,0.35)"}`,
                    }}>
                    <div style={{
                      height: 3,
                      background: isSent
                        ? "linear-gradient(90deg,#F5C842,#E8A800)"
                        : "linear-gradient(90deg,#4CAF50,#2E7D32)",
                      opacity: 0.75,
                    }} />

                    <div className="flex items-start gap-3 px-3.5 py-3">
                      <CardThumb card={card} templateMap={templateMap} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{
                            background: isSent ? "rgba(245,200,66,0.12)" : "rgba(76,175,80,0.1)",
                            color: isSent ? "#A07820" : "#2A7D2E",
                          }}>
                            {isSent ? "Sent" : "Received"}
                          </span>
                          <span className="text-[9px] font-medium" style={{ color: isSent ? "#C9A84C" : "#66BB6A" }}>
                            · {category}
                          </span>
                        </div>

                        <p className="text-[10px] mt-1.5" style={{ color: "#bbb" }}>{timeAgo(card.created_at)}</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main Chats Page ────────────────────────────────────────────────────────────
function ChatsPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const contactParam = searchParams.get("contact");

  const [search,        setSearch]        = useState("");
  const [loading,       setLoading]       = useState(true);
  const [contacts,      setContacts]      = useState<Contact[]>([]);
  const [selected,      setSelected]      = useState<Contact | null>(null);
  const [listReactions, setListReactions] = useState<Record<string, Record<string, number>>>({});
  const [templateMap,   setTemplateMap]   = useState<TemplateMap>({});
  const [categoryMap,   setCategoryMap]   = useState<CategoryMap>({});
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const authPhone = user.phone ?? null;
      const { data: profileData } = await supabase.from("profiles").select("phone").eq("id", user.id).single();
      const myPhone = profileData?.phone ?? authPhone;

      // ── Sent cards ─────────────────────────────────────────────────────────
      const { data: sentRaw } = await supabase
        .from("sent_cards")
        .select("id, short_code, recipient_name, recipient_phone, sender_name, sender_id, message, template_id, front_image_url, meme_image_url, paw_photos, card_type, created_at, viewed_at")
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false });

      // ── Received cards ─────────────────────────────────────────────────────
      let recvQ = supabase
        .from("sent_cards")
        .select("id, short_code, recipient_name, recipient_phone, sender_name, sender_id, message, template_id, front_image_url, meme_image_url, paw_photos, card_type, created_at, viewed_at")
        .order("created_at", { ascending: false });
      if (myPhone) {
        const withPlus    = myPhone.startsWith("+") ? myPhone : `+${myPhone}`;
        const withoutPlus = myPhone.startsWith("+") ? myPhone.slice(1) : myPhone;
        recvQ = recvQ.or(`recipient_id.eq.${user.id},recipient_phone.eq.${withPlus},recipient_phone.eq.${withoutPlus}`);
      } else {
        recvQ = recvQ.eq("recipient_id", user.id);
      }
      recvQ = recvQ.neq("sender_id", user.id);
      const { data: recvRaw } = await recvQ;

      // ── Batch-fetch Supabase templates for all template_ids ────────────────
      const allCards = [...(sentRaw ?? []), ...(recvRaw ?? [])] as any[];
      const uniqueTmplIds = Array.from(
        new Set(allCards.map(c => c.template_id).filter(Boolean))
      );
      if (uniqueTmplIds.length > 0) {
        const { data: tmplData } = await supabase
          .from("templates")
          .select("id, category_id, front_image_url, color_accent")
          .in("id", uniqueTmplIds);

        const newTmplMap: TemplateMap = {};
        const catIds = new Set<string>();
        for (const t of (tmplData ?? [])) {
          newTmplMap[t.id] = t;
          catIds.add(t.category_id);
        }
        setTemplateMap(newTmplMap);

        // Batch-fetch categories referenced by those templates
        const catIdsArr = Array.from(catIds);
        if (catIdsArr.length > 0) {
          const { data: catData } = await supabase
            .from("categories")
            .select("id, name, slug")
            .in("id", catIdsArr);
          const newCatMap: CategoryMap = {};
          for (const c of (catData ?? [])) newCatMap[c.id] = c;
          setCategoryMap(newCatMap);
        }
      }

      // ── Sender profiles for received cards ─────────────────────────────────
      const senderIds = Array.from(new Set((recvRaw ?? []).map((c: any) => c.sender_id).filter(Boolean)));
      const { data: senderProfs } = senderIds.length > 0
        ? await supabase.from("profiles").select("id, phone, full_name").in("id", senderIds)
        : { data: [] };
      const senderMap: Record<string, { phone: string | null; name: string | null }> = {};
      for (const p of (senderProfs ?? [])) senderMap[p.id] = { phone: p.phone, name: p.full_name };

      // ── Build unified contact map ───────────────────────────────────────────
      const contactMap = new Map<string, Contact>();

      for (const card of (sentRaw ?? []) as any[]) {
        // Gift cards each get their own individual chat box
        if (card.card_type === "gift-card") {
          let gc: any = {};
          try { gc = JSON.parse(card.message ?? "{}"); } catch {}
          const gcKey   = `gift-${card.id}`;
          const gcLabel = card.recipient_name?.trim() || card.recipient_phone;
          contactMap.set(gcKey, {
            key: gcKey, label: gcLabel, phone: card.recipient_phone,
            initials: getInitials(gcLabel),
            color: gc.vendorColor ?? colorFor(card.recipient_phone),
            cards: [{ ...card, direction: "sent" }],
          });
          continue;
        }

        const key   = card.recipient_phone;
        const label = card.recipient_name?.trim() || card.recipient_phone;
        if (!contactMap.has(key)) {
          contactMap.set(key, {
            key, label, phone: card.recipient_phone,
            initials: getInitials(label),
            color: colorFor(key), cards: [],
          });
        }
        contactMap.get(key)!.cards.push({ ...card, direction: "sent" });
      }

      for (const card of (recvRaw ?? []) as any[]) {
        // Gift cards each get their own individual chat box
        if (card.card_type === "gift-card") {
          let gc: any = {};
          try { gc = JSON.parse(card.message ?? "{}"); } catch {}
          const info    = senderMap[card.sender_id] ?? {};
          const name    = info.name ?? card.sender_name ?? "Someone";
          const sPhone  = info.phone ?? null;
          const gcKey   = `gift-${card.id}`;
          contactMap.set(gcKey, {
            key: gcKey, label: name, phone: sPhone ?? card.recipient_phone,
            initials: getInitials(name),
            color: gc.vendorColor ?? colorFor(gcKey),
            cards: [{ ...card, direction: "received" }],
          });
          continue;
        }

        const info = senderMap[card.sender_id] ?? {};
        const name = info.name ?? card.sender_name ?? "Someone";
        const sPhone = info.phone ?? null;
        let key = sPhone ?? card.sender_id ?? name;

        if (sPhone && !contactMap.has(sPhone)) {
          const alt = sPhone.startsWith("+") ? sPhone.slice(1) : `+${sPhone}`;
          if (contactMap.has(alt)) key = alt;
        }

        if (!contactMap.has(key)) {
          contactMap.set(key, {
            key, label: name,
            phone: sPhone ?? card.recipient_phone,
            initials: getInitials(name),
            color: colorFor(key), cards: [],
          });
        }
        contactMap.get(key)!.cards.push({ ...card, direction: "received" });
      }

      // Sort contacts by latest card, dedupe cards within each contact
      const sorted = Array.from(contactMap.values())
        .map(c => {
          const seen = new Set<string>();
          const deduped = c.cards.filter(card => {
            if (seen.has(card.id)) return false;
            seen.add(card.id);
            return true;
          });
          return {
            ...c,
            cards: deduped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
          };
        })
        .sort((a, b) => new Date(b.cards[0].created_at).getTime() - new Date(a.cards[0].created_at).getTime());

      setContacts(sorted);

      // Fetch reactions for all cards
      const allIds = allCards.map((c: any) => c.id);
      if (allIds.length > 0) {
        const { data: rxData } = await supabase.from("card_reactions").select("card_id, emoji").in("card_id", allIds);
        if (rxData) {
          const rxMap: Record<string, Record<string, number>> = {};
          for (const r of rxData) {
            if (!rxMap[r.card_id]) rxMap[r.card_id] = {};
            rxMap[r.card_id][r.emoji] = (rxMap[r.card_id][r.emoji] || 0) + 1;
          }
          setListReactions(rxMap);
        }
      }

      setLoading(false);
    }
    load();
  }, [router]);

  // Auto-open from URL param
  useEffect(() => {
    if (!contactParam || selected) return;
    const match = contacts.find(c => c.phone === contactParam || c.key === contactParam);
    if (match) setSelected(match);
  }, [contacts, contactParam]);

  // Realtime reaction updates
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("chats-reactions")
      .on("postgres_changes", { event: "*", schema: "public", table: "card_reactions" }, (payload) => {
        const row = (payload.new || payload.old) as { card_id: string; emoji: string };
        if (!row?.card_id) return;
        supabase.from("card_reactions").select("emoji").eq("card_id", row.card_id).then(({ data }) => {
          if (!data) return;
          const counts: Record<string, number> = {};
          for (const r of data) counts[r.emoji] = (counts[r.emoji] || 0) + 1;
          setListReactions(prev => ({ ...prev, [row.card_id]: counts }));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (selected) {
    return (
      <ThreadView
        contact={selected}
        onBack={() => setSelected(null)}
        templateMap={templateMap}
        categoryMap={categoryMap}
      />
    );
  }

  const filtered = contacts.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  return (
    <div className="flex flex-col" style={{ minHeight: "100%", background: "linear-gradient(180deg,#FAFAF8 0%,#F2F1EE 100%)" }}>

      {/* Premium gradient header */}
      <div style={{ background: "linear-gradient(to bottom,#9B59B6 0%,#C050A0 60%,#FF6B8A 100%)", paddingTop: "calc(env(safe-area-inset-top, 44px) + 12px)", paddingBottom: 16, paddingLeft: 16, paddingRight: 16, position: "relative", overflow: "hidden", touchAction: "pan-y" }}>
        {/* Decorative blobs */}
        <div style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
        <div style={{ position: "absolute", bottom: -10, right: 55, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", top: 20, left: -20, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
          <button onClick={() => router.push("/home")}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: 0 }}>Chats</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: 0 }}>Your Conversations</p>
          </div>
        </div>
      </div>

      {/* Search bar — outside gradient, scrolls with content */}
      <div style={{ background: "white", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "10px 16px", position: "relative" }}>
        <Search size={15} style={{ position: "absolute", left: 30, top: "50%", transform: "translateY(-50%)", color: "#aaa" }} />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts..."
          style={{ width: "100%", background: "#f5f5f7", border: "none", borderRadius: 12, padding: "9px 16px 9px 36px", color: "#111", fontSize: 14, outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
          <span className="text-4xl">💌</span>
          <p className="text-gray-500 text-sm">No chats yet. Send your first card!</p>
        </div>
      ) : (
        <div className="py-4 px-4 flex flex-col gap-3">
          {filtered.map((contact) => {
            const last       = contact.cards[0];
            const isSent     = last.direction === "sent";
            const isGiftCard = last.card_type === "gift-card";
            let gc: any = {};
            if (isGiftCard) { try { gc = JSON.parse(last.message ?? "{}"); } catch {} }

            // Soft magical palette for gift cards — independent of harsh vendor brand colors
            const gcGrad   = "linear-gradient(135deg,#FBAED2,#C4B5FD)";   // rose → lavender
            const gcStrip  = "linear-gradient(90deg,#F9A8D4,#C084FC)";     // soft pink → soft purple
            const gcBorder = "rgba(244,168,210,0.35)";
            const gcText   = "#A855C8";                                      // muted plum

            return (
              <button
                key={contact.key}
                onClick={() => {
                  if (contact.cards.length === 1) {
                    const card = contact.cards[0];
                    const backUrl = `/history?contact=${encodeURIComponent(contact.phone)}`;
                    if (card.template_id) {
                      const firstTimeReceived = card.direction === "received" && !card.viewed_at;
                      const params = new URLSearchParams({
                        view: "true", cardId: card.id,
                        message: card.message ?? "", sender: card.sender_name ?? "",
                        back: backUrl, direction: card.direction,
                        ...(firstTimeReceived ? { startEnvelope: "true" } : {}),
                      });
                      router.push(`/card/${card.template_id}?${params.toString()}`);
                    } else {
                      router.push(`/preview/${card.short_code}?back=${encodeURIComponent(backUrl)}`);
                    }
                  } else {
                    setSelected(contact);
                  }
                }}
                className="w-full text-left active:scale-[0.985] transition-transform"
                style={{
                  borderRadius: 20,
                  background: isGiftCard ? "linear-gradient(135deg,#FFF5FB 0%,#F8F0FF 100%)" : "white",
                  boxShadow: isGiftCard
                    ? "0 4px 20px rgba(196,181,253,0.25), 0 1px 4px rgba(0,0,0,0.04)"
                    : "0 2px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
                  border: isGiftCard ? `1px solid ${gcBorder}` : "1px solid rgba(0,0,0,0.05)",
                  overflow: "hidden",
                }}>

                <div style={{
                  height: 3,
                  background: isGiftCard
                    ? gcStrip
                    : isSent
                      ? "linear-gradient(90deg,#F5C842,#E8A800)"
                      : "linear-gradient(90deg,#4CAF50,#2E7D32)",
                  opacity: 0.9,
                }} />

                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Avatar / thumbnail */}
                  {isGiftCard ? (
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: gcGrad, boxShadow: "0 2px 10px rgba(196,181,253,0.4)" }}>
                      {gc.vendorEmoji ?? "🎁"}
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-sm"
                      style={{ background: contact.color, boxShadow: `0 2px 8px ${contact.color}55` }}>
                      {contact.initials || <PersonIcon />}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {isGiftCard && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                          style={{ background: gcStrip }}>
                          GIFT CARD
                        </span>
                      )}
                      <p className="font-bold text-gray-900 text-sm truncate">{contact.label}</p>
                    </div>
                    <p className="text-[11px] truncate" style={{ color: isGiftCard ? gcText : "#C9A84C" }}>
                      {isGiftCard
                        ? `${gc.vendorName ?? "Gift"} · $${gc.amount ?? "—"}`
                        : `${contact.cards.length} card${contact.cards.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <p className="text-[10px]" style={{ color: "#bbb" }}>{timeAgo(last.created_at)}</p>
                    <CardStack cards={contact.cards} templateMap={templateMap} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ChatsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: "100%" }}>
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    }>
      <ChatsPageInner />
    </Suspense>
  );
}
