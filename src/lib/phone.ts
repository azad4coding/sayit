// ── Phone utilities ───────────────────────────────────────────────────────────

/**
 * Ensures a phone string starts with "+".
 * Returns an empty string (never null) when input is falsy or has no digits.
 */
export function ensurePlus(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return raw.trimStart().startsWith("+") ? `+${digits}` : `+${digits}`;
}
