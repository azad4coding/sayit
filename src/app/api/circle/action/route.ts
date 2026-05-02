import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// POST /api/circle/action
// Body: { circleId, action: "accepted" | "blocked", recipientId, recipientName, recipientPhone }
export async function POST(req: NextRequest) {
  try {
    const { circleId, action, recipientId, recipientName, recipientPhone } = await req.json();

    if (!circleId || !action) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Fetch the original circle so we have sender info for the reverse entry
    const { data: circle } = await supabase
      .from("circles")
      .select("sender_id, sender_phone, sender_name, recipient_phone")
      .eq("id", circleId)
      .single();

    // Update the original circle request
    const { error } = await supabase
      .from("circles")
      .update({
        status:       action,
        recipient_id: recipientId ?? null,
        updated_at:   new Date().toISOString(),
      })
      .eq("id", circleId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If accepted → create the reverse (mutual) circle entry B→A
    if (action === "accepted" && circle && recipientId) {
      await supabase.from("circles").upsert({
        sender_id:       recipientId,
        sender_phone:    recipientPhone ?? null,
        sender_name:     recipientName ?? null,
        recipient_phone: circle.sender_phone ?? "",
        recipient_id:    circle.sender_id,
        status:          "accepted",
        updated_at:      new Date().toISOString(),
      }, { onConflict: "sender_id,recipient_phone", ignoreDuplicates: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
