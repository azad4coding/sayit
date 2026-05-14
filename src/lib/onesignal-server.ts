// ── OneSignal server-side helper ─────────────────────────────────────────────
// Uses the OneSignal REST API to send push notifications to specific users
// by their external_id (= Supabase user UUID set during login).
//
// Docs: https://documentation.onesignal.com/reference/create-notification

const ONESIGNAL_APP_ID      = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

export interface PushPayload {
  recipientUserIds: string[];        // Supabase UUIDs
  title:   string;
  body:    string;
  data?:   Record<string, string>;   // extra data passed to the app on tap
}

/**
 * Sends a push notification to one or more users via OneSignal.
 * Targets by external_id (= Supabase user UUID) so no device tokens
 * need to be stored — OneSignal manages that automatically.
 */
export async function sendPush(payload: PushPayload): Promise<{ ok: boolean; error?: string }> {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.warn("[OneSignal] ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY not set");
    return { ok: false, error: "OneSignal not configured" };
  }

  if (!payload.recipientUserIds.length) {
    return { ok: true };   // nothing to do
  }

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,

        // Target specific users by their Supabase UUID (set via OneSignal.login())
        include_aliases:  { external_id: payload.recipientUserIds },
        target_channel:   "push",

        headings: { en: payload.title },
        contents: { en: payload.body  },

        // Custom data — available in the notification tap handler
        data: payload.data ?? {},

        // iOS-specific: show badge count
        ios_badgeType:  "Increase",
        ios_badgeCount: 1,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[OneSignal] send failed:", JSON.stringify(json));
      return { ok: false, error: JSON.stringify(json) };
    }

    // Log recipients count — "0" means no subscribed devices matched the external_id
    console.log("[OneSignal] send ok — recipients:", json.recipients, "id:", json.id, "errors:", JSON.stringify(json.errors));
    return { ok: true };
  } catch (err: any) {
    console.error("[OneSignal] fetch error:", err);
    return { ok: false, error: err.message };
  }
}
