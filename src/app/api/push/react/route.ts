import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { webpush } from "@/lib/webpush";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/push/react
// Body: { cardId: string, emoji: string }
// Auth: Bearer <supabase access token>
//
// Looks up the card's sender and fires a push notification to them:
//   "{reactorName} reacted {emoji} to your card"
export async function POST(req: NextRequest) {
  // ── 1. Auth check ───────────────────────────────────────────────────────
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── 2. Parse body ───────────────────────────────────────────────────────
  let body: { cardId?: string; emoji?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const { cardId, emoji } = body;
  if (!cardId || !emoji) return NextResponse.json({ error: "Missing cardId or emoji" }, { status: 400 });

  // ── 3. Look up card sender + reactor name in parallel ──────────────────
  const [cardRes, reactorRes] = await Promise.all([
    supabase.from("sent_cards").select("sender_id, code").eq("id", cardId).single(),
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
  ]);

  const senderId   = cardRes.data?.sender_id;
  const cardCode   = cardRes.data?.code;
  const reactorName = reactorRes.data?.full_name?.trim() || "Someone";

  // Don't notify if reactor IS the sender (they're reacting to their own card)
  if (!senderId || senderId === user.id) {
    return NextResponse.json({ ok: true, reason: "self-reaction or no sender" });
  }

  // ── 4. Look up all push subscriptions for the sender ──────────────────
  // We store one subscription per user, but query as array to future-proof
  // for multi-device support without changing this code.
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .eq("user_id", senderId);

  if (!subs?.length) return NextResponse.json({ ok: true, reason: "no subscription" });

  const payload = JSON.stringify({
    type:  "reaction",
    title: reactorName,
    body:  `Reacted ${emoji} to your card`,
    url:   cardCode ? `/card/${cardCode}?view=true&cardId=${cardId}&direction=sent` : "/wishes",
  });

  // ── 5. Fan out to all devices ──────────────────────────────────────────
  const results = await Promise.allSettled(
    subs.map(async ({ subscription }) => {
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (err: any) {
        // 410 Gone — subscription expired, remove it
        if (err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete()
            .eq("user_id", senderId)
            .eq("subscription", subscription);
        }
        throw err;
      }
    })
  );

  const sent = results.filter(r => r.status === "fulfilled").length;
  return NextResponse.json({ ok: true, sent });
}
