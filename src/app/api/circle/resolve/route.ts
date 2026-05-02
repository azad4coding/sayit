import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// POST /api/circle/resolve
// Body: { userId, phone }
// Called after a user signs up — links pending circle requests to their userId
export async function POST(req: NextRequest) {
  try {
    const { userId, phone } = await req.json();
    if (!userId || !phone) {
      return NextResponse.json({ error: "Missing userId or phone" }, { status: 400 });
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
