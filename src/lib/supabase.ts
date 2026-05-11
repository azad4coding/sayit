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
  getItem: async (key: string): Promise<string | null> => {
    const prefs = getPrefs();
    if (prefs) {
      try {
        const { value } = await prefs.get({ key });
        return value ?? null;
      } catch { /* fall through to localStorage */ }
    }
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const prefs = getPrefs();
    if (prefs) {
      try { await prefs.set({ key, value }); return; } catch { /* fall through */ }
    }
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  },
  removeItem: async (key: string): Promise<void> => {
    const prefs = getPrefs();
    if (prefs) {
      try { await prefs.remove({ key }); return; } catch { /* fall through */ }
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
