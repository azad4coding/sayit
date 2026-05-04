import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS so we can delete received cards too
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, phone } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    // Collect all card IDs this user is involved in
    const phoneWithPlus    = phone ? (phone.startsWith("+") ? phone : `+${phone}`) : null;
    const phoneWithoutPlus = phone ? (phone.startsWith("+") ? phone.slice(1) : phone) : null;

    // Build OR clause for recipient_phone variants
    let orClause = `sender_id.eq.${userId},recipient_id.eq.${userId}`;
    if (phoneWithPlus)    orClause += `,recipient_phone.eq.${phoneWithPlus}`;
    if (phoneWithoutPlus) orClause += `,recipient_phone.eq.${phoneWithoutPlus}`;

    const { data: cards } = await adminClient
      .from("sent_cards")
      .select("id")
      .or(orClause);

    const allIds = (cards ?? []).map((c: { id: string }) => c.id);

    // Delete reactions first (FK constraint)
    if (allIds.length > 0) {
      await adminClient.from("card_reactions").delete().in("card_id", allIds);
      // Delete all the cards in one shot
      await adminClient.from("sent_cards").delete().in("id", allIds);
    }

    return NextResponse.json({ deleted: allIds.length });
  } catch (err: any) {
    console.error("clear-history error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
