import { NextRequest, NextResponse } from "next/server";
import { checkOtpRateLimit } from "@/lib/otp-rate-limit";

// POST /api/otp/send-signin
// Body: { phone: "+919876543210" }
//
// Sends a Twilio Verify OTP to a phone number that is already registered.
// Used when a Google-auth user enters a phone that belongs to an existing
// SayIt account — we sign them in directly via supabase.auth.verifyOtp.

export const dynamic = "force-dynamic";

function twilioAuth(): string {
  const sid   = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json() as { phone?: string };

    if (!phone || !phone.startsWith("+")) {
      return NextResponse.json(
        { error: "Phone must be an E.164 number (e.g. +919876543210)" },
        { status: 400 }
      );
    }

    // ── Rate limiting ────────────────────────────────────────────────────────
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkOtpRateLimit(phone, ip)) {
      return NextResponse.json(
        { error: "Too many OTP requests. Please wait 10 minutes before trying again." },
        { status: 429 }
      );
    }

    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID!;
    if (!serviceSid) {
      return NextResponse.json(
        { error: "Twilio Verify not configured on server" },
        { status: 500 }
      );
    }

    const body = new URLSearchParams({ To: phone, Channel: "sms" });

    const res = await fetch(
      `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: twilioAuth(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("[otp/send-signin] Twilio error:", errData);
      const msg = (errData as { message?: string }).message ?? "Failed to send sign-in code";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[otp/send-signin] unexpected error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
