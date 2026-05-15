import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { timingSafeEqual } from "crypto";

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
  // Verify Vercel Cron secret using timing-safe comparison to prevent timing attacks
  const auth       = req.headers.get("authorization") ?? "";
  const expected   = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  const authBuf    = Buffer.from(auth);
  const expectedBuf = Buffer.from(expected);
  const secretValid =
    authBuf.length === expectedBuf.length &&
    timingSafeEqual(authBuf, expectedBuf);

  if (!secretValid) {
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
  const pending = schedules ?? [];
  if (pending.length === 0) return NextResponse.json({ processed: 0, results });

  // ── Pre-batch all DB lookups to eliminate N+1 queries ────────────────────

  // 1. Sender profiles (one query for all schedules)
  const senderIds = Array.from(new Set(pending.map((s: any) => s.user_id).filter(Boolean)));
  const { data: senderProfiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", senderIds);
  const senderNameMap: Record<string, string> = {};
  for (const p of (senderProfiles ?? [])) {
    senderNameMap[p.id] = p.full_name ?? "Someone";
  }

  // 2. Recipient profiles (one query for all schedules that have a recipient_id)
  const recipientIds = Array.from(new Set(pending.map((s: any) => s.recipient_id).filter(Boolean)));
  const { data: recipientProfiles } = recipientIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", recipientIds)
    : { data: [] };
  const recipientNameMap: Record<string, string | null> = {};
  for (const p of (recipientProfiles ?? [])) {
    recipientNameMap[p.id] = p.full_name ?? null;
  }

  // 3. Templates per category (one query covering all category_ids that need random picks)
  const categoryIds = Array.from(new Set(
    pending.filter((s: any) => !s.template_id && s.category_id).map((s: any) => s.category_id)
  ));
  const templatesByCat: Record<string, Array<{ id: string; front_image_url: string | null }>> = {};
  if (categoryIds.length > 0) {
    const { data: allTemplates } = await supabase
      .from("templates")
      .select("id, front_image_url, category_id")
      .in("category_id", categoryIds)
      .limit(500);
    for (const t of (allTemplates ?? [])) {
      if (!templatesByCat[t.category_id]) templatesByCat[t.category_id] = [];
      templatesByCat[t.category_id].push({ id: t.id, front_image_url: t.front_image_url ?? null });
    }
  }

  // ── Process each schedule using pre-fetched data ──────────────────────────
  for (const schedule of pending) {
    try {
      // Pick a template: use pinned template_id OR pick random from pre-fetched category pool
      let templateId: string | null = schedule.template_id ?? null;
      let frontImageUrl: string | null = null;

      if (!templateId && schedule.category_id) {
        const templates = templatesByCat[schedule.category_id] ?? [];
        if (templates.length > 0) {
          const pick = templates[Math.floor(Math.random() * templates.length)];
          templateId    = pick.id;
          frontImageUrl = pick.front_image_url;
        }
      }

      const senderName    = senderNameMap[schedule.user_id] ?? "Someone";
      const shortCode     = uuidv4().replace(/-/g, "").slice(0, 8);
      const recipientName = schedule.recipient_id ? (recipientNameMap[schedule.recipient_id] ?? null) : null;

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
