"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { ArrowLeft } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://sayit-gamma.vercel.app";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${BASE_URL}/reset-password`,
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  return (
    <div className="min-h-dvh flex flex-col px-6 py-10"
      style={{ background: "linear-gradient(160deg, #FFF5F7 0%, #F8F0FF 100%)" }}>

      {/* Back */}
      <Link href="/login" className="flex items-center gap-2 text-sm text-gray-400 mb-8 w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Sign In
      </Link>

      {/* Logo */}
      <div className="flex flex-col items-center mb-8 gap-2">
        <img src="/Sayit.png" alt="SayIt" className="w-24 h-24 mb-1" style={{ borderRadius: 22 }} />
        <p className="text-gray-800 font-semibold text-lg mt-1">Forgot your password?</p>
        <p className="text-gray-400 text-sm text-center">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      {sent ? (
        /* Success state */
        <div className="flex flex-col items-center gap-4 text-center mt-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
            style={{ background: "linear-gradient(135deg,#FF6B8A22,#9B59B622)" }}>
            📬
          </div>
          <p className="text-gray-800 font-semibold">Check your email!</p>
          <p className="text-gray-400 text-sm leading-relaxed">
            We sent a reset link to <span className="font-semibold text-gray-600">{email}</span>.
            Click the link in the email to set a new password.
          </p>
          <p className="text-xs text-gray-300 mt-2">Didn't get it? Check your spam folder.</p>
          <button onClick={() => setSent(false)}
            className="text-sm font-semibold mt-2" style={{ color: "#FF6B8A" }}>
            Try a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Email address</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3.5 rounded-2xl border border-gray-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-200 shadow-sm"
            />
          </div>

          {error && <div className="bg-red-50 text-red-500 text-xs px-4 py-3 rounded-2xl">{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full py-4 rounded-2xl text-white font-semibold text-sm shadow-md disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#FF6B8A,#9B59B6)" }}>
            {loading ? "Sending…" : "Send Reset Link →"}
          </button>

          <p className="text-center text-sm text-gray-400 mt-2">
            Remembered it?{" "}
            <Link href="/login" className="font-semibold" style={{ color: "#FF6B8A" }}>Sign In</Link>
          </p>
        </form>
      )}
    </div>
  );
}
