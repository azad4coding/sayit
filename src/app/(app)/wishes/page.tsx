"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Send, Eye, User } from "lucide-react";

type SentCard = {
  id: string;
  short_code: string;
  recipient_name: string | null;
  recipient_phone: string;
  recipient_id: string | null;
  message: string | null;
  card_type: string | null;
  template_id: string | null;
  created_at: string;
  viewed_at: string | null;
  sender_name: string | null;
  sender_id?: string | null;
};

type Notification = {
  id: string;
  type: "sent" | "viewed" | "received" | "reacted" | "occasion";
  title: string;
  subtitle: string;
  time: string;
  rawTime: string; // ISO for sorting
  icon: string;
  color: string;
  isNew: boolean;
  href?: string;
  shortCode?: string;
  templateId?: string;
  cardId?: string;
  senderName?: string;
  message?: string;
  senderPhoto?: string;
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

function daysUntil(month: number, day: number): number {
  const now = new Date();
  const target = new Date(now.getFullYear(), month - 1, day);
  if (target < now) target.setFullYear(now.getFullYear() + 1);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

const OCCASIONS = [
  { name: "Mother's Day",    month: 5,  day: 11, icon: "💐", color: "#FF6B8A", category: "romance"   },
  { name: "Father's Day",    month: 6,  day: 21, icon: "👔", color: "#3498DB", category: "occasions" },
  { name: "Independence Day", month: 7,  day: 4,  icon: "🎆", color: "#E74C3C", category: "holidays"  },
  { name: "Friendship Day",   month: 8,  day: 3,  icon: "🤝", color: "#F39C12", category: "occasions" },
  { name: "Halloween",        month: 10, day: 31, icon: "🎃", color: "#E67E22", category: "holidays"  },
  { name: "Christmas",        month: 12, day: 25, icon: "🎄", color: "#27AE60", category: "holidays"  },
].map(o => ({ ...o, days: daysUntil(o.month, o.day) }))
 .filter(o => o.days <= 60)
 .sort((a, b) => a.days - b.days);

export default function NotificationsPage() {
  const router     = useRouter();
  const supabase   = createClient();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(true);
  const lastSeenRef = useRef<string>(new Date(0).toISOString());
  const userIdRef   = useRef<string | null>(null);

  async function fetchCategoryMap(templateIds: string[]): Promise<Record<string, string>> {
    if (!templateIds.length) return {};
    const { data } = await supabase
      .from("templates")
      .select("id, categories(name)")
      .in("id", templateIds);
    const map: Record<string, string> = {};
    for (const t of (data ?? []) as any[]) {
      const catName = t.categories?.name;
      if (catName) map[t.id] = catName;
    }
    return map;
  }

  async function loadNotifications(userId: string, lastSeen: string) {
    const notifs: Notification[] = [];

    // ── Received cards ────────────────────────────────────────────────────
    const authRes = await supabase.auth.getUser();
    const user = authRes.data.user!;
    const { data: profileData } = await supabase.from("profiles").select("phone").eq("id", userId).single();
    const effectivePhone = profileData?.phone ?? user.phone ?? null;

    let receivedQuery = supabase
      .from("sent_cards")
      .select("id, short_code, recipient_name, recipient_phone, message, card_type, template_id, created_at, viewed_at, sender_name, sender_id")
      .order("created_at", { ascending: false })
      .limit(30);

    if (effectivePhone) {
      const withPlus    = effectivePhone.startsWith("+") ? effectivePhone : `+${effectivePhone}`;
      const withoutPlus = effectivePhone.startsWith("+") ? effectivePhone.slice(1) : effectivePhone;
      receivedQuery = receivedQuery.or(
        `recipient_id.eq.${userId},recipient_phone.eq.${withPlus},recipient_phone.eq.${withoutPlus}`
      );
    } else {
      receivedQuery = receivedQuery.eq("recipient_id", userId);
    }
    receivedQuery = receivedQuery.neq("sender_id", userId);

    // Fetch received + sent in parallel
    const [{ data: receivedData }, { data: sentData }] = await Promise.all([
      receivedQuery,
      supabase
        .from("sent_cards")
        .select("id, short_code, recipient_name, recipient_phone, recipient_id, message, card_type, template_id, created_at, viewed_at, sender_name")
        .eq("sender_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    // ── Batch-fetch category names for all template IDs (both sent + received) ─
    const allTemplateIds = Array.from(new Set([
      ...(receivedData ?? []).map((c: any) => c.template_id),
      ...(sentData ?? []).map((c: any) => c.template_id),
    ].filter(Boolean)));
    const categoryMap = await fetchCategoryMap(allTemplateIds);

    // Batch-fetch sender profiles (name + photo)
    const senderIds = Array.from(new Set((receivedData ?? []).map((c: any) => c.sender_id).filter(Boolean)));
    const { data: senderProfiles } = senderIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", senderIds)
      : { data: [] };
    const senderPhotoMap: Record<string, string> = {};
    const senderNameMap: Record<string, string>  = {};
    for (const p of (senderProfiles ?? [])) {
      if (p.avatar_url) senderPhotoMap[p.id] = p.avatar_url;
      if (p.full_name)  senderNameMap[p.id]  = p.full_name;
    }

    for (const card of (receivedData ?? []) as SentCard[]) {
      // Prefer full_name from profiles, then sender_name from card, then fallback
      const from = (card.sender_id ? senderNameMap[card.sender_id] : null)
        ?? (card.sender_name?.trim() || "Your friend");
      const isPaw  = card.card_type === "paw-moments";
      const isGift = card.card_type === "gift-card";
      const receivedCategoryName = card.template_id ? categoryMap[card.template_id] : null;
      let gcVendor = "";
      if (isGift) { try { gcVendor = JSON.parse(card.message ?? "{}").vendorName ?? ""; } catch {} }
      notifs.push({
        id: `received-${card.id}`,
        type: "received",
        title: isGift ? `${from} sent you a gift card 🎁` : `${from} sent you a card`,
        subtitle: isGift ? (gcVendor ? `${gcVendor} Gift Card — Tap to redeem` : "Tap to open") : isPaw ? "Paw Moments 🐾" : receivedCategoryName ? `${receivedCategoryName} card — Tap to open` : "Tap to open",
        time: timeAgo(card.created_at),
        rawTime: card.created_at,
        icon: isPaw ? "🐾" : isGift ? "🎁" : "💌",
        color: "#FF6B8A",
        isNew: card.created_at > lastSeen,
        shortCode: card.short_code,
        templateId: card.template_id ?? undefined,
        cardId: card.id,
        senderName: from,
        message: card.message ?? undefined,
        senderPhoto: card.sender_id ? senderPhotoMap[card.sender_id] : undefined,
      });
    }

    // ── Batch-fetch recipient profiles (so sent notifications show names not numbers) ──
    const recipientIds = Array.from(new Set((sentData ?? []).map((c: any) => c.recipient_id).filter(Boolean)));
    const { data: recipientProfiles } = recipientIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", recipientIds)
      : { data: [] };
    const recipientNameMap: Record<string, string> = {};
    for (const p of (recipientProfiles ?? [])) {
      if (p.full_name) recipientNameMap[p.id] = p.full_name;
    }

    // ── Sent cards + viewed ──────────────────────────────────────────────
    for (const card of (sentData ?? []) as SentCard[]) {
      // Priority: SayIt profile name → saved recipient_name → friendly phone
      const profileName = card.recipient_id ? recipientNameMap[card.recipient_id] : null;
      const rawName = card.recipient_name?.trim() || null;
      const friendlyPhone = card.recipient_phone
        ? (card.recipient_phone.startsWith("+") ? card.recipient_phone : `+${card.recipient_phone}`)
        : null;
      const name = profileName ?? rawName ?? friendlyPhone ?? "a friend";
      const isPaw = card.card_type === "paw-moments";
      const categoryName = card.template_id ? categoryMap[card.template_id] : null;

      if (card.viewed_at) {
        notifs.push({
          id: `viewed-${card.id}`,
          type: "viewed",
          title: `${name} opened your card`,
          subtitle: isPaw ? "They saw your Paw Moments 🐾" : categoryName ? `They opened your ${categoryName} card` : "They viewed your greeting",
          time: timeAgo(card.viewed_at),
          rawTime: card.viewed_at,
          icon: "👁️",
          color: "#27AE60",
          isNew: card.viewed_at > lastSeen,
          shortCode: card.short_code,
          templateId: card.template_id ?? undefined,
          cardId: card.id,
          senderName: card.sender_name ?? undefined,
          message: card.message ?? undefined,
        });
      }

      notifs.push({
        id: `sent-${card.id}`,
        type: "sent",
        title: `You sent ${name} a card`,
        subtitle: isPaw ? "Paw Moments collage" : categoryName ? `${categoryName} card` : "Tap to view",
        time: timeAgo(card.created_at),
        rawTime: card.created_at,
        icon: isPaw ? "🐾" : "💌",
        color: "#9B59B6",
        isNew: false, // sent cards are never "new" for the sender
        shortCode: card.short_code,
        templateId: card.template_id ?? undefined,
        cardId: card.id,
        senderName: card.sender_name ?? undefined,
        message: card.message ?? undefined,
      });
    }

    // ── Reactions ────────────────────────────────────────────────────────
    const sentCardIds = (sentData ?? []).map((c: SentCard) => c.id);
    if (sentCardIds.length > 0) {
      const { data: rxData } = await supabase
        .from("card_reactions")
        .select("emoji, created_at, user_id, card_id, sent_cards!inner(short_code, template_id, message)")
        .in("card_id", sentCardIds)
        .order("created_at", { ascending: false })
        .limit(20);

      if (rxData) {
        const reactorIds = Array.from(new Set(rxData.map((r: any) => r.user_id).filter(Boolean)));
        const { data: reactorProfiles } = reactorIds.length > 0
          ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", reactorIds)
          : { data: [] };
        const nameMap: Record<string, string> = {};
        const reactorPhotoMap: Record<string, string> = {};
        for (const p of (reactorProfiles ?? [])) {
          nameMap[p.id] = p.full_name ?? "Someone";
          if (p.avatar_url) reactorPhotoMap[p.id] = p.avatar_url;
        }

        for (const r of rxData as any[]) {
          const reactorName = nameMap[r.user_id] ?? "Someone";
          const card = r.sent_cards;
          const rxCategory = card?.template_id ? categoryMap[card.template_id] : null;
          notifs.push({
            id: `reacted-${r.card_id}-${r.user_id}-${r.emoji}`,
            type: "reacted",
            title: `${reactorName} reacted ${r.emoji} to your card`,
            subtitle: rxCategory ? `Tap to see your ${rxCategory} card` : "Tap to see the card",
            time: timeAgo(r.created_at),
            rawTime: r.created_at,
            icon: r.emoji,
            color: "#F39C12",
            isNew: r.created_at > lastSeen,
            shortCode: card?.short_code,
            templateId: card?.template_id ?? undefined,
            cardId: r.card_id,
            message: card?.message ?? undefined,
            senderPhoto: reactorPhotoMap[r.user_id] ?? undefined,
          });
        }
      }
    }

    // Sort newest first
    notifs.sort((a, b) => new Date(b.rawTime).getTime() - new Date(a.rawTime).getTime());

    return notifs;
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      userIdRef.current = user.id;

      const lastSeen = (() => {
        try { return localStorage.getItem(`lastSeenWishes_${user.id}`) ?? new Date(0).toISOString(); }
        catch { return new Date(0).toISOString(); }
      })();
      lastSeenRef.current = lastSeen;

      const notifs = await loadNotifications(user.id, lastSeen);
      setNotifications(notifs);
      setLoading(false);

      // Mark as seen AFTER a short delay so the "New" badges render before they disappear
      setTimeout(() => {
        try { localStorage.setItem(`lastSeenWishes_${user.id}`, new Date().toISOString()); } catch {}
      }, 3000);

      // ── Real-time: refresh feed on new card or reaction ─────────────────
      const channel = supabase.channel("wishes-realtime")
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "sent_cards",
            filter: `recipient_id=eq.${user.id}` },
          async () => {
            const updated = await loadNotifications(user.id, lastSeenRef.current);
            setNotifications(updated);
          }
        )
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "card_reactions" },
          async () => {
            const updated = await loadNotifications(user.id, lastSeenRef.current);
            setNotifications(updated);
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
    load();
  }, [router]);

  function handleTap(n: Notification) {
    if (n.href) { router.push(n.href); return; }
    if (n.templateId && n.cardId) {
      const params = new URLSearchParams({
        view: "true", cardId: n.cardId,
        message: n.message ?? "", sender: n.senderName ?? "",
        back: "/wishes",
      });
      router.push(`/card/${n.templateId}?${params.toString()}`);
      return;
    }
    if (n.shortCode) {
      router.push(`/preview/${n.shortCode}?back=${encodeURIComponent("/wishes")}`);
    }
  }

  const activityNotifs = notifications.filter(n => n.type !== "occasion");
  const newNotifs      = activityNotifs.filter(n => n.isNew);
  const earlierNotifs  = activityNotifs.filter(n => !n.isNew);

  function NotifRow({ n, last }: { n: Notification; last: boolean }) {
    return (
      <button
        onClick={() => handleTap(n)}
        className="w-full flex items-start gap-3 px-4 py-4 text-left active:bg-gray-50 transition-colors relative"
        style={{
          background: n.isNew ? "rgba(255,107,138,0.04)" : "white",
          ...(!last ? { borderBottom: "1.5px solid rgba(0,0,0,0.08)" } : {}),
        }}
      >
        {/* Unread pink dot */}
        {n.isNew && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: "#FF6B8A" }} />
        )}

        {/* Avatar / icon bubble */}
        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: `${n.color}18` }}>
          {(n.type === "received" || n.type === "reacted") && n.senderPhoto ? (
            <img src={n.senderPhoto} alt="" className="w-11 h-11 object-cover rounded-full" />
          ) : n.type === "viewed" ? (
            <Eye className="w-5 h-5" style={{ color: n.color }} />
          ) : n.type === "sent" ? (
            <Send className="w-4 h-4" style={{ color: n.color }} />
          ) : n.type === "received" ? (
            <User className="w-5 h-5" style={{ color: n.color }} />
          ) : (
            <span className="text-xl">{n.icon}</span>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 pt-0.5">
          <p className={`text-sm leading-snug ${n.isNew ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>
            {n.title}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{n.subtitle}</p>
          <p className={`text-[10px] mt-1 font-medium ${n.isNew ? "text-pink-400" : "text-gray-300"}`}>{n.time}</p>
        </div>

        {/* Reaction emoji badge or dot */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-1">
          {n.type === "reacted" ? (
            <span className="text-lg">{n.icon}</span>
          ) : n.isNew ? (
            <span className="w-2.5 h-2.5 rounded-full mt-1" style={{ background: "#FF6B8A" }} />
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "linear-gradient(180deg,#FAFAF8 0%,#F2F1EE 100%)" }}>
      {/* Clean white header */}
      <div style={{ background: "white", paddingTop: "calc(env(safe-area-inset-top, 44px) + 12px)", paddingBottom: 16, borderBottom: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 16, paddingRight: 16 }}>
          <button onClick={() => router.push("/home")}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "#f3f4f6", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0 }}>Wishes</h1>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>wishes, reactions & occasions</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 py-4">

          {/* ── New section ── */}
          {newNotifs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-1 mb-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">New</p>
                <span className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1"
                  style={{ background: "#FF6B8A" }}>
                  {newNotifs.length}
                </span>
              </div>
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden"
                style={{ border: "1px solid rgba(255,107,138,0.12)" }}>
                {newNotifs.map((n, i) => <NotifRow key={n.id} n={n} last={i === newNotifs.length - 1} />)}
              </div>
            </div>
          )}

          {/* ── Earlier section ── */}
          {earlierNotifs.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Earlier</p>
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                {earlierNotifs.map((n, i) => <NotifRow key={n.id} n={n} last={i === earlierNotifs.length - 1} />)}
              </div>
            </div>
          )}

          {/* Empty state */}
          {activityNotifs.length === 0 && (
            <div className="bg-white rounded-3xl p-8 flex flex-col items-center gap-3 text-center shadow-sm mt-4">
              <Bell className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-semibold text-gray-400">No activity yet</p>
              <p className="text-xs text-gray-300">Send your first card to get started</p>
              <button onClick={() => router.push("/home")}
                className="mt-1 px-6 py-2.5 rounded-2xl text-white text-sm font-semibold"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                Browse Cards
              </button>
            </div>
          )}

          {/* ── Upcoming Occasions ── */}
          {OCCASIONS.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Upcoming Occasions</p>
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                {OCCASIONS.map((occ, i) => (
                  <button key={occ.name}
                    onClick={() => router.push(`/category/${occ.category}`)}
                    className={`w-full flex items-center gap-3 px-4 py-4 text-left active:bg-gray-50 transition-colors ${i < OCCASIONS.length - 1 ? "border-b border-gray-50" : ""}`}>
                    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-xl"
                      style={{ background: `${occ.color}18` }}>
                      {occ.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{occ.icon} {occ.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: occ.color }}>
                        {occ.days === 0 ? "Today! Send a card now" : occ.days === 1 ? "Tomorrow — send a card!" : `In ${occ.days} days`}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white flex-shrink-0"
                      style={{ background: occ.color }}>
                      {occ.days === 0 ? "Today" : occ.days === 1 ? "Tomorrow" : `${occ.days}d`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
