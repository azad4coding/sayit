import { createBrowserClient } from "@supabase/ssr";

// ── Capacitor-aware Supabase storage adapter ──────────────────────────────
// On iOS, WKWebView does not reliably persist localStorage between app
// launches, which causes Supabase to lose the session and ask for OTP
// every time the app opens. We swap in @capacitor/preferences (backed by
// native UserDefaults/Keychain) when running inside a Capacitor native app.
// On web / Android (where localStorage persists fine) we fall through to the
// default behaviour.

function makeNativeStorage() {
  // Lazy-import so the web bundle is not affected at all
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Preferences: any = null;

  async function load() {
    if (!Preferences) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — @capacitor/preferences is installed at runtime on native
      const mod = await import("@capacitor/preferences");
      Preferences = mod.Preferences;
    }
    return Preferences;
  }

  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        const P = await load();
        const { value } = await P.get({ key });
        return value ?? null;
      } catch {
        return localStorage.getItem(key);
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        const P = await load();
        await P.set({ key, value });
      } catch {
        localStorage.setItem(key, value);
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        const P = await load();
        await P.remove({ key });
      } catch {
        localStorage.removeItem(key);
      }
    },
  };
}

// Singleton so every createClient() call shares the same storage instance
const nativeStorage = makeNativeStorage();

export function createClient() {
  // Detect native platform synchronously via the Capacitor global
  // (injected into WKWebView/Android WebView by the Capacitor runtime)
  const isNative =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Capacitor?.isNativePlatform?.();

  return createBrowserClient(
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
}
