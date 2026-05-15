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

          // Extract the PKCE code with regex — avoids URL parsing issues
          // with custom schemes (new URL("com.azad.sayit://...") can throw).
          const codeMatch = url.match(/[?&]code=([^&]+)/);
          const code = codeMatch ? decodeURIComponent(codeMatch[1]) : null;

          if (!code) {
            // No code in URL — might be an error redirect or unexpected format
            window.location.href = "/login";
            return;
          }

          // Exchange just the code string (not the full URL) — more reliable
          // across Supabase client versions and custom URL schemes.
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            // Short delay: lets nativeStorage async write complete before
            // the reload triggers (app)/layout.tsx INITIAL_SESSION check.
            await new Promise(r => setTimeout(r, 400));
            window.location.href = "/home";
          } else {
            // Exchange failed — send back to login so user can try again
            window.location.href = "/login";
          }
        });
        cleanup = () => handle.remove();
      } catch { /* not in a Capacitor context */ }
    })();
    return () => cleanup?.();
  }, []);

  return null; // renders nothing — side-effect only
}
