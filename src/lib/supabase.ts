import { createBrowserClient } from "@supabase/ssr";

// ── Capacitor-aware Supabase storage adapter ──────────────────────────────
// On iOS, WKWebView does not reliably persist localStorage between app
// launches, which causes Supabase to lose the session and ask for OTP
// every time the app opens. We use window.Capacitor.Plugins.Preferences
// (backed by native UserDefaults/Keychain) when running inside a Capacitor
// native app. This avoids dynamic imports of bare npm specifiers which fail
// in remote-URL WKWebView contexts (browser can't resolve them at runtime).
// On web / Android (where localStorage persists fine) we fall through to the
// default behaviour.

// Cache the resolved plugin so we only poll once
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _preferences: any = null;

// Wait for window.Capacitor.Plugins.Preferences to be registered.
// The Capacitor bridge is injected before page scripts, but plugin
// registration can lag by a few milliseconds in remote-URL WKWebView.
// We poll every 25 ms, up to 2 seconds (80 × 25 ms).
// On non-native (web), isNativePlatform() is false → returns null instantly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function awaitPreferences(): Promise<any> {
  if (_preferences) return _preferences;

  // Not a native app — use localStorage instead
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(window as any)?.Capacitor?.isNativePlatform?.()) return null;

  for (let i = 0; i < 80; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const P = (window as any)?.Capacitor?.Plugins?.Preferences;
    if (P) { _preferences = P; return P; }
    await new Promise(r => setTimeout(r, 25));
  }

  // 2-second timeout — fall back to localStorage
  return null;
}

function makeNativeStorage() {
  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        const P = await awaitPreferences();
        if (!P) return localStorage.getItem(key);
        const { value } = await P.get({ key });
        return value ?? null;
      } catch {
        return localStorage.getItem(key);
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        const P = await awaitPreferences();
        if (!P) { localStorage.setItem(key, value); return; }
        await P.set({ key, value });
      } catch {
        localStorage.setItem(key, value);
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        const P = await awaitPreferences();
        if (!P) { localStorage.removeItem(key); return; }
        await P.remove({ key });
      } catch {
        localStorage.removeItem(key);
      }
    },
  };
}

// Singleton so every createClient() call shares the same storage instance
const nativeStorage = makeNativeStorage();

// ── Singleton Supabase client ─────────────────────────────────────────────
// CRITICAL: every call to createClient() must return the SAME instance.
// Multiple instances = multiple independent auth states = onAuthStateChange
// in layout.tsx fires on a different instance than getUser() elsewhere,
// causing the INITIAL_SESSION promise to never resolve → OTP on every open.
let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (typeof window === "undefined") {
    // SSR: always create a fresh client (no singleton on server)
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  if (_client) return _client;

  // Detect native platform synchronously via the Capacitor global
  // (injected into WKWebView/Android WebView by the Capacitor runtime)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isNative = (window as any).Capacitor?.isNativePlatform?.();

  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    isNative
      ? {
          auth: {
            storage: nativeStorage,
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        }
      : undefined
  );

  return _client;
}
