# SayIt — Security & Performance Audit

**Audit date:** May 2026  
**Auditor:** Claude (Anthropic)  
**Scope:** Full backend API routes, client-side auth flow, realtime subscriptions, cron jobs

All findings below have been **fixed and committed** to the `main` branch.

---

## Security Fixes

### CRITICAL

| ID | File | Issue | Fix Applied |
|----|------|-------|-------------|
| C-1 | `src/app/api/circle/action/route.ts` | No auth guard — any unauthenticated caller could trigger circle actions | Added Bearer token check; verified user is the actual recipient |
| C-2 | `src/app/api/circle/resolve/route.ts` | No auth guard — caller could resolve circle requests for any user | Added Bearer token check; asserted `user.id === userId` |
| C-3 | `src/app/api/circle/status/route.ts` | No auth guard — relationship status readable by anyone | Added Bearer token check; verified caller is a party to the relationship |
| C-4 | `src/app/api/generate-ai-card/route.ts` | `userId` was taken from untrusted `formData` — attacker could generate cards as any user | Added Bearer token check; `userId` now derived from server-verified `getUser()` only |

### HIGH

| ID | File | Issue | Fix Applied |
|----|------|-------|-------------|
| H-1 | `src/app/api/otp/send/route.ts` & `send-signin/route.ts` | No rate limiting — OTP endpoints could be abused to spam any phone number | Created `src/lib/otp-rate-limit.ts` (in-memory Map); 3 sends/phone/10 min, 10 sends/IP/10 min |
| H-2 | `src/app/api/otp/verify/route.ts` | Auth token was optional — profile could be written without a valid session | Auth token is now always required; returns 401 if missing |
| H-3 | `src/app/api/card/[code]/route.ts` | `select("*")` exposed all columns (including PII) on a public endpoint; used service role key unnecessarily | Replaced with explicit safe column list; removed service role key |
| H-4 | `src/app/api/clear-history/route.ts` | Hard-deleted all cards where `recipient_phone` matched — could erase other users' cards | Now only hard-deletes cards where `sender_id = user.id` |
| H-5 | `src/app/api/cron/send-scheduled/route.ts` | Cron secret compared with `===` (timing-side-channel attack possible) | Replaced with `crypto.timingSafeEqual` |
| H-6 | `src/app/(app)/layout.tsx` | `getSession()` used as auth gate (only validates locally, does not verify with server) | Removed `getSession()` fallback; rely solely on `getUser()` which verifies with Supabase server |

### LOW

| ID | File | Issue | Fix Applied |
|----|------|-------|-------------|
| L-4 | `src/app/api/push/react/route.ts` | No check that the reactor is the actual card recipient — any authenticated user could react | Added verification: reactor must be the `recipient_id` or match `recipient_phone` |
| L-5 | `src/app/(app)/layout.tsx` | Native bridge `__sayitHandleNav` accepted any URL string — open-redirect risk | Added `url.startsWith("/")` guard before calling `router.push` |

---

## Performance Fixes

### MEDIUM

| ID | File | Issue | Fix Applied |
|----|------|-------|-------------|
| M-1/M-2 | `src/app/(app)/layout.tsx` | 5 sequential DB queries on every page navigation for badge dots; duplicate `profiles` query | Removed duplicate query; badge count queries (`incomingDot`, `wishesDot`, `card_reactions`) now run in parallel via `Promise.all` |
| M-3 | `src/app/(app)/circle/page.tsx` | `sentCards`, `profileData`, and `blocked_contacts` fetched sequentially | All three now fired in parallel via `Promise.all` |
| M-5 | `src/app/(app)/history/page.tsx` | Every realtime reaction event triggered a fresh DB query to recount emojis | Replaced with payload-delta updates: INSERT increments, DELETE decrements — zero extra DB queries |
| M-6 | `src/app/(app)/home/page.tsx` | `select("*")` fetched all profile columns | Replaced with `select("full_name, phone, avatar_url, email")` |
| M-8 | `src/app/oauth-handler.tsx` | Raw internal error message reflected into `?oauthError=` URL param (info-leak / reflected-XSS risk) | Replaced with generic `?oauthError=1` code |

### LOW

| ID | File | Issue | Fix Applied |
|----|------|-------|-------------|
| L-3 | `src/app/api/cron/send-scheduled/route.ts` | N+1 pattern: sender profile, recipient profile, and templates fetched individually per schedule inside the loop | Pre-batched all three lookups before the loop in 3 queries total (regardless of how many schedules fire) |

---

## Feature Fixes (same session)

These were product bugs fixed alongside the audit:

| Area | Issue | Fix |
|------|-------|-----|
| Google OAuth (iOS/Android) | After OAuth exchange, `router.replace("/home")` caused a race with Supabase session hydration — users landed back on sign-in | Changed to `window.location.href = "/home"` (full reload) so Supabase re-reads the persisted session from storage |
| Duplicate accounts | Registering with Google then adding a phone that was already registered created two Supabase auth users | OTP send now checks `profiles.phone` first; if phone exists, sends a sign-in OTP and uses `supabase.auth.verifyOtp()` to create a session for the existing phone account directly — no duplicate user created |
| Email not saved | Google email never persisted to `profiles` table | `otp/verify` now accepts and saves `email`; Google email captured before sign-out and written to the phone user's profile |
| Missing profile row | If a profile row was manually deleted the app was stuck (no redirect to login) | `layout.tsx` check() now detects missing profile: recreates it for phone-auth users, signs out Google-only users |
| Spinner alignment | Loading spinner on Circle and Profile pages was misaligned (top of screen) | Changed from `minHeight: "100%"` to `flex-1 flex items-center justify-center` which works correctly in a flex-column parent |
| Character counter | "0/300" counter visible in card note panel | Removed the `<p>` element from `custom-card/[slug]/page.tsx` |

---

## SQL run in Supabase

```sql
-- Add email column to profiles (for Google login email persistence)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Ensure phone uniqueness (prevent duplicate accounts per phone)
-- 1. Remove duplicate phone rows (keep the oldest)
DELETE FROM profiles
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at) AS rn
    FROM profiles
    WHERE phone IS NOT NULL
  ) t
  WHERE rn > 1
);

-- 2. Add unique constraint
ALTER TABLE profiles ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);
```

---

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/otp-rate-limit.ts` | In-memory rate limiter for OTP endpoints |
| `src/app/api/otp/send-signin/route.ts` | Sends OTP for sign-in to already-registered phones |

---

## Notes for Future Development

- **Never use `getSession()` as an auth gate** on server-side or layout-level checks. Always use `getUser()` which validates the token with the Supabase server.
- **Always derive `userId` server-side** from `getUser()` — never trust it from request body/form data.
- **Rate-limit any endpoint** that triggers external services (SMS, email, push).
- **OTP send flow** checks `profiles.phone` before calling Twilio — if phone exists, it switches to sign-in OTP flow automatically.
- The `profiles_phone_unique` constraint is the source of truth for preventing duplicate phone registrations. Handle error code `23505` on upsert.
