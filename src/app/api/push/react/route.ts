import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/onesignal-server";

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
// Notifies the card sender that someone reacted to their card.
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

  // ── 3. Look up card + reactor profile in parallel ──────────────────────
  const [cardRes, reactorRes] = await Promise.all([
    supabase
      .from("sent_cards")
      .select("sender_id, short_code, recipient_id, recipient_phone")
      .eq("id", cardId)
      .single(),
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).single(),
  ]);

  const senderId      = cardRes.data?.sender_id;
  const cardCode      = cardRes.data?.short_code;
  const recipientId   = cardRes.data?.recipient_id;
  const recipientPhone = cardRes.data?.recipient_phone;
  const reactorName   = reactorRes.data?.full_name?.trim() || "Someone";
  const reactorPhone  = reactorRes.data?.phone ?? null;

  // Don't notify if the reactor IS the sender
  if (!senderId || senderId === user.id) {
    return NextResponse.json({ ok: true, reason: "self-reaction or no sender" });
  }

  // Verify the reactor is the actual recipient of the card
  const normalize = (p: string | null | undefined) => (p ?? "").replace(/^\+/, "");
  const isRecipientById    = recipientId && recipientId === user.id;
  const isRecipientByPhone = recipientPhone && reactorPhone &&
    normalize(reactorPhone) === normalize(recipientPhone);

  if (!isRecipientById && !isRecipientByPhone) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 4. Send via OneSignal ───────────────────────────────────────────────
  const result = await sendPush({
    recipientUserIds: [senderId],
    title: reactorName,
    body:  `Reacted ${emoji} to your card`,
    data: {
      type:     "reaction",
      cardCode: cardCode ?? "",
      // Use /preview/[short_code] — short_code is NOT a template ID,
      // so /card/[id] would 404.  The preview page shows reaction badges
      // and "Say it Again" correctly for the sender.
      url: cardCode ? `/preview/${cardCode}?back=/wishes` : "/wishes",
    },
  });

  return NextResponse.json({ ok: result.ok, error: result.error });
}
