"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { ChevronDown, Search } from "lucide-react";
import { normalizePhone } from "@/lib/phone";
import { requestContactsPermission } from "@/lib/contacts";

// ── Country codes ─────────────────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+1",   flag: "🇺🇸", name: "US / Canada" },
  { code: "+44",  flag: "🇬🇧", name: "UK" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+65",  flag: "🇸🇬", name: "Singapore" },
  { code: "+61",  flag: "🇦🇺", name: "Australia" },
  { code: "+49",  flag: "🇩🇪", name: "Germany" },
  { code: "+33",  flag: "🇫🇷", name: "France" },
  { code: "+39",  flag: "🇮🇹", name: "Italy" },
  { code: "+34",  flag: "🇪🇸", name: "Spain" },
  { code: "+55",  flag: "🇧🇷", name: "Brazil" },
  { code: "+52",  flag: "🇲🇽", name: "Mexico" },
  { code: "+81",  flag: "🇯🇵", name: "Japan" },
  { code: "+82",  flag: "🇰🇷", name: "South Korea" },
  { code: "+86",  flag: "🇨🇳", name: "China" },
  { code: "+92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+94",  flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+977", flag: "🇳🇵", name: "Nepal" },
  { code: "+60",  flag: "🇲🇾", name: "Malaysia" },
  { code: "+63",  flag: "🇵🇭", name: "Philippines" },
  { code: "+62",  flag: "🇮🇩", name: "Indonesia" },
  { code: "+66",  flag: "🇹🇭", name: "Thailand" },
  { code: "+84",  flag: "🇻🇳", name: "Vietnam" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+974", flag: "🇶🇦", name: "Qatar" },
  { code: "+965", flag: "🇰🇼", name: "Kuwait" },
  { code: "+973", flag: "🇧🇭", name: "Bahrain" },
  { code: "+968", flag: "🇴🇲", name: "Oman" },
  { code: "+20",  flag: "🇪🇬", name: "Egypt" },
  { code: "+27",  flag: "🇿🇦", name: "South Africa" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+7",   flag: "🇷🇺", name: "Russia" },
  { code: "+31",  flag: "🇳🇱", name: "Netherlands" },
  { code: "+41",  flag: "🇨🇭", name: "Switzerland" },
  { code: "+46",  flag: "🇸🇪", name: "Sweden" },
  { code: "+47",  flag: "🇳🇴", name: "Norway" },
  { code: "+45",  flag: "🇩🇰", name: "Denmark" },
  { code: "+358", flag: "🇫🇮", name: "Finland" },
  { code: "+48",  flag: "🇵🇱", name: "Poland" },
  { code: "+64",  flag: "🇳🇿", name: "New Zealand" },
  { code: "+54",  flag: "🇦🇷", name: "Argentina" },
  { code: "+56",  flag: "🇨🇱", name: "Chile" },
  { code: "+57",  flag: "🇨🇴", name: "Colombia" },
  { code: "+90",  flag: "🇹🇷", name: "Turkey" },
  { code: "+93",  flag: "🇦🇫", name: "Afghanistan" },
];

// ── 6-box OTP input ───────────────────────────────────────────────────────────
function OtpBoxes({
  value, onChange, accent = "#FF6B8A",
}: {
  value: string[]; onChange: (v: string[]) => void; accent?: string;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(i: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...value]; next[i] = digit;
    onChange(next);
    if (digit && i < 5) inputRefs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = ["", "", "", "", "", ""];
    digits.split("").forEach((d, i) => { next[i] = d; });
    onChange(next);
    inputRefs.current[Math.min(digits.length, 5)]?.focus();
  }

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {value.map((digit, i) => (
        <input
          key={i}
          ref={el => { inputRefs.current[i] = el; }}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          style={{
            width: 44, height: 52, borderRadius: 12, textAlign: "center",
            fontSize: 22, fontWeight: 700, color: "#333",
            border: digit ? `2.5px solid ${accent}` : "2px solid #e5e7eb",
            background: digit ? `${accent}0D` : "white",
            outline: "none", transition: "all 0.15s",
          }}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function RegisterInner() {
  const router   = useRouter();
  const params   = useSearchParams();
  const supabase = createClient();

  const cardCode   = params.get("card") ?? "";
  const senderName = params.get("sender") ?? "";

  function getPendingCard(): { code: string; senderName: string } | null {
    try { const r = sessionStorage.getItem("sayit_pending_card"); return r ? JSON.parse(r) : null; } catch { return null; }
  }
  function redirectAfterAuth() {
    const pending = getPendingCard();
    const code = cardCode || pending?.code;
    if (code) { try { sessionStorage.removeItem("sayit_pending_card"); } catch {} router.push(`/preview/${code}`); }
    else router.push("/home");
  }

  const fromCard      = !!cardCode || !!getPendingCard()?.code;
  const displaySender = senderName || getPendingCard()?.senderName || "";

  // ── Phone state ───────────────────────────────────────────────
  const [phoneStep,      setPhoneStep]      = useState<"details" | "otp">("details");
  const [countryCode,    setCountryCode]    = useState("+91");
  const [showCCDropdown, setShowCCDropdown] = useState(false);
  const [ccQuery,        setCcQuery]        = useState("");
  const [phoneNumber,    setPhoneNumber]    = useState("");
  const [otp,            setOtp]            = useState(["", "", "", "", "", ""]);
  const [resendSecs,     setResendSecs]     = useState(0);

  // ── Shared ────────────────────────────────────────────────────
  const [name,    setName]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const accent = "#FF6B8A";

  // Resend countdown
  useEffect(() => {
    if (resendSecs <= 0) return;
    const t = setTimeout(() => setResendSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSecs]);

  // ── Phone: send OTP ───────────────────────────────────────────
  async function sendOtp() {
    if (!name.trim()) { setError("Please enter your name"); return; }
    const fullPhone = normalizePhone(countryCode, phoneNumber);
    if (!fullPhone) { setError("Please enter a valid phone number"); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setPhoneStep("otp");
    setResendSecs(60);
  }

  // ── Phone: verify OTP + create profile ───────────────────────
  async function verifyOtp() {
    const token = otp.join("");
    if (token.length !== 6) { setError("Please enter the 6-digit code"); return; }
    const fullPhone = normalizePhone(countryCode, phoneNumber);
    if (!fullPhone) { setError("Invalid phone number — please go back and re-enter"); return; }
    setLoading(true); setError("");
    const { data, error } = await supabase.auth.verifyOtp({ phone: fullPhone, token, type: "sms" });
    if (error) { setError(error.message); setLoading(false); return; }

    // Save name + phone to profile
    if (data.user) {
      // updateUser first so the trigger (if any) fires before our write
      await supabase.auth.updateUser({ data: { full_name: name.trim() } });

      // Upsert profile — explicit onConflict ensures UPDATE path always runs
      const { error: upsertErr } = await supabase.from("profiles").upsert(
        { id: data.user.id, full_name: name.trim(), phone: fullPhone },
        { onConflict: "id" },
      );
      if (upsertErr) console.error("[register] profiles upsert failed:", upsertErr.message);

      // Resolve any pending My Circle requests for this phone number
      await fetch("/api/circle/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id, phone: fullPhone }),
      });
    }
    // Request contacts permission right after account creation — standard app UX
    await requestContactsPermission();

    setLoading(false);
    redirectAfterAuth();
  }

  // ── Google ────────────────────────────────────────────────────
  async function handleGoogle() {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        // Native: open Google auth in SFSafariViewController / Chrome Custom Tab.
        // Google blocks OAuth in embedded WebViews — must use system browser.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: "https://sayit-gamma.vercel.app/auth/callback",
            skipBrowserRedirect: true,
          },
        });
        if (error) return;
        if (data?.url) {
          const { Browser } = await import("@capacitor/browser");
          await Browser.open({ url: data.url });
        }
        return;
      }
    } catch { /* fall through to web flow */ }

    // Web: standard redirect flow (preserves card code for new-user card preview)
    const pending = getPendingCard();
    const code = cardCode || pending?.code;
    const redirectTo = code ? `${location.origin}/preview/${code}` : `${location.origin}/home`;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  }

  return (
    <div className="min-h-dvh flex flex-col px-6"
      style={{
        background: "linear-gradient(160deg, #FFF5F7 0%, #F8F0FF 100%)",
        paddingTop: "calc(env(safe-area-inset-top, 44px) + 20px)",
        paddingBottom: 40,
      }}>

      {/* Card received banner */}
      {fromCard && (
        <div className="mb-5 rounded-2xl overflow-hidden shadow-sm"
          style={{ background: "linear-gradient(135deg,#FF6B8A15,#9B59B615)", border: "1px solid #FF6B8A30" }}>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="text-2xl">💌</span>
            <div>
              <p className="text-sm font-bold text-gray-800">You received a card!</p>
              <p className="text-xs text-gray-500">
                <span className="font-semibold" style={{ color: accent }}>{displaySender}</span> sent you something special
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Logo */}
      <div className="flex flex-col items-center mb-7 gap-2">
        <img src="/Sayit.png" alt="SayIt" className="w-24 h-24 mb-1" style={{ borderRadius: 22 }} />
        <p className="text-gray-400 text-sm text-center">
          {fromCard
            ? `Join to see your card from ${displaySender.split(" ")[0] || "a friend"}`
            : phoneStep === "otp" ? "Enter your OTP"
            : "Create your account"}
        </p>
      </div>

      {/* Sign up / Sign in toggle */}
      {!fromCard && phoneStep === "details" && (
        <div className="flex rounded-2xl bg-gray-100 p-1 mb-5 text-sm font-semibold">
          <div className="flex-1 py-2 rounded-xl text-center"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", color: "white" }}>
            Sign Up
          </div>
          <Link href="/login" className="flex-1 py-2 rounded-xl text-center text-gray-400">
            Sign In
          </Link>
        </div>
      )}

      {/* ── Phone flow ── */}
      <div className="flex flex-col gap-4">
          {phoneStep === "details" ? (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Your Name</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full px-4 py-3.5 rounded-2xl border border-gray-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 shadow-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Phone Number</label>
                <div className="flex gap-2 w-full">
                  <div className="relative flex-shrink-0">
                    <button type="button" onClick={() => { setShowCCDropdown(v => !v); setCcQuery(""); }}
                      className="h-full px-3 py-3.5 rounded-2xl border border-gray-100 bg-white text-sm font-semibold flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                      style={{ minWidth: 88 }}>
                      <span>{COUNTRY_CODES.find(c => c.code === countryCode)?.flag}</span>
                      <span className="text-gray-700">{countryCode}</span>
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    </button>
                    {showCCDropdown && (
                      <div className="fixed inset-0 z-50 bg-white flex flex-col"
                        style={{ paddingTop: "env(safe-area-inset-top, 44px)" }}>
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
                          <button type="button"
                            onClick={() => { setShowCCDropdown(false); setCcQuery(""); }}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 text-lg font-bold">
                            ✕
                          </button>
                          <p className="font-bold text-gray-800">Select Country</p>
                        </div>
                        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
                          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <input type="text" placeholder="Search country…" value={ccQuery}
                            onChange={e => setCcQuery(e.target.value)}
                            autoFocus
                            className="flex-1 text-sm outline-none text-gray-700 py-1"
                            style={{ background: "transparent" }} />
                        </div>
                        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
                          {COUNTRY_CODES
                            .filter(c => !ccQuery || c.name.toLowerCase().includes(ccQuery.toLowerCase()) || c.code.includes(ccQuery))
                            .map((c, idx) => (
                              <button key={`${c.code}-${idx}`} type="button"
                                onClick={() => { setCountryCode(c.code); setShowCCDropdown(false); setCcQuery(""); }}
                                className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-left active:bg-gray-50"
                                style={{ fontWeight: c.code === countryCode ? 700 : 400, color: c.code === countryCode ? accent : "#333" }}>
                                <span className="text-lg">{c.flag}</span>
                                <span className="flex-1">{c.name}</span>
                                <span className="text-gray-400 text-xs font-medium">{c.code}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    type="tel" inputMode="numeric" placeholder="98765 43210"
                    value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                    className="min-w-0 flex-1 px-4 py-3.5 rounded-2xl border border-gray-100 bg-white text-sm focus:outline-none focus:ring-2 shadow-sm"
                    style={{ "--tw-ring-color": "#FF6B8A55" } as React.CSSProperties}
                    onKeyDown={e => e.key === "Enter" && sendOtp()}
                  />
                </div>
              </div>

              {error && <div className="bg-red-50 text-red-500 text-xs px-4 py-3 rounded-2xl">{error}</div>}

              <button onClick={sendOtp} disabled={loading}
                className="w-full py-4 rounded-2xl text-white font-semibold text-sm shadow-md disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                {loading ? "Sending OTP…" : "Send OTP →"}
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col items-center gap-1 mb-2">
                <p className="text-sm font-semibold text-gray-800">Enter the 6-digit code</p>
                <p className="text-xs text-gray-400">Sent to {countryCode} {phoneNumber}</p>
                <button onClick={() => { setPhoneStep("details"); setOtp(["","","","","",""]); setError(""); }}
                  className="text-xs mt-1" style={{ color: accent }}>Change number</button>
              </div>

              <OtpBoxes value={otp} onChange={setOtp} accent={accent} />

              {error && <div className="bg-red-50 text-red-500 text-xs px-4 py-3 rounded-2xl text-center">{error}</div>}

              <button onClick={verifyOtp} disabled={loading || otp.join("").length !== 6}
                className="w-full py-4 rounded-2xl text-white font-semibold text-sm shadow-md disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
                {loading ? "Creating account…" : fromCard ? "Join & See Card 💌" : "Create Account →"}
              </button>

              <div className="text-center">
                {resendSecs > 0
                  ? <p className="text-xs text-gray-400">Resend code in <span className="font-semibold" style={{ color: accent }}>{resendSecs}s</span></p>
                  : <button onClick={sendOtp} className="text-xs font-semibold" style={{ color: accent }}>Resend OTP</button>
                }
              </div>
            </>
          )}
        </div>
      {/* ── Divider + Google ── */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <button type="button" onClick={handleGoogle}
        className="w-full py-4 rounded-2xl bg-white border border-gray-100 text-gray-700 font-semibold text-sm flex items-center justify-center gap-3 shadow-sm">
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <p className="text-center text-sm text-gray-400 mt-6">
        Already have an account?{" "}
        <Link
          href={fromCard && cardCode ? `/login?card=${cardCode}&sender=${encodeURIComponent(senderName)}` : "/login"}
          className="font-semibold" style={{ color: accent }}>
          Sign In
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    }>
      <RegisterInner />
    </Suspense>
  );
}
