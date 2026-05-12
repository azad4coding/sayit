# SayIt — AI Coding Agent Session
**Tool:** Claude (Cowork mode)  
**Project:** SayIt — Digital greeting cards for Gen Z  
**Stack:** Next.js 14, TypeScript, Supabase, Framer Motion, Tailwind CSS  
**Session:** Full product sprint — bugs, features, architecture, security

---

## What We Built Together

This session covers a complete product sprint on SayIt — a greeting card app that lets users send beautiful digital cards to anyone via WhatsApp, SMS, or directly within the app (SayIt-to-SayIt). Below is everything built, fixed, and shipped in this session.

---

## 1. Bug Fixes (4 simultaneous)

**Problem:** Four bugs identified at once:
- Paw Moments card opening animation using wrong frame
- Vibes card flashing briefly as a regular card on load
- AI card badge incorrectly showing "Couple Card" instead of "AI Card"
- No phone number validation before sending a card

**Fix:** Updated `src/app/preview/[code]/page.tsx` and `src/app/(app)/send/page.tsx`:
- Fixed frame reference in paw animation
- Added `(!card?.template_id || dbCategory)` guard to prevent Vibes flash
- Changed badge label to `"✨ AI Card"`
- Added `phoneError` state with digit-length validation before send

---

## 2. Card Opening Animation Overhaul

**Problem:** Card opening animation was broken on iOS — attempted a 3D `rotateY` flip but `backfaceVisibility` without WebKit prefix caused the cover to stay visible at -180°. Also, the message panel rendered underneath the cover causing a millisecond flash.

**Solution:** Switched from 3D flip to an `AnimatePresence` two-state approach:
- **Closed state:** Full card image (310×413px, 3:4 ratio) with tap-to-open
- **Open state:** Original two-panel layout (left decoration + right message)
- Crossfade transition between states eliminates flash entirely

```tsx
<AnimatePresence mode="wait">
  {!isOpening ? (
    <motion.div key="closed" onClick={handleCardOpen}>
      {/* Full card image */}
    </motion.div>
  ) : (
    <motion.div key="open" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Two-panel: LEFT (decoration) + RIGHT (message) */}
    </motion.div>
  )}
</AnimatePresence>
```

---

## 3. Deferred Card Save (WhatsApp Validation Strategy)

**Problem:** Cards were being saved to the database immediately when the user tapped "Send", even before the WhatsApp/SMS link was actually delivered. This meant invalid sends appeared in history.

**Architecture decision:** Implemented Option A — defer DB save until user actually taps WA/SMS button.

**Implementation in `send/page.tsx`:**
- Added `pendingPayload`, `pendingCircle`, `cardSaved` states
- `handleSend()` stages the payload but doesn't insert
- `saveCardNow()` called only when WhatsApp or SMS button is tapped
- `cancelSend()` is now instant — nothing to clean up

**SayIt-to-SayIt exception:** When recipient is already on SayIt (`foundUser` is set), card saves immediately so recipient sees it in real-time.

---

## 4. Custom Card Fixes (3 issues)

**Custom card image not showing in closed state:**
```js
const coverUrl = isMeme ? card?.meme_image_url 
  : (isPaw || isCustom) ? card?.paw_photos?.[0] 
  : cardImageUrl;
```

**History thumbnail showing opened state instead of closed:**
```js
} else if (card.card_type === "paw-moments" || card.card_type === "custom-card") {
  imgUrl = card.paw_photos?.[0] ?? null;
}
```

**Custom signature not saving:**
- Template cards: pass via URL param `&signature=...`
- Paw/custom cards: pass via `sessionStorage.setItem("card_signature", ...)`
- Send page reads both and uses custom signature as `sender_name` in DB

---

## 5. My Circle — New Bottom Nav Tab

**Feature:** Moved "My Circle" from profile page to a dedicated bottom nav tab.

**Problem discovered:** Original circle logic queried only the `circles` table, missing contacts sent cards before they joined SayIt (external WhatsApp sends where `recipient_id` was null).

**Fix:** Rewrote Circle page to derive contacts from `sent_cards` directly:
- Queries all unique recipients by phone from `sent_cards` (sent direction)
- Also queries all senders from received cards
- Groups by phone, counts cards per contact
- Green dot indicates contact is on SayIt
- Shows card count per person

