-- ─────────────────────────────────────────────────────────────────────────────
-- SayIt · blocked_contacts
-- Run this in the Supabase SQL editor (project → SQL editor → New query).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blocked_contacts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_phone   text        NOT NULL,            -- normalised "+<digits>"
  blocked_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- A user can only block a given phone number once
  CONSTRAINT blocked_contacts_unique UNIQUE (blocker_id, blocked_phone)
);

-- Index for fast "is this phone blocked by user X?" lookups
CREATE INDEX IF NOT EXISTS blocked_contacts_blocker_phone_idx
  ON public.blocked_contacts (blocker_id, blocked_phone);

-- Index for reverse lookup: "who has blocked user Y?"
CREATE INDEX IF NOT EXISTS blocked_contacts_blocked_user_idx
  ON public.blocked_contacts (blocked_user_id)
  WHERE blocked_user_id IS NOT NULL;

-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.blocked_contacts ENABLE ROW LEVEL SECURITY;

-- Users can read only their own block list
CREATE POLICY "blocked_contacts: owner can read"
  ON public.blocked_contacts
  FOR SELECT
  USING (auth.uid() = blocker_id);

-- Users can add to their own block list
CREATE POLICY "blocked_contacts: owner can insert"
  ON public.blocked_contacts
  FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

-- Users can remove their own blocks (unblock)
CREATE POLICY "blocked_contacts: owner can delete"
  ON public.blocked_contacts
  FOR DELETE
  USING (auth.uid() = blocker_id);

-- ── 3. Security-definer helper: is_blocked() ──────────────────────────────────
-- Called from server-side logic (API routes / edge functions) to check whether
-- a given sender is blocked by a given recipient BEFORE delivering a card.
--
-- Usage:
--   SELECT public.is_blocked(
--     sender_id   := '<sender uuid>',
--     sender_phone := '+91XXXXXXXXXX',
--     recipient_id := '<recipient uuid>'
--   );
--
-- Returns TRUE  → block exists; card must NOT be delivered in-app.
-- Returns FALSE → no block; delivery can proceed normally.

CREATE OR REPLACE FUNCTION public.is_blocked(
  sender_id    uuid,
  sender_phone text,
  recipient_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER          -- runs as the function owner, bypasses RLS
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blocked_contacts bc
    WHERE bc.blocker_id = recipient_id
      AND (
        bc.blocked_user_id = sender_id          -- blocked by Supabase user id
        OR bc.blocked_phone = sender_phone      -- blocked by phone (covers non-registered senders)
      )
  );
$$;

-- Grant execute only to authenticated users (called via supabase.rpc())
REVOKE ALL ON FUNCTION public.is_blocked(uuid, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_blocked(uuid, text, uuid) TO authenticated;

-- ── 4. sent_cards guard (optional server-side enforcement) ────────────────────
-- This trigger prevents in-app card insertion when the sender is blocked.
-- It fires BEFORE INSERT on sent_cards when recipient_id is set.
-- Cards without a recipient_id (unregistered recipients, WhatsApp/SMS flow)
-- are never blocked here — the client-side check already forces the share sheet.

CREATE OR REPLACE FUNCTION public.check_not_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when there is a known registered recipient
  IF NEW.recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_blocked(
       sender_id    := NEW.sender_id,
       sender_phone := (SELECT phone FROM public.profiles WHERE id = NEW.sender_id),
       recipient_id := NEW.recipient_id
     ) THEN
    RAISE EXCEPTION 'blocked'
      USING HINT = 'The recipient has blocked this sender.', ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to sent_cards (idempotent: drop first if it exists)
DROP TRIGGER IF EXISTS trg_check_not_blocked ON public.sent_cards;

CREATE TRIGGER trg_check_not_blocked
  BEFORE INSERT ON public.sent_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.check_not_blocked();

-- ── 5. Verify ─────────────────────────────────────────────────────────────────
-- Run these selects after applying the migration to confirm everything landed:
--
--   SELECT * FROM public.blocked_contacts LIMIT 1;
--   SELECT proname FROM pg_proc WHERE proname = 'is_blocked';
--   SELECT tgname  FROM pg_trigger WHERE tgname = 'trg_check_not_blocked';
