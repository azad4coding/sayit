import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/onesignal-server";

export const dynamic = "force-dynamic";

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST /api/push/send
// Body: { recipientId: string, senderName?: string, cardCode?: string }
// Auth: Bearer <supabase access token>
//
// Sends a "you received a card" push notification to the recipient via OneSignal.
// OneSignal targets the device by external_id (= Supabase user UUID),
// so no subscription objects need to be stored.
export async function POST(req: NextRequest) {
  // ── 1. Auth guard ───────────────────────────────────────────────────────
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── 2. Parse body ───────────────────────────────────────────────────────
  let body: { recipientId?: string; senderName?: string; cardCode?: string; firstContact?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const { recipientId, senderName, cardCode, firstContact } = body;
  if (!recipientId) return NextResponse.json({ error: "Missing recipientId" }, { status: 400 });

  // Don't send a notification to yourself
  if (recipientId === user.id) return NextResponse.json({ ok: true, reason: "self-send" });

  // ── 3. Send via OneSignal ───────────────────────────────────────────────
  const pushBody = firstContact
    ? `${senderName || "Someone"} sent you a card 💌 Check WhatsApp or SMS to open it`
    : `You received a card from ${senderName || "Someone"} 💌`;

  console.log("[push/send] sending to recipientId:", recipientId, "from sender:", user.id);

  const result = await sendPush({
    recipientUserIds: [recipientId],
    title: senderName || "SayIt",
    body:  pushBody,
    data: {
      type:     "card",
      cardCode: cardCode ?? "",
      // Use /preview/[short_code] — works for all card types and handles
      // auth-aware display (recipient sees envelope + reaction tray,
      // sender sees "Say it Again").  /card/[id] requires a template UUID
      // which is NOT the same as the short_code, so do not use that here.
      url: cardCode ? `/preview/${cardCode}?back=/wishes` : "/wishes",
    },
  });

  console.log("[push/send] OneSignal result:", JSON.stringify(result));
  return NextResponse.json({ ok: result.ok, error: result.error });
}
