// ── SayIt Contacts Utility ────────────────────────────────────────────────
// Wraps @capacitor-community/contacts with permission handling, phone
// normalisation, and SayIt-profile matching.
//
// The plugin is loaded dynamically so the web/SSR build never touches it.
// All functions fail gracefully (return []/false) if permission is denied
// or the plugin isn't available (web browser).

export interface DeviceContact {
  displayName: string;
  phones: string[];       // normalised: always "+<digits>"
}

export interface SayItContact extends DeviceContact {
  userId: string | null;  // Supabase user id if registered on SayIt
  onSayIt: boolean;
  primaryPhone: string;   // the phone that matched the SayIt profile
}

// ── Phone normalisation ───────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return "";
  return `+${digits}`;
}

// Build the set of variants we'll try when matching against Supabase.
//
// The core problem: iOS often stores contacts WITHOUT a country code prefix,
// so a number like +91 9876543210 is saved as just "9876543210" (10 digits).
// Supabase profiles are stored in full E.164 (+919876543210). We must bridge that gap
// in both directions:
//   A) profile has E.164, contact has bare digits → add country prefix to contact
//   B) contact has E.164, profile has bare digits → strip country prefix from contact
//
// We also handle the China edge case: 11-digit Chinese mobile numbers start with 1
// (e.g. 13812345678), which is ambiguous with US 11-digit (+1 + 10 digits).
// We conservatively add variants for both interpretations.
function phoneVariants(normalized: string): string[] {
  const digits = normalized.replace(/\D/g, "");
  const variants = new Set<string>();
  variants.add(normalized);   // "+91..." or "+1..." — the normalised form
  variants.add(digits);       // "91..." or "1..."   — bare digits

  // ── Direction B: strip country prefix → bare local number ───────────────
  if (digits.length === 12 && digits.startsWith("91")) variants.add(digits.slice(2));  // India
  if (digits.length === 12 && digits.startsWith("44")) variants.add(digits.slice(2));  // UK
  if (digits.length === 12 && digits.startsWith("86")) variants.add(digits.slice(2));  // China
  if (digits.length === 13 && digits.startsWith("86")) variants.add(digits.slice(2));  // China (13-digit)
  if (digits.length === 11 && digits.startsWith("1"))  variants.add(digits.slice(1));  // US/Canada
  if (digits.length === 11 && digits.startsWith("7"))  variants.add(digits.slice(1));  // Russia
  if (digits.length === 12 && digits.startsWith("61")) variants.add(digits.slice(2));  // Australia
  if (digits.length === 12 && digits.startsWith("65")) variants.add(digits.slice(2));  // Singapore
  if (digits.length === 12 && digits.startsWith("60")) variants.add(digits.slice(2));  // Malaysia
  if (digits.length === 12 && digits.startsWith("92")) variants.add(digits.slice(2));  // Pakistan
  if (digits.length === 12 && digits.startsWith("49")) variants.add(digits.slice(2));  // Germany (approx)

  // ── Direction A: bare local → add country prefix ─────────────────────────
  // 10-digit bare numbers — most common iOS omission
  if (digits.length === 10) {
    variants.add(`+1${digits}`);    // US / Canada  (+1 XXXXXXXXXX)
    variants.add(`1${digits}`);
    variants.add(`+91${digits}`);   // India        (+91 XXXXXXXXXX)
    variants.add(`91${digits}`);
    variants.add(`+44${digits}`);   // UK           (+44 XXXXXXXXXX) — rare but possible
    variants.add(`44${digits}`);
  }
  // 11-digit bare numbers — Chinese mobile (13x, 14x, 15x, 17x, 18x, 19x)
  if (digits.length === 11 && !digits.startsWith("1")) {
    // Non-US 11-digit (US 11-digit already handled above via strip-1)
    variants.add(`+86${digits}`);   // China
    variants.add(`86${digits}`);
  }

  return Array.from(variants);
}

// ── In-memory cache (cleared on sign-out) ────────────────────────────────

let _deviceContacts: DeviceContact[] | null = null;
let _permissionChecked = false;

export function clearContactsCache() {
  _deviceContacts = null;
  _permissionChecked = false;
}

