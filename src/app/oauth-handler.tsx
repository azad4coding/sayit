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
          await Browser.close().catch(() => {});
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (!error) router.replace("/home");
        });
        cleanup = () => handle.remove();
      } catch { /* not in a Capacitor context */ }
    })();
    return () => cleanup?.();
  }, []);

  return null; // renders nothing — side-effect only
}
