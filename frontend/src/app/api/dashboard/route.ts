import { NextRequest, NextResponse } from 'next/server';

const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.nnai.app';

export async function GET(req: NextRequest) {
  const cookie = req.headers.get('cookie');
  const upstream = await fetch(`${apiBase}/api/dashboard`, {
    method: 'GET',
    headers: {
      ...(cookie ? { cookie } : {}),
    },
    cache: 'no-store',
  });

  const contentType = upstream.headers.get('content-type') || 'application/json';
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'content-type': contentType },
  });
}
