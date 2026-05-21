'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { tick } from '@/lib/match-day/runner';

export type TickActionState = { ok?: string; error?: string } | undefined;

export async function tickNowAction(): Promise<TickActionState> {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/login');

  try {
    const result = await tick();
    revalidatePath('/admin/leagues');
    revalidatePath('/admin');
    const parts: string[] = [];
    if (result.started.length > 0) parts.push(`старт: ${result.started.length}`);
    if (result.finalized.length > 0) parts.push(`финал: ${result.finalized.length}`);
    if (result.errors.length > 0) parts.push(`ошибки: ${result.errors.length}`);
    return { ok: parts.length > 0 ? parts.join(', ') : 'Нет матчей готовых к обработке' };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
