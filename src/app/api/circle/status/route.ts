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

// GET /api/circle/status?senderid=...&phone=...
// Returns the circle status between a sender and a recipient's phone
export async function GET(req: NextRequest) {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const senderId = req.nextUrl.searchParams.get("senderid");
  const phone    = req.nextUrl.searchParams.get("phone");

  if (!senderId || !phone) {
    return NextResponse.json({ status: "none", circleId: null });
  }

  // Assert authenticated user is the sender OR is the owner of the queried phone
  if (user.id !== senderId) {
    // Check if the authenticated user owns the queried phone
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .single();

    const normalize = (p: string) => p.replace(/^\+/, "");
    const ownsPhone = profile?.phone && normalize(profile.phone) === normalize(phone);

    if (!ownsPhone) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data } = await supabase
    .from("circles")
    .select("id, status, sender_name")
    .eq("sender_id", senderId)
    .eq("recipient_phone", phone)
    .maybeSingle();

  if (!data) return NextResponse.json({ status: "none", circleId: null });

  return NextResponse.json({
    status:     data.status,
    circleId:   data.id,
    senderName: data.sender_name,
  });
}
