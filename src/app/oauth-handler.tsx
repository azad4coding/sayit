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

          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            console.log("[SayIt OAuth] exchangeCodeForSession:", error ? "ERROR: " + error.message : "OK, user=" + data?.user?.email);

            if (!error) {
              // Use a full page reload so Supabase re-reads the persisted session
              // from storage on the new page — avoids any React Router / INITIAL_SESSION
              // race where the in-memory session isn't picked up by (app)/layout's check().
              console.log("[SayIt OAuth] navigating to /home via full reload");
              window.location.href = "/home";
            } else {
              console.error("[SayIt OAuth] Exchange failed:", error.message);
              // Use a generic error code — never reflect raw internal error messages
              // into the URL (avoids accidental PII exposure or reflected-XSS risk).
              window.location.href = "/login?oauthError=1";
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[SayIt OAuth] exchangeCodeForSession threw:", msg);
            window.location.href = "/login?oauthError=1";
          }
        });
        cleanup = () => handle.remove();
      } catch { /* not in a Capacitor context */ }
    })();
    return () => cleanup?.();
  }, []);

  return null; // renders nothing — side-effect only
}
