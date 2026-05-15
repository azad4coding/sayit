"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ChevronDown, Search } from "lucide-react";

// ── Country codes (global list) ──────────────────────────────────────────────
const COUNTRY_CODES = [
  // Most common first
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
  { code: "+380", flag: "🇺🇦", name: "Ukraine" },
  { code: "+31",  flag: "🇳🇱", name: "Netherlands" },
  { code: "+41",  flag: "🇨🇭", name: "Switzerland" },
  { code: "+46",  flag: "🇸🇪", name: "Sweden" },
  { code: "+47",  flag: "🇳🇴", name: "Norway" },
  { code: "+45",  flag: "🇩🇰", name: "Denmark" },
  { code: "+358", flag: "🇫🇮", name: "Finland" },
  { code: "+48",  flag: "🇵🇱", name: "Poland" },
  { code: "+64",  flag: "🇳🇿", name: "New Zealand" },
  { code: "+1",   flag: "🇨🇦", name: "Canada" },
  { code: "+54",  flag: "🇦🇷", name: "Argentina" },
  { code: "+56",  flag: "🇨🇱", name: "Chile" },
  { code: "+57",  flag: "🇨🇴", name: "Colombia" },
  { code: "+90",  flag: "🇹🇷", name: "Turkey" },
  { code: "+98",  flag: "🇮🇷", name: "Iran" },
  { code: "+93",  flag: "🇦🇫", name: "Afghanistan" },
];

// ── OTP 6-box input ──────────────────────────────────────────────────────────
function OtpBoxes({ value, onChange, accent = "#FF6B8A" }: {
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
    if (e.key === "Backspace" && !value[i] && i > 0) inputRefs.current[i - 1]?.focus();
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
        <input key={i} ref={el => { inputRefs.current[i] = el; }}
          type="tel" inputMode="numeric" maxLength={1} value={digit}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)} onPaste={handlePaste}
          style={{
            width: 44, height: 52, borderRadius: 12, textAlign: "center",
            fontSize: 22, fontWeight: 700, color: "#333",
            border: digit ? `2.5px solid ${accent}` : "2px solid #e5e7eb",
            background: digit ? `${accent}0D` : "white",
            outline: "none", transition: "all 0.15s",
          }} />
      ))}
    </div>
  );
}

