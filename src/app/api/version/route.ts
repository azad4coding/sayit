import { NextResponse } from "next/server";

// Lightweight endpoint that returns the current deployment version.
// The Capacitor app calls this on each launch; if the version differs
// from what's stored in localStorage it reloads once to bust the
// WebView's stale JS/CSS cache.
export const dynamic = "force-dynamic";

export async function GET() {
  // NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is set automatically by Vercel on
  // every deployment. Fall back to build timestamp if not on Vercel.
  const v =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
    Date.now().toString();

  return NextResponse.json({ v }, {
    headers: { "Cache-Control": "no-store" },
  });
}
