import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  // Prefer service role key (bypasses RLS); fall back to anon key
  const key = SERVICE_KEY || ANON_KEY;
  const supabase = createClient(SUPABASE_URL, key, { auth: { persistSession: false } });

  try {
    const { data, error } = await supabase
      .from("sent_cards")
      .select("*, profiles!sender_id(full_name)")
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
