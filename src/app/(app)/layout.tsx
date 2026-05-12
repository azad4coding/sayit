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

  const [checking,    setChecking]    = useState(true);
  const [reactionDot, setReactionDot] = useState(0);
  const [incomingDot, setIncomingDot] = useState(0);
  const [wishesDot,   setWishesDot]   = useState(0);

  // ── Title bar visibility ──────────────────────────────────────────────────
  // Simple boolean state — shown only when user has scrolled > 80px.
  //
  // Root-cause of the persistent bug: pathnameRef.current updated during the
  // React render phase (sync), but main.scrollTop = 0 runs in a useEffect
  // (after paint). In that gap, iOS momentum scroll or layout-triggered scroll
  // events fire with NEW pathname + OLD scrollTop → showTitleBar becomes true
  // on the freshly-loaded page before the reset even runs.
  //
  // Fix: timestamp cooldown. Record the time of every navigation. The scroll
  // handler ignores ALL events within 500 ms of a nav — long enough to outlast
  // momentum scroll decay, layout shifts, and the React effect scheduling gap.
  const [showTitleBar,  setShowTitleBar]  = useState(false);
  const lastNavTimeRef  = useRef(0);

  const sentCardIds = useRef<Set<string>>(new Set());
  const userIdRef   = useRef<string | null>(null);

  // ── Auth session gate ─────────────────────────────────────────────────────
  // On native iOS, @capacitor/preferences is async. Supabase fires
  // INITIAL_SESSION only after storage has been fully read — this is the
  // earliest safe point to make auth decisions. We resolve a Promise with
  // the session so the check() function can await it regardless of timing.
  const initialSessionPromise = useRef<Promise<any> | null>(null);
  const resolveInitialSession = useRef<((s: any) => void) | null>(null);

  if (!initialSessionPromise.current) {
    initialSessionPromise.current = new Promise(resolve => {
      resolveInitialSession.current = resolve;
    });
  }


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

  // ── Wait for auth session to hydrate from async storage ─────────────────
  // onAuthStateChange fires INITIAL_SESSION only after @capacitor/preferences
  // has finished its async read. We resolve the promise above with the session
  // so check() can await it safely, no matter how slow preferences.get() is.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        resolveInitialSession.current?.(session);
      } else if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Scroll listener ───────────────────────────────────────────────────────
  // Listens on WINDOW because we now use document-level scroll (the only
  // pattern that works in Capacitor remote-URL WKWebView). All previous
  // attempts to scroll inside a CSS overflow container failed — WKWebView
  // does not reliably treat flex/absolute children as scroll containers.
  useEffect(() => {
    if (checking) return;
    const handler = () => {
      if (Date.now() - lastNavTimeRef.current < 500) return; // cooldown
      setShowTitleBar(window.scrollY > 80);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [checking]);

  // ── Reset scroll + hide title bar on every route change ──────────────────
  useEffect(() => {
    lastNavTimeRef.current = Date.now();
    setShowTitleBar(false);
    window.scrollTo(0, 0);
    // One RAF pass to squash any late momentum-scroll (iOS WebKit).
    const raf = requestAnimationFrame(() => { window.scrollTo(0, 0); });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  // ── OneSignal push notifications (native iOS + Android) ──────────────────
  // OneSignal is initialised natively in AppDelegate.swift / MainActivity.java.
  // Here we link the logged-in user's Supabase UUID as the OneSignal external_id
  // so the server can target them by user ID when sending pushes.
  useEffect(() => {
    async function linkOneSignalUser() {
      try {
        const { Capacitor, registerPlugin } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prefsAvailable = !!(window as any).Capacitor?.Plugins?.Preferences;
        console.log("[OneSignal] Capacitor.Plugins.Preferences available:", prefsAvailable);

        const { data: { user } } = await supabase.auth.getUser();
        console.log("[OneSignal] current user:", user?.id ?? "none");
        if (!user) return;

        // registerPlugin creates a typed bridge to our native OneSignalPlugin
        const OneSignalPlugin = registerPlugin<{ login: (opts: { userId: string }) => Promise<void> }>("OneSignalPlugin");
        await OneSignalPlugin.login({ userId: user.id });
        console.log("[OneSignal] linked userId:", user.id);
      } catch (err) {
        console.warn("[OneSignal] user link skipped:", err);
      }
    }

    linkOneSignalUser();
  }, []);

  useEffect(() => {
    async function check() {
      // Await INITIAL_SESSION — guarantees @capacitor/preferences has resolved.
      // On web this fires almost instantly; on native it waits for storage I/O.
      const session = await initialSessionPromise.current;
      if (!session) { router.replace("/login"); return; }
      // Server-validate the token (catches expired/revoked sessions)
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

      {/* Push permission is requested by OneSignal natively — no banner needed */}

      <main className="page-content">{children}</main>

      {/* ── Bottom Navigation ── */}
      <nav className="bottom-nav">
        <div className="flex items-center px-2">
          {NAV.map(({ href, label, Icon }) => {
            const active   = pathname === href;
            const totalDot = href === "/history" ? (reactionDot + incomingDot)
                           : href === "/wishes"  ? wishesDot
                           : 0;
            const showDot  = totalDot > 0;
            return (
              <Link key={href} href={href} className="flex-1 flex flex-col items-center py-1.5 gap-0.5 relative">
                {active && (
                  <span className="absolute top-1.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-2xl"
                    style={{ background: "linear-gradient(135deg,#FF6B8A22,#9B59B622)" }} />
                )}
                <div className="relative z-10">
                  <Icon
                    className="w-[18px] h-[18px] transition-all"
                    style={{ color: active ? "#9B59B6" : "#b0b0b0" }}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  {showDot && (
                    <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] rounded-full flex items-center justify-center text-[8px] font-bold text-white px-0.5 shadow-sm"
                      style={{ background: "#E53935", boxShadow: "0 1px 4px rgba(229,57,53,0.5)" }}>
                      {totalDot > 99 ? "99+" : totalDot}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-semibold transition-colors relative z-10"
                  style={{ color: active ? "#9B59B6" : "#b0b0b0", letterSpacing: "0.1px" }}>
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
