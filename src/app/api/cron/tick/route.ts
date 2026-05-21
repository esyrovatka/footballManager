import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { tick } from '@/lib/match-day/runner';

export const dynamic = 'force-dynamic';

async function authorize(request: Request): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const cronSecret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization');
  if (cronSecret && header === `Bearer ${cronSecret}`) return { ok: true };

  const session = await auth();
  if (session?.user?.isAdmin) return { ok: true };

  return { ok: false, status: 401, message: 'Unauthorized' };
}

export async function POST(request: Request) {
  const authResult = await authorize(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.message }, { status: authResult.status });
  }

  const result = await tick();
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  // Vercel Cron uses GET by default
  return POST(request);
}
