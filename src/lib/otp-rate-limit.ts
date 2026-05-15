// In-memory OTP rate limiter
// Limits: 3 OTP sends per phone per 10 minutes, 10 per IP per 10 minutes.

const WINDOW_MS  = 10 * 60 * 1000; // 10 minutes
const PHONE_MAX  = 3;
const IP_MAX     = 10;

interface RateLimitEntry {
  count:     number;
  windowEnd: number;
}

const phoneMap = new Map<string, RateLimitEntry>();
const ipMap    = new Map<string, RateLimitEntry>();

function check(map: Map<string, RateLimitEntry>, key: string, max: number): boolean {
  const now  = Date.now();
  const entry = map.get(key);

  if (!entry || now >= entry.windowEnd) {
    // Start a new window
    map.set(key, { count: 1, windowEnd: now + WINDOW_MS });
    return true; // allowed
  }

  if (entry.count >= max) {
    return false; // rate limited
  }

  entry.count++;
  return true; // allowed
}

/** Returns true if the request is allowed, false if rate-limited. */
export function checkOtpRateLimit(phone: string, ip: string): boolean {
  const phoneOk = check(phoneMap, phone, PHONE_MAX);
  const ipOk    = check(ipMap,    ip,    IP_MAX);
  return phoneOk && ipOk;
}
