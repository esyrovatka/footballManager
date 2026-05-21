import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { clubs, leagues, seasons } from '@/db/schema/leagues';
import { matches } from '@/db/schema/matches';
import { startMatch } from './runner';

export type ReadinessStatus = {
  totalHumans: number;
  readyHumans: number;
  notReadyHumans: { clubId: string; clubName: string }[];
};

export async function getReadinessStatus(leagueId: string): Promise<ReadinessStatus> {
  const humans = await db
    .select({ id: clubs.id, name: clubs.name, ready: clubs.readyForRound })
    .from(clubs)
    .where(and(eq(clubs.leagueId, leagueId), isNotNull(clubs.managerUserId)));
  return {
    totalHumans: humans.length,
    readyHumans: humans.filter((c) => c.ready).length,
    notReadyHumans: humans.filter((c) => !c.ready).map((c) => ({ clubId: c.id, clubName: c.name })),
  };
}

/**
 * Starts all matches of the next round when (1) league is active, (2) next
 * round exists in 'scheduled' status, (3) every human-managed club has
 * ready_for_round = true. Bots count as always ready.
 *
 * Idempotent: if conditions aren't met, returns null.
 */
export async function maybeStartNextRound(leagueId: string): Promise<{
  round: number;
  startedMatchIds: string[];
} | null> {
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league || league.status !== 'active') return null;

  const [activeSeason] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(eq(seasons.leagueId, leagueId), eq(seasons.status, 'active')))
    .limit(1);
  if (!activeSeason) return null;

  const nextRound = league.currentRound + 1;

  const nextMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        eq(matches.seasonId, activeSeason.id),
        eq(matches.round, nextRound),
        eq(matches.status, 'scheduled'),
      ),
    )
    .orderBy(asc(matches.scheduledAt));
  if (nextMatches.length === 0) return null;

  // All human-managed clubs in this league must be ready
  const [notReady] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(clubs)
    .where(
      and(
        eq(clubs.leagueId, leagueId),
        isNotNull(clubs.managerUserId),
        eq(clubs.readyForRound, false),
      ),
    );
  if ((notReady?.c ?? 0) > 0) return null;

  // Refresh scheduled_at to "now" so the UI doesn't lie about kickoff
  await db
    .update(matches)
    .set({ scheduledAt: new Date() })
    .where(
      and(
        eq(matches.seasonId, activeSeason.id),
        eq(matches.round, nextRound),
        eq(matches.status, 'scheduled'),
      ),
    );

  const started: string[] = [];
  for (const m of nextMatches) {
    try {
      await startMatch(m.id);
      started.push(m.id);
    } catch (e) {
      console.error('startMatch failed', m.id, e);
    }
  }

  return { round: nextRound, startedMatchIds: started };
}
