import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// GET /api/circle/status?senderid=...&phone=...
// Returns the circle status between a sender and a recipient's phone
export async function GET(req: NextRequest) {
  const senderId = req.nextUrl.searchParams.get("senderid");
  const phone    = req.nextUrl.searchParams.get("phone");

  if (!senderId || !phone) {
    return NextResponse.json({ status: "none", circleId: null });
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
