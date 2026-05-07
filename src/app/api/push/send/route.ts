import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { webpush } from "@/lib/webpush";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Anon client used only to verify the caller's JWT
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  // ── Auth guard: only authenticated users can trigger push notifications ──
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse body once — reused in catch block to avoid double-consume bug
  let body: { recipientId?: string; senderName?: string; cardCode?: string } = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const { recipientId, senderName, cardCode } = body;
  if (!recipientId) return NextResponse.json({ error: "Missing recipientId" }, { status: 400 });

  try {
    // Look up recipient's push subscription
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", recipientId)
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, reason: "no subscription" });
    }

    const payload = JSON.stringify({
      title: "💌 You received a card!",
      body:  `${senderName || "Someone"} sent you something special`,
      url:   cardCode ? `/preview/${cardCode}` : "/history",
    });

    await webpush.sendNotification(data.subscription, payload);
    return NextResponse.json({ ok: true });

  } catch (err: any) {
    // 410 = subscription expired — clean it up using already-parsed recipientId
    if (err.statusCode === 410 && recipientId) {
      await supabase.from("push_subscriptions").delete().eq("user_id", recipientId);
    }
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
