"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Trash2, Send, Users } from "lucide-react";

interface CircleMember {
  id:              string;
  sender_id:       string;
  sender_name:     string | null;
  sender_phone:    string | null;
  recipient_phone: string;
  recipient_name:  string | null;
  recipient_id:    string | null;
  status:          string;
}

export default function CirclePage() {
  const router   = useRouter();
  const supabase = createClient();

  const [loading,       setLoading]       = useState(true);
  const [userId,        setUserId]        = useState("");
  const [circleMembers, setCircleMembers] = useState<CircleMember[]>([]);

  const accent = "#FF6B8A";
  const purple = "#9B59B6";

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);

      const { data: accepted, error: circleErr } = await supabase
        .from("circles")
        .select("*")
        .eq("status", "accepted")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`);

      if (!circleErr && accepted && accepted.length > 0) {
        const outgoingPhones = accepted
          .filter((c: any) => c.sender_id === user.id)
          .map((c: any) => c.recipient_phone as string);

        let nameMap: Record<string, string> = {};
        if (outgoingPhones.length > 0) {
          const { data: cards } = await supabase
            .from("sent_cards")
            .select("recipient_phone, recipient_name")
            .eq("sender_id", user.id)
            .in("recipient_phone", outgoingPhones)
            .not("recipient_name", "is", null);
          for (const card of (cards ?? [])) {
            if (card.recipient_name && !nameMap[card.recipient_phone]) {
              nameMap[card.recipient_phone] = card.recipient_name;
            }
          }
        }

        const enriched = accepted.map((c: any) => ({
          ...c,
          recipient_name: c.sender_id === user.id
            ? (c.recipient_name ?? nameMap[c.recipient_phone] ?? null)
            : null,
        }));
        setCircleMembers(enriched as CircleMember[]);
      } else {
        setCircleMembers([]);
      }

      setLoading(false);
    }
    load();
  }, []);

  async function removeFromCircle(circleId: string) {
    await supabase.from("circles").delete().eq("id", circleId);
    setCircleMembers(prev => prev.filter(c => c.id !== circleId));
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
            <p className="text-xs text-gray-400">{circleMembers.length} connected</p>
          </div>
        </div>
      </div>

      {/* ── Circle members list ── */}
      <div className="mx-5 mb-5">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
          {circleMembers.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3 px-8">
              <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-3xl"
                style={{ background: "linear-gradient(135deg,#FFF5F7,#F8F0FF)" }}>💫</div>
              <p className="text-sm font-semibold text-gray-500 text-center">Your Circle is empty</p>
              <p className="text-xs text-gray-400 text-center">
                Your Circle grows every time you send a card and someone joins SayIt. Start sending!
              </p>
              <button
                onClick={() => router.push("/home")}
                className="mt-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white shadow-md"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                Send a Card
              </button>
            </div>
          ) : (
            <>
              {circleMembers.map((c, i) => {
                const isOutgoing = c.sender_id === userId;
                const displayName = isOutgoing
                  ? (c.recipient_name ?? c.recipient_phone)
                  : (c.sender_name ?? c.sender_phone ?? "SayIt User");
                const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
                return (
                  <div key={c.id}
                    className={`flex items-center gap-3 px-4 py-4 ${i < circleMembers.length - 1 ? "border-b border-gray-50" : ""}`}>
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#FF6B8A22,#9B59B622)", color: purple }}>
                      {initials}
                    </div>

                    {/* Name & status */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <p className="text-[11px] text-green-500 font-semibold">In your Circle</p>
                      </div>
                    </div>

                    {/* Send card shortcut */}
                    <button
                      onClick={() => router.push("/home")}
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mr-1"
                      style={{ background: `${accent}15` }}>
                      <Send className="w-3.5 h-3.5" style={{ color: accent }} />
                    </button>

                    {/* Remove */}
                    <button
                      onClick={() => removeFromCircle(c.id)}
                      className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5 text-gray-300" />
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Info card ── */}
      <div className="mx-5">
        <div className="rounded-2xl px-4 py-4"
          style={{ background: "linear-gradient(135deg,#FF6B8A0D,#9B59B60D)", border: "1px solid #FF6B8A20" }}>
          <p className="text-xs font-semibold text-gray-500 mb-1">What is My Circle?</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Your Circle includes everyone you've connected with on SayIt — people you've sent cards to and who have joined the app. It makes sending future cards faster and more personal.
          </p>
        </div>
      </div>

    </div>
  );
}