// ── Country picker dropdown ──────────────────────────────────────────────────
function CountryPicker({ value, onChange, accent }: {
  value: string; onChange: (code: string) => void; accent: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = COUNTRY_CODES.find(c => c.code === value && c.name !== "Canada") ?? COUNTRY_CODES[0];

  const filtered = query.trim()
    ? COUNTRY_CODES.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.code.includes(query)
      )
    : COUNTRY_CODES;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="h-full px-3 py-3.5 rounded-2xl border border-gray-100 bg-white text-sm font-semibold flex items-center gap-1.5 shadow-sm whitespace-nowrap"
        style={{ minWidth: 90 }}>
        <span>{selected.flag}</span>
        <span className="text-gray-700">{selected.code}</span>
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50" style={{ width: 220, maxHeight: 320 }}>
            {/* Search */}
            <div className="px-3 py-2 border-b border-gray-50 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <input
                type="text" placeholder="Search country…"
                value={query} onChange={e => setQuery(e.target.value)}
                className="flex-1 text-sm outline-none text-gray-700"
                autoFocus
              />
            </div>
            <div style={{ overflowY: "auto", maxHeight: 264 }}>
              {filtered.map((c, idx) => (
                <button key={`${c.code}-${idx}`} type="button"
                  onClick={() => { onChange(c.code); setOpen(false); setQuery(""); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 text-left"
                  style={{ fontWeight: c.code === value && c.name === selected.name ? 700 : 400, color: c.code === value && c.name === selected.name ? accent : "#333" }}>
                  <span>{c.flag}</span>
                  <span className="flex-1">{c.name}</span>
                  <span className="text-gray-400 text-xs">{c.code}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No results</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function AddPhoneInner() {
  const router   = useRouter();
  const params   = useSearchParams();
  const supabase = createClient();
  const next     = params.get("next") ?? "/home";
  const accent   = "#FF6B8A";

  const [step,        setStep]        = useState<"phone" | "otp" | "signin-otp">("phone");
  const [status,      setStatus]      = useState<"idle" | "phone-exists">("idle");
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [fullPhone,   setFullPhone]   = useState("");   // E.164, set when OTP is sent
  const [otp,         setOtp]         = useState(["", "", "", "", "", ""]);
  const [resendSecs,  setResendSecs]  = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [userName,    setUserName]    = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "";
        setUserName(name.split(" ")[0]);
      }
    });
  }, []);

  useEffect(() => {
    if (resendSecs <= 0) return;
    const t = setTimeout(() => setResendSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendSecs]);

  async function sendOtp() {
    const digits = phoneNumber.replace(/\D/g, "");
    if (!digits || digits.length < 5) {
      setError("Please enter a valid phone number");
      return;
    }
    const phone = `${countryCode}${digits}`;
    setLoading(true); setError("");

    const res = await fetch("/api/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json() as { ok?: boolean; phoneExists?: boolean; error?: string };

    if (!res.ok || !data.ok) {
      setLoading(false);
      setError(data.error ?? "Failed to send OTP. Please try again.");
      return;
    }

    // Phone is already registered — send a sign-in OTP to get them into their existing account.
    // We sign out the Google session first, then verifyOtp() will create a session for the
    // phone account directly, landing them on /home without any extra login step.
    if (data.phoneExists) {
      // Send OTP via Twilio (reuse the send endpoint but we know phone exists)
      const otpRes = await fetch("/api/otp/send-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      setLoading(false);
      if (!otpRes.ok) {
        setError("Failed to send sign-in code. Please try signing in with your phone number.");
        return;
      }
      // Sign out Google session silently — verifyOtp will create the phone session
      await supabase.auth.signOut();
      setFullPhone(phone);
      setStep("signin-otp");
      setResendSecs(60);
      return;
    }

    setLoading(false);
    setFullPhone(phone);
    setStep("otp");
    setResendSecs(60);
  }

  // Sign-in OTP for an existing phone account (after Google login detected same phone).
  // Calls supabase.auth.verifyOtp which creates a session for the phone user directly.
  async function verifySigninOtp() {
    const code = otp.join("");
    if (code.length !== 6) { setError("Enter the 6-digit code"); return; }
    setLoading(true); setError("");

    const { error } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: code,
      type: "sms",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Session is now the phone account — go straight home
    setLoading(false);
    window.location.href = "/home";
  }

  async function verifyOtp() {
    const code = otp.join("");
    if (code.length !== 6) { setError("Enter the 6-digit code"); return; }
    setLoading(true); setError("");

    // Get the current session token to pass to the API route
    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch("/api/otp/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ phone: fullPhone, code }),
    });

    const data = await res.json() as { ok?: boolean; persistedProfile?: boolean; error?: string; message?: string };

    if (!res.ok || !data.ok) {
      if (res.status === 409 || data.error === "PHONE_TAKEN") {
        // This phone already belongs to an existing SayIt account.
        // The OTP proved they own this number, so they're the same person —
        // sign out the current (Google) session and send them to sign in with phone.
        setError("This phone is already registered with SayIt. Signing you out — please sign in with your phone number instead.");
        setLoading(false);
        setTimeout(async () => {
          await supabase.auth.signOut();
          router.replace("/login");
        }, 2500);
        return;
      }
      setError(data.error ?? "Invalid code. Please try again.");
      setLoading(false);
      return;
    }

    // If the server couldn't write the profile (no auth token), write it here
    if (!data.persistedProfile) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .upsert({ id: user.id, phone: fullPhone }, { onConflict: "id" });
      }
    }

    setLoading(false);
    router.replace(next);
  }

  return (
    <div className="min-h-dvh flex flex-col px-6 py-10"
      style={{ background: "linear-gradient(160deg,#FFF5F7 0%,#F8F0FF 100%)" }}>

      {/* Logo */}
      <div className="flex flex-col items-center mb-8 gap-2">
        <img src="/Sayit.png" alt="SayIt" className="w-24 h-24 mb-1" style={{ borderRadius: 22 }} />
        <h1 className="text-2xl font-bold"
          style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {step === "signin-otp" ? "Welcome back!" : "One last step"}
        </h1>
        <p className="text-gray-400 text-sm text-center leading-relaxed px-4">
          {step === "signin-otp"
            ? "We found your existing SayIt account 🎉"
            : `${userName ? `Hey ${userName}! Add` : "Add"} your phone number so friends can find you and send you cards 💌`}
        </p>
      </div>

      {/* ── Phone step ── */}
      {step === "phone" && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Your Phone Number</label>
            <div className="flex gap-2">
              <CountryPicker value={countryCode} onChange={setCountryCode} accent={accent} />
              <input type="tel" inputMode="numeric" placeholder="98765 43210"
                value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendOtp()}
                className="flex-1 px-4 py-3.5 rounded-2xl border border-gray-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 shadow-sm" />
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-500 text-xs px-4 py-3 rounded-2xl">{error}</div>}

          <button onClick={sendOtp} disabled={loading}
            className="w-full py-4 rounded-2xl text-white font-semibold text-sm shadow-md disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
            {loading ? "Sending code…" : "Send Verification Code →"}
          </button>

          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            We'll send a one-time code via SMS to verify this is your number.
          </p>
        </div>
      )}

      {/* ── Sign-in OTP step (existing phone account detected) ── */}
      {step === "signin-otp" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1 mb-2">
            <p className="text-sm font-semibold text-gray-800">Enter your sign-in code</p>
            <p className="text-xs text-gray-400 text-center px-4">
              We found your existing SayIt account linked to {fullPhone}. Enter the code we just sent to sign you in.
            </p>
          </div>

          <OtpBoxes value={otp} onChange={setOtp} accent={accent} />

          {error && <div className="bg-red-50 text-red-500 text-xs px-4 py-3 rounded-2xl text-center">{error}</div>}

          <button onClick={verifySigninOtp} disabled={loading || otp.join("").length !== 6}
            className="w-full py-4 rounded-2xl text-white font-semibold text-sm shadow-md disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>

          <div className="text-center">
            {resendSecs > 0
              ? <p className="text-xs text-gray-400">Resend in <span className="font-semibold" style={{ color: accent }}>{resendSecs}s</span></p>
              : <button onClick={() => { setStep("phone"); setOtp(["","","","","",""]); setError(""); }}
                  disabled={loading} className="text-xs font-semibold" style={{ color: accent }}>Use a different number</button>}
          </div>
        </div>
      )}

      {/* ── OTP step ── */}
      {status === "idle" && step === "otp" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1 mb-2">
            <p className="text-sm font-semibold text-gray-800">Enter the 6-digit code</p>
            <p className="text-xs text-gray-400">Sent to {fullPhone}</p>
            <button onClick={() => { setStep("phone"); setOtp(["","","","","",""]); setError(""); }}
              className="text-xs mt-1 font-semibold" style={{ color: accent }}>Change number</button>
          </div>

          <OtpBoxes value={otp} onChange={setOtp} accent={accent} />

          {error && <div className="bg-red-50 text-red-500 text-xs px-4 py-3 rounded-2xl text-center">{error}</div>}

          <button onClick={verifyOtp} disabled={loading || otp.join("").length !== 6}
            className="w-full py-4 rounded-2xl text-white font-semibold text-sm shadow-md disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
            {loading ? "Verifying…" : "Verify & Continue →"}
          </button>

          <div className="text-center">
            {resendSecs > 0
              ? <p className="text-xs text-gray-400">Resend in <span className="font-semibold" style={{ color: accent }}>{resendSecs}s</span></p>
              : <button onClick={sendOtp} disabled={loading} className="text-xs font-semibold" style={{ color: accent }}>Resend Code</button>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddPhonePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-dvh">
        <div className="w-8 h-8 border-4 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
      </div>
    }>
      <AddPhoneInner />
    </Suspense>
  );
}
