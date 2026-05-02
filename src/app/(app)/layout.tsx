"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Home, Heart, MessageSquare, User, Gift } from "lucide-react";

const NAV = [
  { href: "/home",        label: "Home",       Icon: Home          },
  { href: "/wishes",      label: "Wishes",     Icon: Heart         },
  { href: "/history",     label: "Chats",      Icon: MessageSquare },
  { href: "/gift-cards",  label: "Gift Cards", Icon: Gift          },
  { href: "/profile",     label: "Profile",    Icon: User          },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [checking,    setChecking]    = useState(true);
  const [reactionDot, setReactionDot] = useState(0);
  const sentCardIds = useRef<Set<string>>(new Set());
  const userIdRef   = useRef<string | null>(null);

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      userIdRef.current = user.id;

      // If user has no phone on their auth account, check profiles table
      if (!user.phone && pathname !== "/add-phone") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", user.id)
          .single();
        if (!profile?.phone) {
          router.replace(`/add-phone?next=${encodeURIComponent(pathname)}`);
          return;
        }
      }

      setChecking(false);

      // ── Load sent card IDs for reaction filtering ───────────────────────
      const { data: sent } = await supabase
        .from("sent_cards")
        .select("id")
        .eq("sender_id", user.id);
      sentCardIds.current = new Set((sent ?? []).map((c: { id: string }) => c.id));

      // ── Real-time subscriptions ─────────────────────────────────────────
      const channel = supabase
        .channel("layout-notifications")

        // 1. New reaction on a card the user sent → Chats dot
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "card_reactions" },
          (payload) => {
            const cardId = (payload.new as { card_id: string }).card_id;
            if (sentCardIds.current.has(cardId)) {
              setReactionDot(prev => prev + 1);
            }
          }
        )

        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
    check();
  }, [pathname]);

  // Clear dot when user visits Chats
  useEffect(() => {
    if (pathname === "/history") setReactionDot(0);
  }, [pathname]);

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: "linear-gradient(160deg,#FFF5F7,#F8F0FF)" }}>
        <div className="w-10 h-10 rounded-full border-4 border-pink-200 border-t-pink-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <main className="page-content">{children}</main>

      {/* ── Bottom Navigation ── */}
      <nav className="bottom-nav" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 -8px 32px rgba(0,0,0,0.08)" }}>
        <div className="flex items-center px-4">
          {NAV.map(({ href, label, Icon }) => {
            const active    = pathname === href;
            const showDot  = href === "/history" && reactionDot > 0;
            const dotCount = reactionDot;
            return (
              <Link key={href} href={href} className="flex-1 flex flex-col items-center py-3 gap-1 relative">
                {/* Active pill indicator */}
                {active && (
                  <span className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-2xl"
                    style={{ background: "linear-gradient(135deg,#FF6B8A22,#9B59B622)" }} />
                )}
                <div className="relative z-10">
                  <Icon
                    className="w-5 h-5 transition-all"
                    style={{ color: active ? "#9B59B6" : "#c0c0c0" }}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  {/* Notification dot */}
                  {showDot && (
                    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1"
                      style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                      {dotCount > 9 ? "9+" : dotCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold transition-colors relative z-10"
                  style={{ color: active ? "#9B59B6" : "#c0c0c0", letterSpacing: "0.3px" }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
