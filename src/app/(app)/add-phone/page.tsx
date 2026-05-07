"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { ChevronDown } from "lucide-react";
import { normalizePhone } from "@/lib/phone";

const COUNTRY_CODES = [
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+1",   flag: "🇺🇸", name: "US / Canada" },
  { code: "+44",  flag: "🇬🇧", name: "UK" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+65",  flag: "🇸🇬", name: "Singapore" },
  { code: "+61",  flag: "🇦🇺", name: "Australia" },
];

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

function AddPhoneInner() {
  const router   = useRouter();
  const params   = useSearchParams();
  const supabase = createClient();
  const next     = params.get("next") ?? "/home";
  const accent   = "#FF6B8A";

  const [step,           setStep]           = useState<"phone" | "otp">("phone");
  const [countryCode,    setCountryCode]    = useState("+91");
  const [showCCDropdown, setShowCCDropdown] = useState(false);
  const [phoneNumber,    setPhoneNumber]    = useState("");
  const [otp,            setOtp]            = useState(["", "", "", "", "", ""]);
  const [resendSecs,     setResendSecs]     = useState(0);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState("");
  const [userName,       setUserName]       = useState("");

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
    const fullPhone = normalizePhone(countryCode, phoneNumber);
    if (!fullPhone) { setError("Please enter a valid phone number"); return; }
    setLoading(true); setError("");

    // updateUser sends OTP to link phone to existing account
    const { error } = await supabase.auth.updateUser({ phone: fullPhone });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStep("otp"); setResendSecs(60);
  }

  async function verifyOtp() {
    const token = otp.join("");
    if (token.length !== 6) { setError("Enter the 6-digit code"); return; }
    const fullPhone = normalizePhone(countryCode, phoneNumber);
    if (!fullPhone) { setError("Invalid phone number — please go back and re-enter"); return; }
    setLoading(true); setError("");

    // Verify with type "phone_change" — links phone to Google account
    const { error } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token,
      type: "phone_change",
    });

    if (error) { setError(error.message); setLoading(false); return; }

    // Also save to profiles table for easy querying
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert(
        { id: user.id, phone: fullPhone },
        { onConflict: "id" }
      );
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
          One last step
        </h1>
        <p className="text-gray-400 text-sm text-center leading-relaxed px-4">
          {userName ? `Hey ${userName}! Add` : "Add"} your phone number so friends can find you and send you cards 💌
        </p>
      </div>

      {/* Phone step */}
      {step === "phone" && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Your Phone Number</label>
            <div className="flex gap-2">
              {/* Country code picker */}
              <div className="relative">
                <button type="button" onClick={() => setShowCCDropdown(v => !v)}
                  className="h-full px-3 py-3.5 rounded-2xl border border-gray-100 bg-white text-sm font-semibold flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  style={{ minWidth: 88 }}>
                  <span>{COUNTRY_CODES.find(c => c.code === countryCode)?.flag}</span>
                  <span className="text-gray-700">{countryCode}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </button>
                {showCCDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50" style={{ minWidth: 180 }}>
                    {COUNTRY_CODES.map(c => (
                      <button key={c.code} type="button"
                        onClick={() => { setCountryCode(c.code); setShowCCDropdown(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 text-left"
                        style={{ fontWeight: c.code === countryCode ? 700 : 400, color: c.code === countryCode ? accent : "#333" }}>
                        <span>{c.flag}</span><span>{c.name}</span>
                        <span className="ml-auto text-gray-400 text-xs">{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
            {loading ? "Sending OTP…" : "Send Verification Code →"}
          </button>

          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            We'll send a one-time code to verify this is your number. Standard SMS rates may apply.
          </p>
        </div>
      )}

      {/* OTP step */}
      {step === "otp" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1 mb-2">
            <p className="text-sm font-semibold text-gray-800">Enter the 6-digit code</p>
            <p className="text-xs text-gray-400">Sent to {countryCode} {phoneNumber}</p>
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
              : <button onClick={sendOtp} className="text-xs font-semibold" style={{ color: accent }}>Resend Code</button>}
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
