"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Bell, Send, Eye, Calendar, ChevronRight, User } from "lucide-react";

type SentCard = {
  id: string;
  short_code: string;
  recipient_name: string | null;
  recipient_phone: string;
  message: string | null;
  card_type: string | null;
  template_id: string | null;
  created_at: string;
  viewed_at: string | null;
  sender_name: string | null;
  sender_id?: string | null;
};

type Reaction = {
  emoji: string;
  created_at: string;
  reactor_name: string | null;
  card_id: string;
  short_code: string;
  template_id: string | null;
  card_message: string | null;
};

type Notification = {
  id: string;
  type: "sent" | "viewed" | "received" | "reacted" | "occasion";
  title: string;
  subtitle: string;
  time: string;
  icon: string;
  color: string;
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
  { name: "Mother's Day",     month: 5,  day: 11, icon: "💐", color: "#FF6B8A", category: "romance",        days: 0 },
  { name: "Father's Day",     month: 6,  day: 21, icon: "👔", color: "#3498DB", category: "occasions",      days: 0 },
  { name: "Independence Day",  month: 7,  day: 4,  icon: "🎆", color: "#E74C3C", category: "holidays",       days: 0 },
  { name: "Friendship Day",    month: 8,  day: 3,  icon: "🤝", color: "#F39C12", category: "occasions",      days: 0 },
  { name: "Halloween",         month: 10, day: 31, icon: "🎃", color: "#E67E22", category: "holidays",       days: 0 },
  { name: "Christmas",         month: 12, day: 25, icon: "🎄", color: "#27AE60", category: "holidays",       days: 0 },
].map(o => ({ ...o, days: daysUntil(o.month, o.day) }))
 .filter(o => o.days <= 60)
 .sort((a, b) => a.days - b.days);

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      // ── Sent cards ────────────────────────────────────────────────
      const { data } = await supabase
        .from("sent_cards")
        .select("id, short_code, recipient_name, recipient_phone, message, card_type, template_id, created_at, viewed_at, sender_name")
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      // ── Received cards ─────────────────────────────────────────────
      const authPhone = user.phone ?? null;
      const { data: profileData } = await supabase
        .from("profiles").select("phone").eq("id", user.id).single();
      const profilePhone = profileData?.phone ?? null;
      const effectivePhone = profilePhone || authPhone;

      let receivedQuery = supabase
        .from("sent_cards")
        .select("id, short_code, recipient_name, recipient_phone, message, card_type, template_id, created_at, viewed_at, sender_name, sender_id")
        .order("created_at", { ascending: false })
        .limit(20);

      if (effectivePhone) {
        const withPlus    = effectivePhone.startsWith("+") ? effectivePhone : `+${effectivePhone}`;
        const withoutPlus = effectivePhone.startsWith("+") ? effectivePhone.slice(1) : effectivePhone;
        receivedQuery = receivedQuery.or(
          `recipient_id.eq.${user.id},recipient_phone.eq.${withPlus},recipient_phone.eq.${withoutPlus}`
        );
      } else {
        receivedQuery = receivedQuery.eq("recipient_id", user.id);
      }
      // Exclude self-sent cards
      receivedQuery = receivedQuery.neq("sender_id", user.id);
      const { data: receivedData } = await receivedQuery;

      // Batch-fetch sender photos for received cards
      const senderIds = Array.from(new Set((receivedData ?? []).map((c: any) => c.sender_id).filter(Boolean)));
      const { data: senderProfiles } = senderIds.length > 0
        ? await supabase.from("profiles").select("id, avatar_url").in("id", senderIds)
        : { data: [] };
      const senderPhotoMap: Record<string, string> = {};
      for (const p of (senderProfiles ?? [])) {
        if (p.avatar_url) senderPhotoMap[p.id] = p.avatar_url;
      }

      const notifs: Notification[] = [];

      // Activity notifications from received cards
      for (const card of (receivedData ?? []) as SentCard[]) {
        const from = card.sender_name?.trim() || "Someone";
        const isPaw = card.card_type === "paw-moments";
        const isGift = card.card_type === "gift-card";
        let gcVendor = "";
        if (isGift) { try { gcVendor = JSON.parse(card.message ?? "{}").vendorName ?? ""; } catch {} }
        notifs.push({
          id: `received-${card.id}`,
          type: "received",
          title: isGift ? `${from} sent you a gift card 🎁` : `${from} sent you a card`,
          subtitle: isGift ? (gcVendor ? `${gcVendor} Gift Card — Tap to redeem` : "Gift Card — Tap to open") : isPaw ? "Paw Moments collage" : "Tap to open",
          time: timeAgo(card.created_at),
          icon: isPaw ? "🐾" : "💌",
          color: "#FF6B8A",
          shortCode: card.short_code,
          templateId: card.template_id ?? undefined,
          cardId: card.id,
          senderName: from,
          message: card.message ?? undefined,
          senderPhoto: card.sender_id ? senderPhotoMap[card.sender_id] : undefined,
        });
      }

      // Activity notifications from sent cards
      for (const card of (data ?? []) as SentCard[]) {
        const name = card.recipient_name?.trim() || card.recipient_phone;
        const isPaw = card.card_type === "paw-moments";
        const cardLabel = isPaw ? "🐾 Paw Moments collage" : "a greeting card";

        // "Viewed" notification (higher priority, show first)
        if (card.viewed_at) {
          notifs.push({
            id: `viewed-${card.id}`,
            type: "viewed",
            title: `${name} opened your card`,
            subtitle: isPaw ? "They saw your Paw Moments collage" : "They viewed your greeting",
            time: timeAgo(card.viewed_at),
            icon: "👁️",
            color: "#27AE60",
            shortCode: card.short_code,
            templateId: card.template_id ?? undefined,
            cardId: card.id,
            senderName: card.sender_name ?? undefined,
            message: card.message ?? undefined,
          });
        }

        // "Sent" notification
        notifs.push({
          id: `sent-${card.id}`,
          type: "sent",
          title: `You sent ${name} a card`,
          subtitle: isPaw ? "Paw Moments collage" : "Tap to view",
          time: timeAgo(card.created_at),
          icon: isPaw ? "🐾" : "💌",
          color: "#9B59B6",
          shortCode: card.short_code,
          templateId: card.template_id ?? undefined,
          cardId: card.id,
          senderName: card.sender_name ?? undefined,
          message: card.message ?? undefined,
        });
      }

      // ── Reactions on sent cards ────────────────────────────────────
      const sentCardIds = (data ?? []).map((c: SentCard) => c.id);
      if (sentCardIds.length > 0) {
        // Join card_reactions with profiles to get reactor name
        const { data: rxData } = await supabase
          .from("card_reactions")
          .select("emoji, created_at, user_id, card_id, sent_cards!inner(short_code, template_id, message, sender_id)")
          .in("card_id", sentCardIds)
          .order("created_at", { ascending: false })
          .limit(20);

        if (rxData) {
          // Batch-fetch reactor names + photos
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
            notifs.push({
              id: `reacted-${r.card_id}-${r.user_id}-${r.emoji}`,
              type: "reacted",
              title: `${reactorName} reacted to your card`,
              subtitle: "Tap to see the card",
              time: timeAgo(r.created_at),
              icon: r.emoji,
              color: "#F39C12",
              shortCode: card?.short_code,
              templateId: card?.template_id ?? undefined,
              cardId: r.card_id,
              message: card?.message ?? undefined,
              senderPhoto: reactorPhotoMap[r.user_id] ?? undefined,
            });
          }
        }
      }

      // Sort: received & reacted first, then viewed, then sent
      notifs.sort((a, b) => {
        const priority = (t: string) =>
          t === "received" ? 0 : t === "reacted" ? 1 : t === "viewed" ? 2 : 3;
        return priority(a.type) - priority(b.type);
      });

      // Add upcoming occasion reminders at the end
      for (const occ of OCCASIONS) {
        notifs.push({
          id: `occasion-${occ.name}`,
          type: "occasion",
          title: `${occ.icon} ${occ.name} is coming up`,
          subtitle: occ.days === 0 ? "Today! Send a card now" : occ.days === 1 ? "Tomorrow — send a card!" : `In ${occ.days} days — don't forget to say it`,
          time: occ.days === 0 ? "Today" : occ.days === 1 ? "Tomorrow" : `${occ.days}d away`,
          icon: occ.icon,
          color: occ.color,
          href: `/category/${occ.category}`,
        });
      }

      setNotifications(notifs);
      setLoading(false);
    }
    load();
  }, [router]);

  function handleTap(n: Notification) {
    if (n.href) { router.push(n.href); return; }
    // For cards with a template, go to the full interactive card view
    if (n.templateId && n.cardId) {
      const params = new URLSearchParams({
        view: "true",
        cardId: n.cardId,
        message: n.message ?? "",
        sender: n.senderName ?? "",
        back: "/wishes",
      });
      router.push(`/card/${n.templateId}?${params.toString()}`);
      return;
    }
    // Fallback for custom/paw cards
    if (n.shortCode) { router.push(`/preview/${n.shortCode}?back=${encodeURIComponent("/wishes")}`); return; }
  }

  const activityNotifs = notifications.filter(n => n.type !== "occasion");
  const occasionNotifs = notifications.filter(n => n.type === "occasion");

  return (
    <div className="flex flex-col min-h-dvh bg-gray-50">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-4 shadow-sm flex items-center gap-3">
        <Bell className="w-5 h-5 text-gray-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-800">Notifications</h1>
          <p className="text-xs text-gray-400 mt-0.5">Your activity & upcoming occasions</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-4 py-5">

          {/* Activity section */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Activity</p>
            {activityNotifs.length === 0 ? (
              <div className="bg-white rounded-3xl p-6 flex flex-col items-center gap-3 text-center shadow-sm">
                <Send className="w-8 h-8 text-gray-200" />
                <p className="text-sm text-gray-400">No activity yet. Send your first card!</p>
                <button onClick={() => router.push("/home")}
                  className="px-6 py-2.5 rounded-2xl text-white text-sm font-semibold"
                  style={{ background:"linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                  Browse Cards
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                {activityNotifs.map((n, i) => (
                  <button key={n.id} onClick={() => handleTap(n)}
                    className={`w-full flex items-start gap-3 px-4 py-4 text-left active:bg-gray-50 transition-colors ${i < activityNotifs.length-1 ? "border-b border-gray-50" : ""}`}>
                    {/* Icon bubble */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                      style={{ background:`${n.color}15` }}>
                      {n.type === "viewed" ? (
                        <Eye className="w-5 h-5" style={{ color:n.color }} />
                      ) : (n.type === "received" || n.type === "reacted") && n.senderPhoto ? (
                        <img src={n.senderPhoto} alt="" className="w-10 h-10 object-cover" />
                      ) : n.type === "received" || n.type === "reacted" ? (
                        <User className="w-5 h-5" style={{ color:n.color }} />
                      ) : n.type === "sent" ? (
                        <Send className="w-4 h-4" style={{ color:n.color }} />
                      ) : null}
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 leading-snug">{n.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{n.subtitle}</p>
                    </div>
                    {/* Time + chevron */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <p className="text-[10px] text-gray-300">{n.time}</p>
                      <ChevronRight className="w-4 h-4 text-gray-200" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming occasions */}
          {occasionNotifs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Upcoming Occasions</p>
              <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
                {occasionNotifs.map((n, i) => (
                  <button key={n.id} onClick={() => handleTap(n)}
                    className={`w-full flex items-center gap-3 px-4 py-4 text-left active:bg-gray-50 transition-colors ${i < occasionNotifs.length-1 ? "border-b border-gray-50" : ""}`}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xl"
                      style={{ background:`${n.color}15` }}>
                      {n.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{n.title}</p>
                      <p className="text-xs mt-0.5" style={{ color:n.color }}>{n.subtitle}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background:n.color }}>
                        {n.time}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-200" />
                    </div>
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
