'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs, leagues } from '@/db/schema/leagues';
import { maybeStartNextRound } from '@/lib/match-day/readiness';

export type ReadyState = { error?: string; ok?: string } | undefined;

export async function startLeagueAction(leagueId: string): Promise<ReadyState> {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/login');

  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return { error: 'Лига не найдена' };
  if (league.status !== 'setup') return { error: `Лига уже в статусе ${league.status}` };

  await db.update(leagues).set({ status: 'active' }).where(eq(leagues.id, leagueId));

  // If all human clubs are already ready (e.g. all bots) — start round 1
  const started = await maybeStartNextRound(leagueId);

  revalidatePath(`/admin/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}`);
  return { ok: started ? `Лига запущена, тур ${started.round} начался` : 'Лига запущена, ждём готовности менеджеров' };
}

export async function setReadyAction(clubId: string, ready: boolean): Promise<ReadyState> {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [club] = await db
    .select({ id: clubs.id, leagueId: clubs.leagueId, managerUserId: clubs.managerUserId })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1);
  if (!club) return { error: 'Клуб не найден' };
  if (club.managerUserId !== session.user.id && !session.user.isAdmin) {
    return { error: 'Только менеджер клуба может это делать' };
  }

  await db
    .update(clubs)
    .set({ readyForRound: ready })
    .where(and(eq(clubs.id, clubId)));

  let started: Awaited<ReturnType<typeof maybeStartNextRound>> = null;
  if (ready) {
    started = await maybeStartNextRound(club.leagueId);
  }

  revalidatePath('/dashboard');
  revalidatePath(`/leagues/${club.leagueId}`);
  revalidatePath(`/leagues/${club.leagueId}/clubs/${clubId}`);
  return {
    ok: started ? `Все готовы! Тур ${started.round} начался` : ready ? 'Готов' : 'Снято',
  };
}
