// ── SayIt Contacts Utility ────────────────────────────────────────────────
// Wraps @capacitor-community/contacts with permission handling, phone
// normalisation, and SayIt-profile matching.
//
// On Android, the Capacitor JS bridge can be unreliable when loading from a
// remote Vercel URL. As a fallback, MainActivity.java reads contacts natively
// and injects them via window.__sayitNativeContacts + window.__sayitContactsGranted.
// This file checks those globals first before falling back to the bridge.

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

function phoneVariants(normalized: string): string[] {
  const digits = normalized.replace(/\D/g, "");
  const variants = new Set<string>();
  variants.add(normalized);
  variants.add(digits);

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

  if (digits.length === 10) {
    variants.add(`+1${digits}`);
    variants.add(`1${digits}`);
    variants.add(`+91${digits}`);
    variants.add(`91${digits}`);
    variants.add(`+44${digits}`);
    variants.add(`44${digits}`);
  }
  if (digits.length === 11 && !digits.startsWith("1")) {
    variants.add(`+86${digits}`);
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
  // Fast-path: check the native flag injected by MainActivity (Android).
  // This bypasses the Capacitor JS bridge which can be unreliable for remote URLs.
  if (typeof window !== "undefined" && (window as any).__sayitContactsGranted === true) {
    return "granted";
  }
  try {
    const { Contacts } = await import("@capacitor-community/contacts");
    const result = await Contacts.checkPermissions();
    if (result.contacts === "granted" && typeof window !== "undefined") {
      (window as any).__sayitContactsGranted = true;
    }
    return result.contacts as "granted" | "denied" | "prompt";
  } catch {
    return "prompt";
  }
}

export async function requestContactsPermission(): Promise<boolean> {
  try {
    const { Contacts } = await import("@capacitor-community/contacts");
    const result = await Contacts.requestPermissions();
    if (result.contacts === "granted" && typeof window !== "undefined") {
      (window as any).__sayitContactsGranted = true;
    }
    return result.contacts === "granted";
  } catch {
    return false;
  }
}

// ── Load device contacts ──────────────────────────────────────────────────
// Checks for natively-injected contacts first (Android fallback),
// then falls back to the Capacitor bridge (iOS + Android when bridge works).

export async function loadDeviceContacts(force = false): Promise<DeviceContact[]> {
  if (_deviceContacts && !force) return _deviceContacts;

  // ── Android native fallback: contacts injected by MainActivity.java ──────
  if (typeof window !== "undefined") {
    const native = (window as any).__sayitNativeContacts;
    if (Array.isArray(native) && native.length > 0) {
      const result: DeviceContact[] = [];
      for (const c of native) {
        const name = c.displayName || "";
        if (!name) continue;
        const phones = Array.from(new Set(
          (c.phones || [])
            .map((p: string) => normalizePhone(p))
            .filter((p: string) => p.length >= 8)
        )) as string[];
        if (phones.length === 0) continue;
        result.push({ displayName: name, phones });
      }
      _deviceContacts = result;
      return result;
    }
  }

  // ── Capacitor bridge (iOS + Android when bridge is available) ────────────
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
    _deviceContacts = null;
    return [];
  }
}

// ── Match device contacts against SayIt profiles ─────────────────────────

export async function matchContactsWithSayIt(
  deviceContacts: DeviceContact[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<SayItContact[]> {
  if (deviceContacts.length === 0) return [];

  const allVariants = new Set<string>();
  for (const c of deviceContacts) {
    for (const p of c.phones) {
      for (const v of phoneVariants(p)) allVariants.add(v);
    }
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, phone, full_name")
    .in("phone", Array.from(allVariants))
    .not("phone", "is", null);

  const profileMap = new Map<string, { id: string; name: string }>();
  for (const p of (profiles ?? [])) {
    if (!p.phone) continue;
    for (const v of phoneVariants(p.phone)) {
      profileMap.set(v, { id: p.id, name: p.full_name ?? "" });
    }
  }

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