**Nav updated:** Home · Wishes · Chats · Gifts · Circle · Profile (6 tabs)

---

## 6. Red Notification Badge (Facebook-style)

**Feature:** Real-time red notification count on Chats tab for:
- New cards received (incoming `sent_cards` inserts where `recipient_id = user.id`)
- New reactions on cards the user sent

**Implementation in `layout.tsx`:**
- On mount: loads unread count since `lastSeenChats_{userId}` localStorage timestamp
- Real-time Supabase subscription on `sent_cards` INSERT filtered by `recipient_id`
- Clears badge + updates timestamp when user visits `/history`
- Solid red `#E53935` badge with drop shadow, supports 99+

---

## 7. Web Push Notifications

**Full implementation from scratch:**

**Files created:**
- `public/sw.js` — Service worker handles push events, notification clicks, opens card URL
- `public/manifest.json` — PWA manifest for mobile push support
- `src/lib/webpush.ts` — VAPID-configured web-push helper
- `src/app/api/push/subscribe/route.ts` — Saves user's push subscription to `push_subscriptions` table
- `src/app/api/push/send/route.ts` — Sends push notification to recipient

**Flow:**
1. User opens app → SW registered → browser requests notification permission
2. Subscription saved to Supabase `push_subscriptions` table (upsert by user_id)
3. When User A sends card to User B (SayIt-to-SayIt), `send/page.tsx` fires:
```js
fetch("/api/push/send", {
  method: "POST",
  body: JSON.stringify({ recipientId: foundUser.id, senderName: name, cardCode: code }),
});
```
4. Server looks up recipient's subscription, sends via web-push
5. User B receives phone notification: "💌 You received a card! — [Name] sent you something special"
6. Tapping notification opens the card directly

---

## 8. Security — Leaked API Key

**Incident:** OpenAI API key committed in `.env.local` which was not in `.gitignore`. When repo was made public for YC, GitHub's secret scanner flagged it to OpenAI who disabled the key.

**Fix:**
```bash
echo ".env.local" >> .gitignore
echo ".env*.local" >> .gitignore
git rm --cached .env.local
git add .gitignore
git commit -m "fix: remove .env.local from git tracking"
```
New key generated and added to Vercel environment variables only.

---

## 9. Login Flow Improvements

- Removed "You received a card!" banner from login page
- Both OTP and Google OAuth now always redirect to `/home` after auth
- Recipient finds card in Chats tab with red notification badge

---

## 10. Clear History Fix

**Bug:** "Clear All History" only deleted cards where `sender_id = userId`, missing received cards matched by phone number.

**Fix:** Now deletes by all three conditions:
```js
await supabase.from("sent_cards").delete().eq("sender_id", userId);
await supabase.from("sent_cards").delete().eq("recipient_id", userId);
await supabase.from("sent_cards").delete().eq("recipient_phone", myPhone);
```

---

## Architecture Highlights

- **SayIt-to-SayIt vs External:** Single branch point at `if (foundUser)` in send flow. Registered users get instant delivery + push notification. External recipients get WhatsApp/SMS share sheet.
- **Deferred save pattern:** Card data staged in React state, only persisted when delivery is confirmed
- **Real-time throughout:** Supabase postgres_changes subscriptions for badges, reactions, incoming cards
- **Phone-first identity:** All matching handles `+91...`, `91...`, and local formats

---

## Commits Shipped This Session

```
feat: move My Circle to dedicated bottom nav tab
feat: restore Gift Cards tab, remove My Circle from profile  
feat: red notification badge on Chats tab
feat: web push notifications for incoming cards
fix: derive Circle from sent_cards instead of circles table
fix: clearHistory deletes by sender_id, recipient_id AND recipient_phone
fix: remove card banner from login, always redirect to /home after auth
fix: replace Set spread with Array.from for TS downlevel compat
fix: remove .env.local from git tracking, add to gitignore
```

---

## About SayIt

SayIt is a digital greeting card platform for Gen Z — beautiful cards delivered directly to anyone's phone via WhatsApp or SMS, with SayIt-to-SayIt direct delivery for registered users. Features include romance cards, Paw Moments (pet photo cards), AI card generation, gift cards, and a social layer (My Circle, reactions, card history).

**GitHub:** github.com/azad4coding/sayit  
**Stack:** Next.js 14 · TypeScript · Supabase · Framer Motion · Tailwind · Vercel
