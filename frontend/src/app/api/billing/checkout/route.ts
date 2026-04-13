import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const directCheckoutUrl =
    process.env.POLAR_CHECKOUT_URL || process.env.NEXT_PUBLIC_POLAR_CHECKOUT_URL;
  if (directCheckoutUrl) {
    return NextResponse.json({ checkout_url: directCheckoutUrl });
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.nnai.app';
  const cookie = req.headers.get('cookie');
  const rawBody = await req.text();

  const upstream = await fetch(`${apiBase}/api/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: rawBody || '{}',
    cache: 'no-store',
  });

  const contentType = upstream.headers.get('content-type') || 'application/json';
  const text = await upstream.text();

  const response = new NextResponse(text, {
    status: upstream.status,
    headers: {
      'content-type': contentType,
    },
  });

  const setCookie = upstream.headers.get('set-cookie');
  if (setCookie) {
    response.headers.set('set-cookie', setCookie);
  }

  return response;
}
