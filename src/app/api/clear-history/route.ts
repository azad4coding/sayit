import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS so we can query sent cards
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Anon client used only to verify the caller's JWT
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // ── Auth guard: verify the Bearer token belongs to the userId in the body ──
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    // Ensure the authenticated user can only clear their own history
    if (user.id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Only hard-delete cards where sender_id = user.id (cards the user sent).
    // For received cards, skip deletion — soft-delete to be implemented with
    // deleted_by_recipient flag.
    const { data: sentCards } = await adminClient
      .from("sent_cards")
      .select("id")
      .eq("sender_id", userId);

    const sentIds = (sentCards ?? []).map((c: { id: string }) => c.id);

    // Delete reactions first (FK constraint), then the cards themselves
    if (sentIds.length > 0) {
      await adminClient.from("card_reactions").delete().in("card_id", sentIds);
      await adminClient.from("sent_cards").delete().in("id", sentIds);
    }

    return NextResponse.json({ deleted: sentIds.length });
  } catch (err: any) {
    console.error("clear-history error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
