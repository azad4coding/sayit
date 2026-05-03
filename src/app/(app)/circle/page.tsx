"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Send, Users } from "lucide-react";

interface CircleMember {
  phone:     string;          // unique key
  name:      string | null;
  userId:    string | null;   // set if recipient is on SayIt
  cardCount: number;
  onSayIt:   boolean;
}

export default function CirclePage() {
  const router   = useRouter();
  const supabase = createClient();

  const [loading,       setLoading]       = useState(true);
  const [members,       setMembers]       = useState<CircleMember[]>([]);
  const [hidden,        setHidden]        = useState<Set<string>>(new Set());

  const purple = "#9B59B6";
  const accent = "#FF6B8A";

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      // ── 1. Every unique person this user has sent cards to ─────────────
      const { data: sentCards } = await supabase
        .from("sent_cards")
        .select("recipient_phone, recipient_name, recipient_id")
        .eq("sender_id", user.id)
        .not("recipient_phone", "is", null)
        .order("created_at", { ascending: false });

      // Group by phone, count cards, prefer entries that have recipient_id
      const phoneMap = new Map<string, CircleMember>();
      for (const card of (sentCards ?? [])) {
        const key = card.recipient_phone as string;
        if (!key) continue;
        const existing = phoneMap.get(key);
        if (!existing) {
          phoneMap.set(key, {
            phone:     key,
            name:      card.recipient_name ?? null,
            userId:    card.recipient_id   ?? null,
            cardCount: 1,
            onSayIt:   !!card.recipient_id,
          });
        } else {
          existing.cardCount++;
          // Upgrade userId/onSayIt if we now have one
          if (!existing.userId && card.recipient_id) {
            existing.userId  = card.recipient_id;
            existing.onSayIt = true;
          }
          // Prefer a real name over null
          if (!existing.name && card.recipient_name) {
            existing.name = card.recipient_name;
          }
        }
      }

      // ── 2. Everyone who has sent THIS user a card ──────────────────────
      const { data: receivedCards } = await supabase
        .from("sent_cards")
        .select("sender_id, sender_name, recipient_phone")
        .eq("recipient_id", user.id);

      // For received cards, look up sender's phone from profiles
      const senderIds = Array.from(new Set((receivedCards ?? []).map((c: any) => c.sender_id).filter(Boolean)));
      let senderPhones: Record<string, string> = {};
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, phone, full_name")
          .in("id", senderIds);
        for (const p of (profiles ?? [])) {
          if (p.phone) senderPhones[p.id] = p.phone;
        }
      }

      for (const card of (receivedCards ?? [])) {
        const senderPhone = senderPhones[card.sender_id] ?? null;
        if (!senderPhone) continue;
        const existing = phoneMap.get(senderPhone);
        if (!existing) {
          phoneMap.set(senderPhone, {
            phone:     senderPhone,
            name:      card.sender_name ?? null,
            userId:    card.sender_id   ?? null,
            cardCount: 1,
            onSayIt:   true, // they're on SayIt since they have an ID
          });
        } else {
          // Already in map from sent side; mark them as on SayIt
          if (!existing.onSayIt) { existing.onSayIt = true; existing.userId = card.sender_id; }
        }
      }

      // Sort: most cards first
      const sorted = Array.from(phoneMap.values()).sort((a, b) => b.cardCount - a.cardCount);
      setMembers(sorted);
      setLoading(false);
    }
    load();
  }, []);

  const visible = members.filter(m => !hidden.has(m.phone));

  function hideContact(phone: string) {
    setHidden(prev => new Set(Array.from(prev).concat(phone)));
  }

  function getInitials(name: string | null, phone: string) {
    if (name) return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    return phone.slice(-2);
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col pb-28" style={{ background: "linear-gradient(160deg,#FFF5F7,#F8F0FF)" }}>

      {/* ── Header ── */}
      <div className="px-5 pt-14 pb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Circle</h1>
            <p className="text-xs text-gray-400">{visible.length} connected</p>
          </div>
        </div>
      </div>

      {/* ── Members list ── */}
      <div className="mx-5 mb-5">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3 px-8">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl"
                style={{ background: "linear-gradient(135deg,#FFF5F7,#F8F0FF)" }}>💫</div>
              <p className="text-sm font-semibold text-gray-500 text-center">Your Circle is empty</p>
              <p className="text-xs text-gray-400 text-center">
                Your Circle grows every time you send a card. Start sending!
              </p>
              <button
                onClick={() => router.push("/home")}
                className="mt-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white shadow-md"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                Send a Card
              </button>
            </div>
          ) : (
            visible.map((m, i) => (
              <div key={m.phone}
                className={`flex items-center gap-3 px-4 py-4 ${i < visible.length - 1 ? "border-b border-gray-50" : ""}`}>

                {/* Avatar */}
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 relative"
                  style={{ background: "linear-gradient(135deg,#FF6B8A22,#9B59B622)", color: purple }}>
                  {getInitials(m.name, m.phone)}
                  {/* Green dot if on SayIt */}
                  {m.onSayIt && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
                  )}
                </div>

                {/* Name + status */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {m.name ?? m.phone}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {m.onSayIt ? (
                      <p className="text-[11px] text-green-500 font-semibold">✓ On SayIt</p>
                    ) : (
                      <p className="text-[11px] text-gray-400 font-medium">Not on SayIt yet</p>
                    )}
                    <span className="text-[10px] text-gray-300">·</span>
                    <p className="text-[11px] text-gray-400">
                      {m.cardCount} {m.cardCount === 1 ? "card" : "cards"}
                    </p>
                  </div>
                </div>

                {/* Send card */}
                <button
                  onClick={() => router.push("/home")}
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `${accent}15` }}>
                  <Send className="w-3.5 h-3.5" style={{ color: accent }} />
                </button>

                {/* Hide */}
                <button
                  onClick={() => hideContact(m.phone)}
                  className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-300 text-sm font-medium">✕</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Info card ── */}
      {visible.length > 0 && (
        <div className="mx-5">
          <div className="rounded-2xl px-4 py-4"
            style={{ background: "linear-gradient(135deg,#FF6B8A0D,#9B59B60D)", border: "1px solid #FF6B8A20" }}>
            <p className="text-xs font-semibold text-gray-500 mb-1">What is My Circle?</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Everyone you've sent cards to or received cards from on SayIt.
              Green dot means they're on SayIt — cards deliver instantly, no link needed.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
