"use client";

import { useEffect, useLayoutEffect, useState, useRef } from "react";
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

// Which routes get a compact sticky title bar (matches the gradient hero title)
const PAGE_TITLES: Record<string, string> = {
  "/wishes":  "Wishes",
  "/history": "Chats",
  "/circle":  "My Circle",
  "/profile": "Profile",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [checking,      setChecking]      = useState(true);
  const [reactionDot,   setReactionDot]   = useState(0);
  const [incomingDot,   setIncomingDot]   = useState(0);
  const [wishesDot,     setWishesDot]     = useState(0);
  const [showTitleBar,  setShowTitleBar]  = useState(false);
  const sentCardIds = useRef<Set<string>>(new Set());
  const userIdRef   = useRef<string | null>(null);

  // ── Capacitor: init status bar + force-reload if stale cache ────────────
  useEffect(() => {
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        // Transparent status bar so gradient fills behind it
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Light });

        // Cache-bust: fetch /api/version (a lightweight endpoint that always
        // returns the current deployment ID). If localStorage shows we've
        // already loaded this version, skip. If it's new, reload once to
        // flush any stale JS bundles the WebView may have cached.
        try {
          const res = await fetch("/api/version", { cache: "no-store" });
          if (res.ok) {
            const { v } = await res.json();
            const stored = localStorage.getItem("sayit_v");
            if (stored && stored !== v) {
              localStorage.setItem("sayit_v", v);
              window.location.reload();
              return;
            }
            localStorage.setItem("sayit_v", v);
          }
        } catch { /* offline — skip version check */ }
      } catch { /* not in Capacitor context */ }
    })();
  }, []);

  // ── Scroll listener on main — lives HERE, not inside each page ───────────
  // KEY: the sticky title bar is rendered as a sibling of <main> in this
  // layout, NOT inside <main>. On iOS WebKit, position:fixed children of an
  // overflow:scroll container are trapped and positioned relative to that
  // container (not the viewport), so putting the bar inside <main> made it
  // cover the gradient hero instead of floating above it.
  useEffect(() => {
    if (checking) return;
    const main = document.querySelector("main") as HTMLElement | null;
    if (!main) return;
    const handler = () => setShowTitleBar(main.scrollTop > 80);
    main.addEventListener("scroll", handler, { passive: true });
    return () => main.removeEventListener("scroll", handler);
  }, [checking]);

  // ── Reset bar BEFORE paint (useLayoutEffect) so there's never a flash ────
  // useEffect runs after the browser paints, which can briefly show a stale
  // showTitleBar=true from the previous page. useLayoutEffect runs before
  // paint, ensuring the bar is hidden on the very first frame of any new page.
  useLayoutEffect(() => {
    setShowTitleBar(false);
  }, [pathname]);

  // ── Reset scroll on every route change ───────────────────────────────────
  // The overflow toggle kills iOS WebKit momentum scroll before resetting.
  // Without it, momentum can fire extra scroll events after scrollTop=0,
  // setting showTitleBar back to true.
  useEffect(() => {
    const main = document.querySelector("main") as HTMLElement | null;
    if (!main) return;
    // Kill iOS momentum scroll, then reset position
    main.style.overflowY = "hidden";
    main.scrollTop = 0;
    main.style.overflowY = "";
  }, [pathname]);

  // ── Register service worker + subscribe to push ─────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    async function setupPush() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const existing = await reg.pushManager.getSubscription();
        const subscription = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });
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

      const { data: sent } = await supabase
        .from("sent_cards")
        .select("id")
        .eq("sender_id", user.id);
      sentCardIds.current = new Set((sent ?? []).map((c: { id: string }) => c.id));

      const lastSeenChats = (() => {
        try { return localStorage.getItem(`lastSeenChats_${user.id}`) ?? new Date(0).toISOString(); }
        catch { return new Date(0).toISOString(); }
      })();
      const { count: unreadCount } = await supabase
        .from("sent_cards")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .gt("created_at", lastSeenChats);
      if ((unreadCount ?? 0) > 0 && pathname !== "/history") setIncomingDot(unreadCount ?? 0);

      const lastSeenWishes = (() => {
        try { return localStorage.getItem(`lastSeenWishes_${user.id}`) ?? new Date(0).toISOString(); }
        catch { return new Date(0).toISOString(); }
      })();
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
      if (wishesTotal > 0 && pathname !== "/wishes") setWishesDot(wishesTotal);

      const channel = supabase
        .channel("layout-notifications")
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

  const barTitle = PAGE_TITLES[pathname] ?? "";

  return (
    <>
      {/* ── Safe area spacer (transparent — gradient headers fill behind status bar) ── */}
      <div className="safe-area-top" style={{ background: "transparent" }} />

      {/* ── Compact sticky title bar ── */}
      {/* Conditionally rendered — only mounts when scrolled past 80px.   */}
      {/* Using React conditional render (not CSS opacity/visibility) so  */}
      {/* the element literally does not exist in the DOM at scroll=0.    */}
      {/* This is bulletproof: no CSS trick can make a non-existent node  */}
      {/* visible on any browser or platform.                             */}
      {barTitle && showTitleBar && (
        <div className="sticky-title-bar">
          <span style={{ fontSize: 16, fontWeight: 700, color: "#111827", letterSpacing: "-0.2px" }}>
            {barTitle}
          </span>
        </div>
      )}

      <main className="page-content">{children}</main>

      {/* ── Bottom Navigation ── */}
      <nav className="bottom-nav" style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(0,0,0,0.07)" }}>
        <div className="flex items-center px-4">
          {NAV.map(({ href, label, Icon }) => {
            const active   = pathname === href;
            const totalDot = href === "/history" ? (reactionDot + incomingDot)
                           : href === "/wishes"  ? wishesDot
                           : 0;
            const showDot  = totalDot > 0;
            return (
              <Link key={href} href={href} className="flex-1 flex flex-col items-center py-3 gap-1 relative">
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
