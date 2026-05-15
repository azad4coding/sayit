import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/otp/verify
// Body:    { phone: "+919876543210", code: "123456" }
// Headers: Authorization: Bearer <supabase_access_token>
//
// 1. Checks the code with Twilio Verify.
// 2. On success, upserts phone into the profiles table for the calling user.

export const dynamic = "force-dynamic";

function twilioAuth(): string {
  const sid   = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

export async function POST(req: NextRequest) {
  try {
    const { phone, code, email } = await req.json() as { phone?: string; code?: string; email?: string };

    if (!phone || !phone.startsWith("+")) {
      return NextResponse.json(
        { error: "Phone must be an E.164 number (e.g. +919876543210)" },
        { status: 400 }
      );
    }
    if (!code || code.replace(/\D/g, "").length !== 6) {
      return NextResponse.json({ error: "Code must be 6 digits" }, { status: 400 });
    }

    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID!;
    if (!serviceSid) {
      return NextResponse.json(
        { error: "Twilio Verify not configured on server" },
        { status: 500 }
      );
    }

    // ── 1: Verify the OTP code with Twilio ───────────────────────────────
    const body = new URLSearchParams({ To: phone, Code: code.replace(/\D/g, "") });

    const twilioRes = await fetch(
      `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
      {
        method: "POST",
        headers: {
          Authorization: twilioAuth(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      }
    );

    const twilioData = await twilioRes.json().catch(() => ({})) as {
      status?: string;
      message?: string;
    };

    if (!twilioRes.ok || twilioData.status !== "approved") {
      const msg = twilioData.message ?? "Invalid or expired code. Please try again.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // ── 2: Identify the logged-in user via their Supabase access token ───
    // Auth token is always required — profile write must be server-side.
    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use an anon client just to validate the JWT and extract the user ID
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: userErr } = await anonClient.auth.getUser(accessToken);

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      // Use service role key to bypass RLS — same pattern as all other API routes.
      // The anon client's upsert fails silently because no user JWT is passed
      // with the query, so RLS blocks the write.
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const profileData: Record<string, string> = { id: user.id, phone };
      if (email) profileData.email = email;

      const { error } = await adminClient
        .from("profiles")
        .upsert(profileData, { onConflict: "id" });
      if (error) {
        // Unique constraint on profiles.phone — this phone belongs to a different account
        if (error.code === "23505" || error.message?.includes("profiles_phone_unique")) {
          return NextResponse.json(
            { error: "PHONE_TAKEN", message: "This phone number is already linked to a SayIt account. Please sign in with your phone number instead." },
            { status: 409 }
          );
        }
        console.error("[otp/verify] profile upsert failed:", error.message);
        return NextResponse.json({ error: "Profile update failed" }, { status: 500 });
      }
    } catch (e) {
      console.error("[otp/verify] profile upsert error:", e);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, persistedProfile: true });
  } catch (e) {
    console.error("[otp/verify] unexpected error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
