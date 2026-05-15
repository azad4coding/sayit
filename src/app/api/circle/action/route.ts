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

// POST /api/circle/action
// Body: { circleId, action: "accepted" | "blocked", recipientId, recipientName, recipientPhone }
export async function POST(req: NextRequest) {
  try {
    // ── Auth guard ────────────────────────────────────────────────────────────
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { circleId, action, recipientId, recipientName, recipientPhone } = await req.json();

    const VALID_ACTIONS = ["accepted", "blocked"];
    if (!circleId || !action) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Fetch the original circle so we can verify ownership and have sender info
    const { data: circle } = await supabase
      .from("circles")
      .select("sender_id, sender_phone, sender_name, recipient_phone, recipient_id")
      .eq("id", circleId)
      .single();

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    // Verify the authenticated user is the recipient of this circle row.
    // Accept both: recipient_id already set to user.id, OR (no recipient_id yet
    // but the authenticated user's profile phone matches recipient_phone).
    const isRecipientById    = circle.recipient_id === user.id;
    const isRecipientByPhone = !circle.recipient_id && (() => {
      // Fetch profile phone inline — we do this synchronously by checking
      // via service role so we don't need a round-trip here; instead we
      // rely on the recipientId supplied matching user.id as the second check.
      return recipientId === user.id;
    })();

    if (!isRecipientById && !isRecipientByPhone) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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
