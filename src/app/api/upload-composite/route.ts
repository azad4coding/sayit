import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Supabase admin client (server-side only) ────────────────────────────────
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Upload composited card image to Supabase Storage ────────────────────────
// Called by the client after it has composited the user's photo onto the
// DALL-E 3 background locally. Accepts a JPEG blob and returns a permanent URL.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const userId = formData.get("userId") as string;
    const image  = formData.get("image")  as File | null;

    if (!userId || !image) {
      return NextResponse.json({ error: "Missing userId or image" }, { status: 400 });
    }

    const buffer = await image.arrayBuffer();
    const path   = `ai-cards/${userId}/${Date.now()}_composite.jpg`;

    const { error } = await supabaseAdmin.storage
      .from("card-images")
      .upload(path, Buffer.from(buffer), { contentType: "image/jpeg", upsert: false });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data } = supabaseAdmin.storage.from("card-images").getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });

  } catch (err: unknown) {
    console.error("upload-composite error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
