import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const response = await fetch("https://api.nnai.app/api/detail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "API 호출 실패" },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
}
