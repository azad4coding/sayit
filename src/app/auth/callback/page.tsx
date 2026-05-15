"use client";
// Intermediate OAuth callback page — runs inside SFSafariViewController / Chrome Custom Tab.
// Supabase redirects here after Google auth (HTTPS URL, always in allowed list).
// This page reads the PKCE code and forwards it to the app via the custom URL scheme,
// which iOS/Android intercept as a deep link → fires appUrlOpen → exchangeCodeForSession.
import { useEffect } from "react";

export default function AuthCallbackPage() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code  = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      // OAuth failed — redirect to login with error info
      window.location.href = `/login?error=${encodeURIComponent(error)}`;
      return;
    }

    if (code) {
      // Hand the PKCE code to the native app via custom URL scheme.
      // iOS/Android intercept com.azad.sayit:// and fire appUrlOpen.
      window.location.href = `com.azad.sayit://home?code=${encodeURIComponent(code)}`;
    } else {
      // No code and no error — redirect to login
      window.location.href = "/login";
    }
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh", background: "linear-gradient(160deg,#FFF5F7,#F8F0FF)" }}>
      <p style={{ color: "#9B59B6", fontFamily: "sans-serif", fontSize: 15 }}>Completing sign in…</p>
    </div>
  );
}