// ── Permission ────────────────────────────────────────────────────────────

export async function checkContactsPermission(): Promise<"granted" | "denied" | "prompt"> {
  try {
    const { Contacts } = await import("@capacitor-community/contacts");
    const result = await Contacts.checkPermissions();
    return result.contacts as "granted" | "denied" | "prompt";
  } catch {
    // Plugin not available (web browser) or bridge not ready — treat as prompt
    // so requestContactsPermission is still attempted on native
    return "prompt";
  }
}

export async function requestContactsPermission(): Promise<boolean> {
  try {
    const { Contacts } = await import("@capacitor-community/contacts");
    const result = await Contacts.requestPermissions();
    return result.contacts === "granted";
  } catch {
    return false;
  }
}

// ── Load device contacts ──────────────────────────────────────────────────
// Returns all contacts that have at least one valid phone number.
// Result is cached in memory for the session.

export async function loadDeviceContacts(force = false): Promise<DeviceContact[]> {
  if (_deviceContacts && !force) return _deviceContacts;

  try {
    const { Contacts } = await import("@capacitor-community/contacts");
    const { contacts } = await Contacts.getContacts({
      projection: { name: true, phones: true },
    });

    const result: DeviceContact[] = [];
    for (const c of contacts) {
      const name =
        c.name?.display ||
        (c.name?.given ? `${c.name.given} ${c.name?.family ?? ""}`.trim() : "") ||
        "";
      if (!name) continue;

      const phones = Array.from(
        new Set(
          (c.phones ?? [])
            .map((p: any) => normalizePhone(p.number ?? ""))
            .filter((p: string) => p.length >= 8)
        )
      );
      if (phones.length === 0) continue;

      result.push({ displayName: name, phones });
    }

    _deviceContacts = result;
    return result;
  } catch {
    // Don't cache failures — allow retries
    _deviceContacts = null;
    return [];
  }
}

// ── Match device contacts against SayIt profiles ─────────────────────────
// Batch-queries Supabase with all unique phone variants.
// Returns contacts enriched with SayIt registration info.

export async function matchContactsWithSayIt(
  deviceContacts: DeviceContact[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<SayItContact[]> {
  if (deviceContacts.length === 0) return [];

  // Collect every variant of every phone number
  const allVariants = new Set<string>();
  for (const c of deviceContacts) {
    for (const p of c.phones) {
      for (const v of phoneVariants(p)) allVariants.add(v);
    }
  }

  // Batch lookup — Supabase IN clause handles up to ~1000 values fine
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, phone, full_name")
    .in("phone", Array.from(allVariants))
    .not("phone", "is", null);

  // Build phone → profile map
  const profileMap = new Map<string, { id: string; name: string }>();
  for (const p of (profiles ?? [])) {
    if (!p.phone) continue;
    for (const v of phoneVariants(p.phone)) {
      profileMap.set(v, { id: p.id, name: p.full_name ?? "" });
    }
  }

  // Merge
  return deviceContacts.map((contact): SayItContact => {
    let matchedProfile: { id: string; name: string } | null = null;
    let primaryPhone = contact.phones[0] ?? "";

    for (const phone of contact.phones) {
      for (const v of phoneVariants(phone)) {
        const profile = profileMap.get(v);
        if (profile) {
          matchedProfile = profile;
          primaryPhone = phone;
          break;
        }
      }
      if (matchedProfile) break;
    }

    return {
      ...contact,
      userId: matchedProfile?.id ?? null,
      onSayIt: !!matchedProfile,
      primaryPhone,
    };
  });
}

// ── Convenience: permission → load → match in one call ───────────────────
// Used by the send page on first open.

export async function getOrRequestContacts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ granted: boolean; contacts: SayItContact[] }> {
  let status = await checkContactsPermission();

  if (status === "prompt") {
    _permissionChecked = true;
    const granted = await requestContactsPermission();
    status = granted ? "granted" : "denied";
  }

  if (status !== "granted") return { granted: false, contacts: [] };

  const device = await loadDeviceContacts();
  const enriched = await matchContactsWithSayIt(device, supabase);
  return { granted: true, contacts: enriched };
}
