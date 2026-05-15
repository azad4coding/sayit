"use client";
// Intermediate OAuth callback page — runs inside SFSafariViewController / Chrome Custom Tab.
// Supabase redirects here after Google auth (HTTPS URL, always in allowed list).
// This page reads the PKCE code and forwards it to the app via the custom URL scheme,
// which iOS/Android intercept as a deep link → fires appUrlOpen → exchangeCodeForSession.
import { useEffect, useState } from "react";

export default function AuthCallbackPage() {
  const [deepLink, setDeepLink] = useState<string>("");
  const [status, setStatus] = useState("Completing sign in…");

  useEffect(() => {
    const url = new URL(window.location.href);
    const code  = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      // OAuth failed — redirect to login with error info
      setStatus("Sign in failed. Redirecting…");
      setTimeout(() => {
        window.location.href = `/login?error=${encodeURIComponent(error)}`;
      }, 500);
      return;
    }

    if (code) {
      // Hand the PKCE code to the native app via custom URL scheme.
      // iOS/Android intercept com.azad.sayit:// and fire appUrlOpen.
      // Do NOT re-encode — the code is already URL-safe from Supabase.
      const link = `com.azad.sayit://home?code=${code}`;
      setDeepLink(link);
      setStatus("Opening SayIt…");

      // Primary: assign location directly
      window.location.href = link;

      // Secondary: create a hidden anchor and click it (works better on some iOS versions)
      const a = document.createElement("a");
      a.href = link;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); }, 500);
    } else {
      // No code and no error — redirect to login
      setStatus("No auth code received. Redirecting…");
      setTimeout(() => { window.location.href = "/login"; }, 500);
    }
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100dvh",
      background: "linear-gradient(160deg,#FFF5F7,#F8F0FF)",
      fontFamily: "sans-serif", gap: 20, padding: 24,
    }}>
      {/* Spinner */}
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        border: "4px solid #f9a8d4", borderTopColor: "#FF6B8A",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <p style={{ color: "#9B59B6", fontSize: 15, margin: 0 }}>{status}</p>

      {/* Fallback button — visible after 2 s if the redirect hasn't fired */}
      {deepLink && (
        <a href={deepLink} style={{
          marginTop: 8, padding: "12px 28px", borderRadius: 14,
          background: "linear-gradient(135deg,#FF6B8A,#9B59B6)",
          color: "white", fontWeight: 700, fontSize: 14,
          textDecoration: "none", display: "block", textAlign: "center",
          opacity: 0, animation: "fadeIn 0.3s ease 2s forwards",
        }}>
          Tap here to open SayIt →
        </a>
      )}
      <style>{`@keyframes fadeIn { to { opacity: 1; } }`}</style>
    </div>
  );
}
