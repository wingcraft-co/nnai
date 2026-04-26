import { NextRequest, NextResponse } from 'next/server';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.nnai.app';

export async function PATCH(req: NextRequest) {
  const cookie = req.headers.get('cookie');
  const rawBody = await req.text();

  const upstream = await fetch(`${apiBase}/api/dashboard/plan`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: rawBody || '{}',
    cache: 'no-store',
  });

  const contentType = upstream.headers.get('content-type') || 'application/json';
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'content-type': contentType },
  });
}
