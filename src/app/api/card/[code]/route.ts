import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  // Use only the anon key — this is an unauthenticated public endpoint.
  // Service role key must not be used here.
  const supabase = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

  try {
    // Select only safe, non-PII columns — exclude recipient_phone, recipient_id,
    // recipient_name, and sender_id to avoid leaking personal information.
    const { data, error } = await supabase
      .from("sent_cards")
      .select(
        "id, short_code, message, card_type, template_id, front_image_url, " +
        "back_image_url, created_at, sender_name, scheduled_card_id, " +
        "profiles!sender_id(full_name)"
      )
      .eq("short_code", code)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/card] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
