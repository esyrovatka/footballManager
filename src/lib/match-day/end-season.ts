import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { clubs, leagues, seasons } from '@/db/schema/leagues';
import { leaguePlayers, playerTemplates } from '@/db/schema/players';
import { matches } from '@/db/schema/matches';
import { newsItems } from '@/db/schema/news';
import { getStandings } from '@/lib/standings';
import { buildRoundRobin } from '@/lib/schedule';
import { salaryFromOverall } from '@/lib/transfers';
import { advanceOneYear, prizeMoneyEur } from './progression';

export type EndSeasonResult = {
  leagueId: string;
  oldSeasonNumber: number;
  newSeasonNumber: number;
  championClubId: string;
  championName: string;
  playersUpdated: number;
  matchesScheduled: number;
};

/**
 * End the current active season of a league: pay prizes, age players,
 * recompute their overall/attributes, mark season finished, create new
 * season + schedule. Caller must ensure all matches of the active
 * season are 'finished'.
 */
export async function endSeason(leagueId: string): Promise<EndSeasonResult | null> {
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId)).limit(1);
  if (!league) return null;

  const [activeSeason] = await db
    .select()
    .from(seasons)
    .where(and(eq(seasons.leagueId, leagueId), eq(seasons.status, 'active')))
    .limit(1);
  if (!activeSeason) return null;

  // Guard: every match of this season must be finished
  const [pending] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(matches)
    .where(and(eq(matches.seasonId, activeSeason.id), sql`${matches.status} != 'finished'`));
  if ((pending?.c ?? 0) > 0) return null;

  const clubList = await db
    .select({ id: clubs.id, name: clubs.name })
    .from(clubs)
    .where(eq(clubs.leagueId, leagueId))
    .orderBy(asc(clubs.name));
  if (clubList.length < 2) return null;

  const standings = await getStandings(leagueId, activeSeason.id);
  const champion = standings[0];

  // Pull all league_players + their template progression params
  const playerRows = await db
    .select({
      id: leaguePlayers.id,
      currentOverall: leaguePlayers.currentOverall,
      currentAge: leaguePlayers.currentAge,
      attributes: leaguePlayers.attributes,
      peakAge: playerTemplates.peakAge,
      growthRate: playerTemplates.growthRate,
      declineRate: playerTemplates.declineRate,
    })
    .from(leaguePlayers)
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .where(eq(leaguePlayers.leagueId, leagueId));

  const newSeasonNumber = league.seasonNumber + 1;
  const finishedAt = new Date();

  let scheduledCount = 0;
  await db.transaction(async (tx) => {
    // 1. Mark season finished
    await tx
      .update(seasons)
      .set({ status: 'finished', finishedAt })
      .where(eq(seasons.id, activeSeason.id));

    // 2. Award prizes by rank
    for (let rank = 1; rank <= standings.length; rank++) {
      const row = standings[rank - 1];
      const prize = prizeMoneyEur(rank, clubList.length);
      await tx
        .update(clubs)
        .set({ budget: sql`${clubs.budget} + ${prize}` })
        .where(eq(clubs.id, row.club_id));
    }

    // 3. Advance every player one year + scale attributes; reset cards/suspensions
    for (const row of playerRows) {
      const next = advanceOneYear(
        { currentOverall: row.currentOverall, currentAge: row.currentAge, attributes: row.attributes },
        { peakAge: row.peakAge, growthRate: row.growthRate, declineRate: row.declineRate },
      );
      await tx
        .update(leaguePlayers)
        .set({
          currentOverall: next.currentOverall,
          currentAge: next.currentAge,
          attributes: next.attributes,
          yellowCards: 0,
          suspendedUntilRound: null,
          contractSalary: salaryFromOverall(next.currentOverall),
        })
        .where(eq(leaguePlayers.id, row.id));
    }

    // 4. Insert season_end news
    await tx.insert(newsItems).values({
      leagueId,
      type: 'season_end',
      payload: {
        seasonNumber: league.seasonNumber,
        championClubId: champion?.club_id,
        championName: champion?.club_name,
        standings: standings.map((s) => ({
          clubId: s.club_id,
          clubName: s.club_name,
          points: s.points,
          goalDiff: s.goal_diff,
        })),
      },
    });

    // 5. Create new season
    const [newSeason] = await tx
      .insert(seasons)
      .values({ leagueId, seasonNumber: newSeasonNumber, status: 'active' })
      .returning();

    // 6. Build round-robin schedule for the new season, starting tomorrow
    const playerClubIds = clubList.map((c) => c.id);
    const rounds = buildRoundRobin(playerClubIds.length);
    const [h, m, s] = (league.matchTimeLocal ?? '20:00:00').split(':').map(Number);

    const matchRows: (typeof matches.$inferInsert)[] = [];
    rounds.forEach((round, roundIdx) => {
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + roundIdx + 1);
      scheduledAt.setHours(h ?? 20, m ?? 0, s ?? 0, 0);
      for (const pair of round) {
        matchRows.push({
          seasonId: newSeason.id,
          round: roundIdx + 1,
          homeClubId: playerClubIds[pair.home],
          awayClubId: playerClubIds[pair.away],
          scheduledAt,
          status: 'scheduled',
        });
      }
    });
    await tx.insert(matches).values(matchRows);
    scheduledCount = matchRows.length;

    // 7. Bump league.season_number, reset current_round
    await tx
      .update(leagues)
      .set({ seasonNumber: newSeasonNumber, currentRound: 0 })
      .where(eq(leagues.id, leagueId));

    // 8. season_start news
    await tx.insert(newsItems).values({
      leagueId,
      type: 'season_start',
      payload: { seasonNumber: newSeasonNumber },
    });
  });

  return {
    leagueId,
    oldSeasonNumber: league.seasonNumber,
    newSeasonNumber,
    championClubId: champion?.club_id ?? '',
    championName: champion?.club_name ?? '',
    playersUpdated: playerRows.length,
    matchesScheduled: scheduledCount,
  };
}
