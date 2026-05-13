import { createBrowserClient } from "@supabase/ssr";

// ── Capacitor Preferences via runtime bridge ──────────────────────────────
// We deliberately do NOT statically import @capacitor/preferences because
// the package is ESM-only and causes webpack "Module not found" errors on
// Vercel. Instead we reach into window.Capacitor.Plugins.Preferences, which
// the Capacitor bridge injects before any page JS runs in WKWebView.
// On plain web (no bridge) this is undefined and we fall back to localStorage.

interface CapPrefs {
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
}

function getPrefs(): CapPrefs | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (typeof window !== "undefined" && (window as any).Capacitor?.Plugins?.Preferences) || null;
  } catch {
    return null;
  }
}

const nativeStorage = {
  // Read: Preferences first (persistent UserDefaults), then localStorage as backup.
  // We fall through to localStorage even when Preferences returns null — this covers
  // the race where the Capacitor bridge isn't ready yet on cold start, so a previous
  // write landed in localStorage instead of Preferences.
  getItem: async (key: string): Promise<string | null> => {
    const prefs = getPrefs();
    if (prefs) {
      try {
        const { value } = await prefs.get({ key });
        if (value !== null) return value; // found in Preferences ✓
        // Preferences returned null — might be a cold-start bridge timing issue;
        // fall through to check localStorage as a redundant backup.
      } catch { /* fall through */ }
    }
    try { return localStorage.getItem(key); } catch { return null; }
  },

  // Write: save to BOTH storages so there's always a backup.
  // If the bridge isn't ready on first write, localStorage ensures the session
  // survives until the next write (when the bridge is definitely up).
  setItem: async (key: string, value: string): Promise<void> => {
    const prefs = getPrefs();
    if (prefs) {
      try { await prefs.set({ key, value }); } catch { /* non-fatal */ }
    }
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },

  // Remove: clean up both storages so stale data doesn't linger.
  removeItem: async (key: string): Promise<void> => {
    const prefs = getPrefs();
    if (prefs) {
      try { await prefs.remove({ key }); } catch { /* non-fatal */ }
    }
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

// ── Singleton Supabase client ─────────────────────────────────────────────
// CRITICAL: every call to createClient() must return the SAME instance.
// Multiple instances = multiple independent auth states.
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (typeof window === "undefined") {
    // SSR: fresh client without custom storage (no window/Preferences on server)
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  if (_client) return _client;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isNative = (window as any).Capacitor?.isNativePlatform?.() ?? false;

  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: nativeStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Don't try to parse tokens from the URL on native — OTP arrives
        // via SMS, not a redirect URL.
        detectSessionInUrl: !isNative,
      },
    }
  );

  return _client;
}
