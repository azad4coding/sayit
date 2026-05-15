"use client";
// Handles the Capacitor deep-link callback for Google OAuth on iOS and Android.
// Mounted in the ROOT layout so it is always active — even on the login page —
// which is critical because the user starts on (auth)/login, not (app)/layout.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export function OAuthCallbackHandler() {
  const router  = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const { App: CapApp } = await import("@capacitor/app");
        const { Browser }     = await import("@capacitor/browser");

        const handle = await CapApp.addListener("appUrlOpen", async ({ url }) => {
          if (!url.startsWith("com.azad.sayit://")) return;
          console.log("[SayIt OAuth] appUrlOpen fired:", url.slice(0, 80));
          await Browser.close().catch(() => {});

          const codeMatch = url.match(/[?&]code=([^&]+)/);
          const code = codeMatch ? decodeURIComponent(codeMatch[1]) : null;
          console.log("[SayIt OAuth] code extracted:", code ? "YES (" + code.slice(0, 8) + "...)" : "NO");

          if (!code) {
            window.location.href = "/login";
            return;
          }

          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          console.log("[SayIt OAuth] exchangeCodeForSession:", error ? "ERROR: " + error.message : "OK, user=" + data?.user?.email);

          if (!error) {
            router.replace("/home");
          } else {
            // Show error so we can debug
            alert("[SayIt OAuth] Exchange failed: " + error.message);
          }
        });
        cleanup = () => handle.remove();
      } catch { /* not in a Capacitor context */ }
    })();
    return () => cleanup?.();
  }, []);

  return null; // renders nothing — side-effect only
}
