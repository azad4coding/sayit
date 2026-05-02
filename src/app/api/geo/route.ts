import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export function GET(req: NextRequest) {
  const country = req.geo?.country ?? req.headers.get("x-vercel-ip-country") ?? "US";
  return NextResponse.json({ country });
}
