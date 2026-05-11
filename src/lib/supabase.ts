import { createBrowserClient } from "@supabase/ssr";
import { Preferences } from "@capacitor/preferences";

// ── Capacitor-aware Supabase storage adapter ──────────────────────────────
// @capacitor/preferences is statically imported so webpack bundles it.
// When running inside a Capacitor native app, the Capacitor bridge
// automatically routes Preferences calls to the native implementation
// (UserDefaults on iOS, SharedPreferences on Android), which persist
// across app restarts. On plain web, Preferences falls back to
// localStorage automatically — no isNative check needed.
//
// This replaces all previous approaches (dynamic import / window.Capacitor
// polling) which both had timing issues in remote-URL WKWebView.

const nativeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const { value } = await Preferences.get({ key });
      return value ?? null;
    } catch {
      try { return localStorage.getItem(key); } catch { return null; }
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await Preferences.set({ key, value });
    } catch {
      try { localStorage.setItem(key, value); } catch { /* ignore */ }
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await Preferences.remove({ key });
    } catch {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
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
