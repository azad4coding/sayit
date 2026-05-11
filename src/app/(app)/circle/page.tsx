"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Send, ShieldOff } from "lucide-react";

interface CircleMember {
  phone:         string;          // unique key
  name:          string | null;
  userId:        string | null;   // set if recipient is on SayIt
  sentCount:     number;          // cards WE sent to them
  receivedCount: number;          // cards THEY sent to us
  onSayIt:       boolean;
  isNew:         boolean;         // they sent us a card but we haven't sent back yet
  isBlocked:     boolean;
}

export default function CirclePage() {
  const router   = useRouter();
  const supabase = createClient();

  const [loading,       setLoading]       = useState(true);
  const [members,       setMembers]       = useState<CircleMember[]>([]);
  const [blockingPhone, setBlockingPhone] = useState<string | null>(null);
  const [blocking,      setBlocking]      = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      // ── 1. Cards WE sent ─────────────────────────────────────────
      const { data: sentCards } = await supabase
        .from("sent_cards")
        .select("recipient_phone, recipient_name, recipient_id")
        .eq("sender_id", user.id)
        .not("recipient_phone", "is", null)
        .order("created_at", { ascending: false });

      const phoneMap = new Map<string, CircleMember>();
      for (const card of (sentCards ?? [])) {
        const key = card.recipient_phone as string;
        if (!key) continue;
        const existing = phoneMap.get(key);
        if (!existing) {
          phoneMap.set(key, {
            phone:         key,
            name:          card.recipient_name ?? null,
            userId:        card.recipient_id   ?? null,
            sentCount:     1,
            receivedCount: 0,
            onSayIt:       !!card.recipient_id,
            isNew:         false,
            isBlocked:     false,
          });
        } else {
          existing.sentCount++;
          if (!existing.userId && card.recipient_id) {
            existing.userId  = card.recipient_id;
            existing.onSayIt = true;
          }
          if (!existing.name && card.recipient_name) {
            existing.name = card.recipient_name;
          }
        }
      }

      // ── 2. Cards WE received ─────────────────────────────────────
      const { data: receivedCards } = await supabase
        .from("sent_cards")
        .select("sender_id, sender_name, recipient_phone")
        .eq("recipient_id", user.id);

      // Look up sender phones from profiles
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
            phone:         senderPhone,
            name:          card.sender_name ?? null,
            userId:        card.sender_id   ?? null,
            sentCount:     0,
            receivedCount: 1,
            onSayIt:       true,
            isNew:         true,   // received but haven't sent back
            isBlocked:     false,
          });
        } else {
          existing.receivedCount++;
          if (!existing.onSayIt) { existing.onSayIt = true; existing.userId = card.sender_id; }
        }
      }

      // ── 3. Load blocked contacts ──────────────────────────────────
      const { data: blocked } = await supabase
        .from("blocked_contacts")
        .select("blocked_phone")
        .eq("blocker_id", user.id);
      const blockedPhones = new Set((blocked ?? []).map((b: any) => b.blocked_phone));

      // ── 4. Finalise: mark isNew, isBlocked; filter out blocked ───
      const sorted = Array.from(phoneMap.values())
        .map(m => ({
          ...m,
          isNew:     m.receivedCount > 0 && m.sentCount === 0,
          isBlocked: blockedPhones.has(m.phone),
        }))
        .filter(m => !m.isBlocked)          // hide blocked contacts
        .sort((a, b) => {
          // New senders first, then by sent card count descending
          if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
          return b.sentCount - a.sentCount;
        });

      setMembers(sorted);
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function blockContact(m: CircleMember) {
    setBlocking(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBlocking(false); return; }

    await supabase.from("blocked_contacts").insert({
      blocker_id:      user.id,
      blocked_phone:   m.phone,
      blocked_user_id: m.userId ?? null,
    });

    setMembers(prev => prev.filter(x => x.phone !== m.phone));
    setBlockingPhone(null);
    setBlocking(false);
  }

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

  const newCount  = members.filter(m => m.isNew).length;
  const totalCards = members.reduce((s, m) => s + m.sentCount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-gray-50" style={{ minHeight: "100%" }}>
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-6" style={{ minHeight: "100%", background: "linear-gradient(180deg,#FAFAF8,#F2F1EE)" }}>

      {/* ── Premium gradient header ── */}
      <div style={{ background: "linear-gradient(to bottom,#FF6B8A 0%,#C050A0 60%,#9B59B6 100%)", paddingTop: "calc(env(safe-area-inset-top, 44px) + 12px)", paddingBottom: 20, paddingLeft: 16, paddingRight: 16, position: "relative", overflow: "hidden", touchAction: "pan-y" }}>
        {/* Decorative blobs */}
        <div style={{ position: "absolute", top: -30, right: -30, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -15, right: 55, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 20, left: -20, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: members.length > 0 ? 16 : 0, position: "relative", zIndex: 1 }}>
          <button onClick={() => router.push("/home")}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: 0 }}>My Circle</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: 0 }}>
              {members.length} {members.length === 1 ? "person" : "people"} connected
              {newCount > 0 && ` · ${newCount} new`}
            </p>
          </div>
        </div>
        {/* Stats strip */}
        {members.length > 0 && (
          <div style={{ display: "flex", gap: 8, position: "relative", zIndex: 1 }}>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "8px 10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
              <p style={{ color: "white", fontWeight: 800, fontSize: 18, margin: 0 }}>{members.length}</p>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Contacts</p>
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "8px 10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
              <p style={{ color: "white", fontWeight: 800, fontSize: 18, margin: 0 }}>{members.filter(m => m.onSayIt).length}</p>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>On SayIt</p>
            </div>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "8px 10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
              <p style={{ color: "white", fontWeight: 800, fontSize: 18, margin: 0 }}>{totalCards}</p>
              <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 9, margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Cards Sent</p>
            </div>
          </div>
        )}
      </div>

      {/* ── New senders banner ── */}
      {newCount > 0 && (
        <div className="mx-4 mt-4">
          <div style={{ borderRadius: 16, padding: "12px 16px", background: "linear-gradient(135deg,rgba(255,107,138,0.10),rgba(155,89,182,0.10))", border: "1px solid rgba(255,107,138,0.25)" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#C050A0", margin: "0 0 2px" }}>
              💌 {newCount} new {newCount === 1 ? "sender" : "senders"}
            </p>
            <p style={{ fontSize: 11, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
              {newCount === 1 ? "Someone sent you" : "People have sent you"} a card. Reply to connect, or block if unwanted.
            </p>
          </div>
        </div>
      )}

      {/* ── Members list ── */}
      <div className="mx-4 mt-4 mb-4">
        <div style={{ background: "white", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.04)" }}>
          {members.length === 0 ? (
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
            members.map((m, i) => (
              <div key={m.phone}>
                {/* Main row */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: i < members.length - 1 && blockingPhone !== m.phone ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                  {/* Avatar */}
                  <div style={{ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, background: m.onSayIt ? "linear-gradient(135deg,#FF6B8A,#9B59B6)" : "linear-gradient(135deg,#e5e7eb,#d1d5db)", color: m.onSayIt ? "white" : "#9ca3af", boxShadow: m.onSayIt ? "0 3px 10px rgba(255,107,138,0.3)" : "none" }}>
                    {getInitials(m.name, m.phone)}
                    {m.onSayIt && (
                      <span style={{ position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: "50%", background: "#22c55e", border: "2px solid white" }} />
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.name ?? m.phone}
                      </p>
                      {m.isNew && (
                        <span style={{ fontSize: 9, color: "white", fontWeight: 700, background: "linear-gradient(135deg,#FF6B8A,#C050A0)", padding: "2px 7px", borderRadius: 20, flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          New
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      {m.onSayIt ? (
                        <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, background: "#dcfce7", padding: "1px 7px", borderRadius: 20 }}>✓ On SayIt</span>
                      ) : (
                        <span style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>Not on SayIt yet</span>
                      )}
                      <span style={{ fontSize: 10, color: "#d1d5db" }}>·</span>
                      {m.sentCount > 0
                        ? <span style={{ fontSize: 11, color: "#9ca3af" }}>{m.sentCount} {m.sentCount === 1 ? "card sent" : "cards sent"}</span>
                        : <span style={{ fontSize: 11, color: "#9ca3af" }}>sent you a card</span>
                      }
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {/* Block toggle */}
                    {blockingPhone === m.phone ? null : (
                      <button
                        onClick={() => setBlockingPhone(m.phone)}
                        title="Block this contact"
                        style={{ width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", border: "none", cursor: "pointer" }}>
                        <ShieldOff style={{ width: 14, height: 14, color: "#9ca3af" }} />
                      </button>
                    )}
                    {/* Send button */}
                    <button onClick={() => sendToContact(m)}
                      style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", border: "none", cursor: "pointer", boxShadow: "0 3px 10px rgba(255,107,138,0.35)" }}>
                      <Send style={{ width: 14, height: 14, color: "white" }} />
                    </button>
                  </div>
                </div>

                {/* Inline block confirm */}
                {blockingPhone === m.phone && (
                  <div style={{ padding: "10px 16px 14px", borderBottom: i < members.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none", background: "#fff8f8" }}>
                    <p style={{ fontSize: 12, color: "#374151", fontWeight: 600, margin: "0 0 8px" }}>
                      Block {m.name ?? m.phone}? They won't be able to send you cards.
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setBlockingPhone(null)}
                        disabled={blocking}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "#f3f4f6", border: "none", color: "#374151", cursor: "pointer" }}>
                        Cancel
                      </button>
                      <button
                        onClick={() => blockContact(m)}
                        disabled={blocking}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#ef4444,#dc2626)", border: "none", color: "white", cursor: "pointer", opacity: blocking ? 0.6 : 1 }}>
                        {blocking ? "Blocking…" : "Block"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Info card ── */}
      {members.length > 0 && (
        <div className="mx-4 mb-4">
          <div style={{ borderRadius: 16, padding: "14px 16px", background: "linear-gradient(135deg,rgba(255,107,138,0.06),rgba(155,89,182,0.06))", border: "1px solid rgba(255,107,138,0.15)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#9B59B6", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>💡 About My Circle</p>
            <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>
              Everyone you've sent or received cards from. Green dot = on SayIt. <strong>New</strong> badge = they sent first — reply to connect or use the shield icon to block.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
