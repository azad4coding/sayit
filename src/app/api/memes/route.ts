import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://api.imgflip.com/get_memes", {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    return NextResponse.json({ memes: data.data.memes });
  } catch {
    return NextResponse.json({ memes: [] }, { status: 500 });
  }
}
