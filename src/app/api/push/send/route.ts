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

// POST /api/push/send
// Body: { recipientId: string, senderName?: string, cardCode?: string }
// Auth: Bearer <supabase access token>
//
// Sends a "you received a card" push to all of the recipient's devices.
export async function POST(req: NextRequest) {
  // ── 1. Auth guard ───────────────────────────────────────────────────────
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── 2. Parse body ───────────────────────────────────────────────────────
  let body: { recipientId?: string; senderName?: string; cardCode?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const { recipientId, senderName, cardCode } = body;
  if (!recipientId) return NextResponse.json({ error: "Missing recipientId" }, { status: 400 });

  // ── 3. Look up all subscriptions for this recipient ─────────────────────
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .eq("user_id", recipientId);

  if (!subs?.length) return NextResponse.json({ ok: true, reason: "no subscription" });

  const payload = JSON.stringify({
    type:  "card",
    title: senderName || "SayIt",
    body:  "Sent you a card 💌",
    url:   cardCode ? `/card/${cardCode}?view=true&startEnvelope=true&direction=received` : "/history",
  });

  // ── 4. Fan out to all devices ──────────────────────────────────────────
  const results = await Promise.allSettled(
    subs.map(async ({ subscription }) => {
      try {
        await webpush.sendNotification(subscription, payload);
      } catch (err: any) {
        if (err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete()
            .eq("user_id", recipientId)
            .eq("subscription", subscription);
        }
        throw err;
      }
    })
  );

  const sent = results.filter(r => r.status === "fulfilled").length;
  return NextResponse.json({ ok: true, sent });
}
