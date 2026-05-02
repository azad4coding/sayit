import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { locationName, locationCountry, locationEmoji } = await req.json();

    if (!locationName) {
      return NextResponse.json({ error: "locationName is required" }, { status: 400 });
    }

    const prompt = `You are a witty romantic copywriter for a digital greeting card app called SayIt.

Generate exactly 3 short, destination-specific romantic notes for a couple card set in ${locationName}, ${locationCountry} ${locationEmoji}.

Rules:
- Each note is 1 sentence, max 12 words
- Make each one feel different in tone: one poetic, one playful/punny, one heartfelt
- Reference something specific and iconic about ${locationName} (the scenery, vibe, food, culture, or a pun on the name)
- Never use generic phrases like "love is beautiful" or "you are my everything"
- No hashtags, no emojis in the text itself, no quotation marks in output
- Output ONLY a JSON array of 3 strings, nothing else

Example for Santorini:
["Our love is as timeless as these whitewashed views.", "You make every sunset feel like it was painted just for us.", "Falling for you harder than the cliffs of Oia."]`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.85,
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenAI error:", err);
      return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
    }

    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content?.trim() ?? "[]";

    // Parse the JSON array safely
    let notes: string[] = [];
    try {
      notes = JSON.parse(raw);
      if (!Array.isArray(notes)) notes = [];
    } catch {
      // Fallback: extract quoted strings if GPT wrapped them differently
      const matches = raw.match(/"([^"]+)"/g);
      notes = matches ? matches.map((s: string) => s.replace(/"/g, "")) : [];
    }

    // Ensure exactly 3 notes
    notes = notes.slice(0, 3);

    return NextResponse.json({ notes });
  } catch (err) {
    console.error("suggest-note error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
