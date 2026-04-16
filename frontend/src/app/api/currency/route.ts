import { NextResponse } from "next/server";

const FALLBACK_KRW_RATE = 1400;

export async function GET() {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=KRW",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error(`frankfurter ${res.status}`);
    const data = (await res.json()) as { rates?: { KRW?: number } };
    const krw = data.rates?.KRW;
    if (typeof krw !== "number" || krw <= 0) throw new Error("invalid rate");
    return NextResponse.json({ krw, source: "frankfurter", fallback: false });
  } catch {
    return NextResponse.json({
      krw: FALLBACK_KRW_RATE,
      source: "fallback",
      fallback: true,
    });
  }
}
