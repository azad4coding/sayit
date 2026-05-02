import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Compute the next run timestamp based on recurrence
function computeNextRun(schedule: any): string {
  const now = new Date();
  const [hours, minutes] = (schedule.scheduled_time as string).split(":").map(Number);

  if (schedule.recurrence === "one-time") {
    // One-time schedules don't repeat — return far future sentinel
    return new Date(9999, 0, 1).toISOString();
  }

  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hours, minutes);

  if (schedule.recurrence === "daily") {
    // If today's time has passed, move to tomorrow
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (schedule.recurrence === "weekly") {
    // scheduled_day: 0=Sun … 6=Sat
    const targetDay = schedule.scheduled_day ?? 1;
    const diff = (targetDay - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + (diff === 0 && next <= now ? 7 : diff));
  } else if (schedule.recurrence === "monthly") {
    // scheduled_day: 1–31
    next.setDate(schedule.scheduled_day ?? 1);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(schedule.scheduled_day ?? 1);
    }
  }

  return next.toISOString();
}

export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();

  // Fetch all active schedules due to run
  const { data: schedules, error } = await supabase
    .from("scheduled_cards")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", now);

  if (error) {
    console.error("Cron fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: string[] = [];

  for (const schedule of schedules ?? []) {
    try {
      // Pick a template: use pinned template_id OR pick random from category
      let templateId: string | null = schedule.template_id ?? null;
      let frontImageUrl: string | null = null;

      if (!templateId && schedule.category_id) {
        // Pick a random template from the category
        const { data: templates } = await supabase
          .from("templates")
          .select("id, front_image_url")
          .eq("category_id", schedule.category_id)
          .limit(50);

        if (templates && templates.length > 0) {
          const pick = templates[Math.floor(Math.random() * templates.length)];
          templateId    = pick.id;
          frontImageUrl = pick.front_image_url ?? null;
        }
      }

      // Get sender name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", schedule.user_id)
        .single();

      const senderName = profile?.full_name ?? "Someone";
      const shortCode  = uuidv4().replace(/-/g, "").slice(0, 8);

      // Resolve recipient name from profiles if we have their id
      let recipientName: string | null = null;
      if (schedule.recipient_id) {
        const { data: rp } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", schedule.recipient_id)
          .single();
        recipientName = rp?.full_name ?? null;
      }

      // Insert into sent_cards
      const { error: insertErr } = await supabase.from("sent_cards").insert({
        sender_id:       schedule.user_id,
        recipient_phone: schedule.recipient_phone,
        recipient_id:    schedule.recipient_id ?? null,
        recipient_name:  recipientName,
        template_id:     templateId,
        front_image_url: frontImageUrl,
        message:         schedule.message ?? "",
        short_code:      shortCode,
        sender_name:     senderName,
        card_type:       "scheduled",
        scheduled_card_id: schedule.id,
      });

      if (insertErr) throw new Error(insertErr.message);

      // Update schedule: set last_run_at and compute next_run_at
      const nextRun = computeNextRun(schedule);
      const isOneTime = schedule.recurrence === "one-time";

      await supabase
        .from("scheduled_cards")
        .update({
          last_run_at: now,
          next_run_at: nextRun,
          is_active:   !isOneTime, // deactivate after one-time fires
        })
        .eq("id", schedule.id);

      results.push(`✓ Sent schedule ${schedule.id} → ${schedule.recipient_phone}`);
    } catch (err) {
      results.push(`✗ Schedule ${schedule.id} failed: ${err}`);
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
