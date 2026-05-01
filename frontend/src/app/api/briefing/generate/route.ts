import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const upstream = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      console.error("[briefing/generate] upstream error", upstream.status, data);
      return NextResponse.json(data, { status: upstream.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("[briefing/generate] fetch error", e);
    return NextResponse.json({ error: "upstream failed" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
