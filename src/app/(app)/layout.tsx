"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { Home, Heart, MessageSquare, User, Users, Gift } from "lucide-react";

const NAV = [
  { href: "/home",       label: "Home",       Icon: Home          },
  { href: "/wishes",     label: "Wishes",     Icon: Heart         },
  { href: "/history",    label: "Chats",      Icon: MessageSquare },
  { href: "/gift-cards", label: "Gifts",      Icon: Gift          },
  { href: "/circle",     label: "Circle",     Icon: Users         },
  { href: "/profile",    label: "Profile",    Icon: User          },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [checking,     setChecking]     = useState(true);
  const [reactionDot,  setReactionDot]  = useState(0);
  const [incomingDot,  setIncomingDot]  = useState(0);
  const [wishesDot,    setWishesDot]    = useState(0);
  const sentCardIds = useRef<Set<string>>(new Set());
  const userIdRef   = useRef<string | null>(null);

  // ── Register service worker + subscribe to push ─────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    async function setupPush() {
      try {
        // Register SW
        const reg = await navigator.serviceWorker.register("/sw.js");

        // Ask permission (browser shows native dialog once)
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Subscribe to push
        const existing = await reg.pushManager.getSubscription();
        const subscription = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });

        // Save subscription to DB
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription, userId: user.id }),
        });
      } catch { /* push not supported or blocked */ }
    }

    setupPush();
  }, []);

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

      // ── Load unread incoming cards since last Chats visit ───────────────
      const lastSeenChats = (() => {
        try { return localStorage.getItem(`lastSeenChats_${user.id}`) ?? new Date(0).toISOString(); }
        catch { return new Date(0).toISOString(); }
      })();
      const { count: unreadCount } = await supabase
        .from("sent_cards")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .gt("created_at", lastSeenChats);
      // Don't set dot if user is already on the history/chats page
      if ((unreadCount ?? 0) > 0 && pathname !== "/history") setIncomingDot(unreadCount ?? 0);

      // ── Load unread wishes activity since last Wishes visit ─────────────
      const lastSeenWishes = (() => {
        try { return localStorage.getItem(`lastSeenWishes_${user.id}`) ?? new Date(0).toISOString(); }
        catch { return new Date(0).toISOString(); }
      })();
      // Count new received cards + new reactions on sent cards
      const authPhone2 = user.phone ?? null;
      const { data: profData2 } = await supabase.from("profiles").select("phone").eq("id", user.id).single();
      const myPhone2 = profData2?.phone ?? authPhone2;
      let newRecvQ = supabase.from("sent_cards").select("id", { count: "exact", head: true })
        .gt("created_at", lastSeenWishes).neq("sender_id", user.id);
      if (myPhone2) {
        const wp = myPhone2.startsWith("+") ? myPhone2 : `+${myPhone2}`;
        const wop = myPhone2.startsWith("+") ? myPhone2.slice(1) : myPhone2;
        newRecvQ = newRecvQ.or(`recipient_id.eq.${user.id},recipient_phone.eq.${wp},recipient_phone.eq.${wop}`);
      } else {
        newRecvQ = newRecvQ.eq("recipient_id", user.id);
      }
      const { count: newRecvCount } = await newRecvQ;
      const { count: newRxCount } = await supabase.from("card_reactions")
        .select("id", { count: "exact", head: true })
        .in("card_id", Array.from(sentCardIds.current))
        .gt("created_at", lastSeenWishes);
      const wishesTotal = (newRecvCount ?? 0) + (newRxCount ?? 0);
      // Don't set dot if user is already on the wishes page
      if (wishesTotal > 0 && pathname !== "/wishes") setWishesDot(wishesTotal);

      // ── Real-time subscriptions ─────────────────────────────────────────
      const channel = supabase
        .channel("layout-notifications")

        // 1. New reaction on a card the user sent → Chats + Wishes dot
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "card_reactions" },
          (payload) => {
            const cardId = (payload.new as { card_id: string }).card_id;
            if (sentCardIds.current.has(cardId)) {
              setReactionDot(prev => prev + 1);
              setWishesDot(prev => prev + 1);
            }
          }
        )

        // 2. New card sent directly to this user → Chats + Wishes dot
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "sent_cards",
            filter: `recipient_id=eq.${user.id}` },
          () => {
            setIncomingDot(prev => prev + 1);
            setWishesDot(prev => prev + 1);
          }
        )

        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
    check();
  }, [pathname]);

  // Clear dots and persist last-seen timestamps
  useEffect(() => {
    if (pathname === "/history") {
      setReactionDot(0);
      setIncomingDot(0);
      try {
        if (userIdRef.current) {
          localStorage.setItem(`lastSeenChats_${userIdRef.current}`, new Date().toISOString());
        }
      } catch { /* ignore */ }
    }
    if (pathname === "/wishes") {
      setWishesDot(0);
      try {
        if (userIdRef.current) {
          localStorage.setItem(`lastSeenWishes_${userIdRef.current}`, new Date().toISOString());
        }
      } catch { /* ignore */ }
    }
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
            const totalDot  = href === "/history" ? (reactionDot + incomingDot)
                            : href === "/wishes"  ? wishesDot
                            : 0;
            const showDot   = totalDot > 0;
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
                  {/* Red notification badge */}
                  {showDot && (
                    <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1 shadow-sm"
                      style={{ background: "#E53935", boxShadow: "0 1px 4px rgba(229,57,53,0.5)" }}>
                      {totalDot > 99 ? "99+" : totalDot}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-bold transition-colors relative z-10"
                  style={{ color: active ? "#9B59B6" : "#c0c0c0", letterSpacing: "0.2px" }}>
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
