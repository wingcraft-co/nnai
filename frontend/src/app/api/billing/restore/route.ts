import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.nnai.app';
  const cookie = req.headers.get('cookie');

  const upstream = await fetch(`${apiBase}/api/billing/restore`, {
    method: 'POST',
    headers: {
      ...(cookie ? { cookie } : {}),
    },
    cache: 'no-store',
  });

  const contentType = upstream.headers.get('content-type') || 'application/json';
  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'content-type': contentType,
    },
  });
}
