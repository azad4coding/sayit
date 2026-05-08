"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Send } from "lucide-react";

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

  const visible = members;

  function sendToContact(m: CircleMember) {
    try {
      sessionStorage.setItem("circle_contact", JSON.stringify({
        id:    m.userId,
        name:  m.name ?? m.phone,
        phone: m.phone,
      }));
    } catch { /* ignore */ }
    router.push("/home");
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
    <div className="min-h-dvh flex flex-col pb-28 below-title-bar" style={{ background: "linear-gradient(180deg,#FAFAF8,#F2F1EE)" }}>

      {/* ── Fixed compact title bar (WhatsApp-style) ── */}
      <div className="sticky-title-bar">
        <span style={{ fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: "-0.2px" }}>My Circle</span>
      </div>

      {/* ── Premium gradient header ── */}
      <div style={{ background: "linear-gradient(to bottom,#FF6B8A 0%,#C050A0 60%,#9B59B6 100%)", paddingTop: 16, paddingBottom: 20, paddingLeft: 16, paddingRight: 16, position: "relative", overflow: "hidden" }}>
        {/* Decorative blobs */}
        <div style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -15, right: 55, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 20, left: -20, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: visible.length > 0 ? 16 : 0, position: "relative", zIndex: 1 }}>
          <button onClick={() => router.push("/home")}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: 0 }}>My Circle</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: 0 }}>{visible.length} {visible.length === 1 ? "person" : "people"} connected</p>
          </div>
        </div>
        {/* Stats strip */}
        {visible.length > 0 && (
          <div style={{ display: "flex", gap: 8, position: "relative", zIndex: 1 }}>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "8px 10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
              <p style={{ color: "white", fontWeight: 800, fontSize: 18, margin: 0 }}>{visible.length}</p>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Contacts</p>
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "8px 10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
              <p style={{ color: "white", fontWeight: 800, fontSize: 18, margin: 0 }}>{visible.filter(m => m.onSayIt).length}</p>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>On SayIt</p>
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "8px 10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
              <p style={{ color: "white", fontWeight: 800, fontSize: 18, margin: 0 }}>{visible.reduce((s, m) => s + m.cardCount, 0)}</p>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Cards</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Members list ── */}
      <div className="mx-4 mt-4 mb-4">
        <div style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.04)" }}>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center py-14 gap-3 px-8">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl mb-2"
                style={{ background: "linear-gradient(135deg,#FF6B8A15,#9B59B615)" }}>💫</div>
              <p className="text-base font-bold text-gray-700 text-center">Your Circle is empty</p>
              <p className="text-sm text-gray-400 text-center leading-relaxed">
                Your Circle grows every time you send a card. Start sending!
              </p>
              <button onClick={() => router.push("/home")}
                className="mt-2 px-8 py-3 rounded-full text-sm font-bold text-white shadow-lg"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                Send a Card
              </button>
            </div>
          ) : (
            visible.map((m, i) => (
              <div key={m.phone}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < visible.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                {/* Avatar */}
                <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, background: m.onSayIt ? "linear-gradient(135deg,#FF6B8A,#9B59B6)" : "linear-gradient(135deg,#e5e7eb,#d1d5db)", color: m.onSayIt ? "white" : "#9ca3af", boxShadow: m.onSayIt ? "0 3px 10px rgba(255,107,138,0.3)" : "none" }}>
                  {getInitials(m.name, m.phone)}
                  {m.onSayIt && (
                    <span style={{ position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: "50%", background: "#22c55e", border: "2px solid white" }} />
                  )}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name ?? m.phone}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    {m.onSayIt ? (
                      <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, background: "#dcfce7", padding: "1px 7px", borderRadius: 20 }}>✓ On SayIt</span>
                    ) : (
                      <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>Not on SayIt yet</span>
                    )}
                    <span style={{ fontSize: 10, color: "#d1d5db" }}>·</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{m.cardCount} {m.cardCount === 1 ? "card" : "cards"}</span>
                  </div>
                </div>
                {/* Send */}
                <button onClick={() => sendToContact(m)}
                  style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", border: "none", cursor: "pointer", boxShadow: "0 3px 10px rgba(255,107,138,0.35)" }}>
                  <Send style={{ width: 14, height: 14, color: "white" }} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Info card ── */}
      {visible.length > 0 && (
        <div className="mx-4 mb-4">
          <div style={{ borderRadius: 16, padding: "14px 16px", background: "linear-gradient(135deg,rgba(255,107,138,0.06),rgba(155,89,182,0.06))", border: "1px solid rgba(255,107,138,0.15)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9B59B6", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>💡 About My Circle</p>
            <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>
              Everyone you've sent or received cards from. Green dot = on SayIt — cards deliver instantly, no link needed.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
