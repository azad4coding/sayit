/**
 * phone.ts — E.164 phone number utilities
 *
 * Rules:
 *  - Always stored as `+[countryCode][localDigits]`  e.g. +919876543210
 *  - Local part must be 6–12 digits (covers all real-world formats)
 *  - Returns null if invalid so the caller can show an error
 */

/**
 * Combine a country-code picker value (+91, +1 …) with a raw local input
 * and return a normalised E.164 string, or null if invalid.
 */
export function normalizePhone(countryCode: string, local: string): string | null {
  const digits = local.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 12) return null;
  // Ensure country code always starts with +
  const cc = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;
  return `${cc}${digits}`;
}

/**
 * Normalise a raw phone string that may or may not already have a +.
 * Used when reading `user.phone` from Supabase Auth, which can omit the +.
 */
export function ensurePlus(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}
