import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// POST /api/circle/resolve
// Body: { userId, phone }
// Called after a user signs up — links pending circle requests to their userId
export async function POST(req: NextRequest) {
  try {
    // ── Auth guard ────────────────────────────────────────────────────────────
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { userId, phone } = await req.json();
    if (!userId || !phone) {
      return NextResponse.json({ error: "Missing userId or phone" }, { status: 400 });
    }

    // Assert the authenticated user matches the userId in the body
    if (user.id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Validate that the phone matches the authenticated user's profile phone
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Normalize phones for comparison (strip leading +)
    const normalize = (p: string) => p.replace(/^\+/, "");
    if (normalize(profile.phone ?? "") !== normalize(phone)) {
      return NextResponse.json({ error: "Forbidden: phone mismatch" }, { status: 403 });
    }

    // Set recipient_id on all pending circles for this phone number
    const { error } = await supabase
      .from("circles")
      .update({ recipient_id: userId, updated_at: new Date().toISOString() })
      .eq("recipient_phone", phone)
      .is("recipient_id", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
