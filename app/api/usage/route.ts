import { NextResponse } from 'next/server';
import { getUsage } from '@/lib/usage';

export const runtime = 'nodejs';

export async function GET() {
  const usage = await getUsage();
  if (!usage) {
    return NextResponse.json({ enabled: false });
  }
  return NextResponse.json({ enabled: true, ...usage });
}
