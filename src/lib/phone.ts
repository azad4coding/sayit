// ── Phone utilities ───────────────────────────────────────────────────────────

/**
 * Ensures a phone string starts with "+".
 * Returns an empty string (never null) when input is falsy or has no digits.
 */
export function ensurePlus(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return `+${digits}`;
}

/**
 * Combines a country code (e.g. "+91") with a local number and returns
 * a normalised E.164-style string: "+<countryDigits><localDigits>".
 * Used by the register page to build the full phone before saving to Supabase.
 */
export function normalizePhone(countryCode: string, localNumber: string): string {
  const ccDigits    = countryCode.replace(/\D/g, "");
  const localDigits = localNumber.replace(/\D/g, "");
  if (!ccDigits || !localDigits) return "";
  return `+${ccDigits}${localDigits}`;
}
