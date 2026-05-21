'use server';

import { and, eq, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs } from '@/db/schema/leagues';
import { liveDirectives, matchEvents, matches } from '@/db/schema/matches';
import { leaguePlayers, playerTemplates } from '@/db/schema/players';
import { IN_GAME_MINUTE_REAL_MS, TOTAL_MATCH_MINUTES } from '@/lib/match-day/constants';

export type LiveActionState = { error?: string; ok?: string } | undefined;

const MAX_SUBS_PER_CLUB = 3;

export async function liveSubAction(
  matchId: string,
  formData: FormData,
): Promise<LiveActionState> {
  const session = await auth();
  if (!session?.user) return { error: 'Не авторизован' };

  const playerOutId = String(formData.get('playerOut') ?? '');
  const playerInId = String(formData.get('playerIn') ?? '');
  if (!playerOutId || !playerInId) return { error: 'Игроки не выбраны' };
  if (playerOutId === playerInId) return { error: 'Игрок не может заменить сам себя' };

  const [match] = await db
    .select({
      id: matches.id,
      status: matches.status,
      startedAt: matches.startedAt,
      homeClubId: matches.homeClubId,
      awayClubId: matches.awayClubId,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) return { error: 'Матч не найден' };
  if (match.status !== 'running') return { error: 'Матч не идёт сейчас' };

  // Determine which club the user manages in this match
  const myClub = await db
    .select({ id: clubs.id })
    .from(clubs)
    .where(and(eq(clubs.managerUserId, session.user.id), sql`${clubs.id} IN (${match.homeClubId}, ${match.awayClubId})`))
    .limit(1);

  const isAdminOnHome = session.user.isAdmin;
  const clubId = myClub[0]?.id ?? (isAdminOnHome ? match.homeClubId : null);
  if (!clubId) return { error: 'Ты не менеджер этого матча' };

  // Sub count
  const existingSubs = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(matchEvents)
    .where(
      and(
        eq(matchEvents.matchId, matchId),
        eq(matchEvents.type, 'sub'),
        eq(matchEvents.clubId, clubId),
      ),
    );
  const used = existingSubs[0]?.c ?? 0;
  if (used >= MAX_SUBS_PER_CLUB) {
    return { error: `Использовано ${MAX_SUBS_PER_CLUB} замены, лимит исчерпан` };
  }

  // Validate players: both must belong to this club, and not already subbed off
  const playerRows = await db
    .select({
      id: leaguePlayers.id,
      name: playerTemplates.name,
      position: playerTemplates.position,
      clubId: leaguePlayers.clubId,
    })
    .from(leaguePlayers)
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .where(sql`${leaguePlayers.id} IN (${playerOutId}, ${playerInId})`);

  const out = playerRows.find((p) => p.id === playerOutId);
  const inn = playerRows.find((p) => p.id === playerInId);
  if (!out || out.clubId !== clubId) return { error: 'Игрок «уходящий» не из твоего клуба' };
  if (!inn || inn.clubId !== clubId) return { error: 'Игрок «выходящий» не из твоего клуба' };

  // Compute current in-game minute from elapsed real time
  const startedAt = match.startedAt;
  if (!startedAt) return { error: 'Матч не начался' };
  const liveMinute = Math.max(
    1,
    Math.min(TOTAL_MATCH_MINUTES, Math.floor((Date.now() - startedAt.getTime()) / IN_GAME_MINUTE_REAL_MS)),
  );

  await db.transaction(async (tx) => {
    await tx.insert(liveDirectives).values({
      matchId,
      userId: session.user.id,
      clubId,
      type: 'sub',
      payload: { type: 'sub', playerInId, playerOutId },
      appliedAt: new Date(),
    });
    await tx.insert(matchEvents).values({
      matchId,
      minute: liveMinute,
      type: 'sub',
      clubId,
      playerId: inn.id,
      description: `Замена: ${out.name} → ${inn.name}`,
      payload: { playerInId, playerOutId },
      revealedAt: new Date(),
    });
  });

  return { ok: `Замена на ${liveMinute}': ${out.name} → ${inn.name}` };
}

