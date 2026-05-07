import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// Anon client used only to verify the caller's JWT
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit

export async function POST(req: NextRequest) {
  try {
    // ── Auth guard ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const userId = formData.get("userId") as string;
    const image  = formData.get("image")  as File | null;

    if (!userId || !image) {
      return NextResponse.json({ error: "Missing userId or image" }, { status: 400 });
    }

    // Ensure authenticated user matches the userId in the request
    if (user.id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // File size guard
    if (image.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
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
