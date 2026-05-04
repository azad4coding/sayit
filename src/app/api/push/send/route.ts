import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { webpush } from "@/lib/webpush";

export async function POST(req: NextRequest) {
  try {
    const { recipientId, senderName, cardCode } = await req.json();
    if (!recipientId) return NextResponse.json({ error: "Missing recipientId" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
    // 410 = subscription expired — clean it up
    if (err.statusCode === 410) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { recipientId } = await req.json().catch(() => ({}));
      if (recipientId) await supabase.from("push_subscriptions").delete().eq("user_id", recipientId);
    }
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
