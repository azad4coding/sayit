import { NextRequest, NextResponse } from "next/server";

// POST /api/otp/send
// Body: { phone: "+919876543210" }
// Sends a Twilio Verify OTP to the given E.164 phone number.

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
      console.error("[otp/send] Twilio error:", errData);
      // Twilio error 60200 = invalid phone, 60203 = max attempts
      const msg =
        (errData as { message?: string }).message ?? "Failed to send OTP";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[otp/send] unexpected error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
