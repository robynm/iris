import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const expected = process.env.APP_PASSWORD;

  if (!expected) {
    return NextResponse.json(
      { error: 'APP_PASSWORD is not set on the server' },
      { status: 500 }
    );
  }

  if (typeof password !== 'string' || password !== expected) {
    // Small delay to make brute-force less convenient
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('nb_auth', expected, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    // 30 days
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
