import { and, eq, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { clubs, leagues } from '@/db/schema/leagues';
import { matches, matchEvents, lineups } from '@/db/schema/matches';
import { leaguePlayers } from '@/db/schema/players';
import { newsItems } from '@/db/schema/news';
import { simulate } from '@/engine/simulate';
import { buildEngineTeam } from './build-team';
import { IN_GAME_MINUTE_REAL_MS, TOTAL_MATCH_MINUTES, TOTAL_MATCH_REAL_MS, seedFromMatchId } from './constants';
import { endSeason, type EndSeasonResult } from './end-season';
import { seasons } from '@/db/schema/leagues';

const UPSET_OVERALL_GAP = 7;

export type TickResult = {
  started: { matchId: string; events: number }[];
  finalized: { matchId: string; homeScore: number; awayScore: number }[];
  seasonsEnded: EndSeasonResult[];
  errors: { matchId: string; error: string }[];
};

export async function startMatch(matchId: string): Promise<{ events: number; seed: number }> {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) throw new Error('Match not found');
  if (match.status !== 'scheduled') throw new Error(`Match is ${match.status}, not scheduled`);

  const [home, away] = await Promise.all([
    buildEngineTeam(match.homeClubId),
    buildEngineTeam(match.awayClubId),
  ]);

  const seed = seedFromMatchId(matchId);
  const result = simulate(home, away, seed);

  const startedAt = new Date();
  const eventRows: (typeof matchEvents.$inferInsert)[] = result.events.map((e) => ({
    matchId,
    minute: e.minute,
    type: e.type,
    clubId: e.clubId,
    playerId: e.playerId,
    description: e.description,
    payload: e.payload,
    revealedAt: new Date(startedAt.getTime() + e.minute * IN_GAME_MINUTE_REAL_MS),
  }));

  await db.transaction(async (tx) => {
    await tx.insert(matchEvents).values(eventRows);
    await tx.insert(lineups).values([
      {
        matchId,
        clubId: home.clubId,
        formation: home.formation,
        style: home.style,
        starters: home.starters.map((p) => p.id),
        subs: home.subs.map((p) => p.id),
      },
      {
        matchId,
        clubId: away.clubId,
        formation: away.formation,
        style: away.style,
        starters: away.starters.map((p) => p.id),
        subs: away.subs.map((p) => p.id),
      },
    ]);
    await tx
      .update(matches)
      .set({ status: 'running', startedAt, currentMinute: 0, engineSeed: seed })
      .where(eq(matches.id, matchId));
  });

  return { events: eventRows.length, seed };
}

export async function finalizeMatch(matchId: string): Promise<{ homeScore: number; awayScore: number }> {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) throw new Error('Match not found');
  if (match.status === 'finished') return { homeScore: match.homeScore, awayScore: match.awayScore };
  if (match.status !== 'running') throw new Error(`Match is ${match.status}, not running`);

  const goalCounts = await db
    .select({
      clubId: matchEvents.clubId,
      count: sql<number>`count(*)::int`,
    })
    .from(matchEvents)
    .where(and(eq(matchEvents.matchId, matchId), eq(matchEvents.type, 'goal')))
    .groupBy(matchEvents.clubId);

  let homeScore = 0;
  let awayScore = 0;
  for (const row of goalCounts) {
    if (row.clubId === match.homeClubId) homeScore = row.count;
    if (row.clubId === match.awayClubId) awayScore = row.count;
  }

  // Look up the league + club names + avg overall for news
  const [homeClub] = await db.select({ name: clubs.name, leagueId: clubs.leagueId }).from(clubs).where(eq(clubs.id, match.homeClubId)).limit(1);
  const [awayClub] = await db.select({ name: clubs.name }).from(clubs).where(eq(clubs.id, match.awayClubId)).limit(1);

  const [overalls] = await db.execute(sql`
    SELECT
      (SELECT ROUND(AVG(current_overall))::int FROM ${leaguePlayers} WHERE club_id = ${match.homeClubId}) AS home_avg,
      (SELECT ROUND(AVG(current_overall))::int FROM ${leaguePlayers} WHERE club_id = ${match.awayClubId}) AS away_avg
  `) as unknown as [{ home_avg: number; away_avg: number }];

  const homeAvg = overalls?.home_avg ?? 0;
  const awayAvg = overalls?.away_avg ?? 0;
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;

  const isUpset =
    (homeWon && awayAvg - homeAvg >= UPSET_OVERALL_GAP) ||
    (awayWon && homeAvg - awayAvg >= UPSET_OVERALL_GAP);

  const finishedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({ status: 'finished', currentMinute: TOTAL_MATCH_MINUTES, homeScore, awayScore, finishedAt })
      .where(eq(matches.id, matchId));

    // News: match result
    if (homeClub) {
      await tx.insert(newsItems).values({
        leagueId: homeClub.leagueId,
        type: 'match_result',
        payload: {
          matchId,
          round: match.round,
          homeClubId: match.homeClubId,
          awayClubId: match.awayClubId,
          homeName: homeClub.name,
          awayName: awayClub?.name ?? 'Гости',
          homeScore,
          awayScore,
        },
      });

      if (isUpset) {
        const underdogClubId = homeWon ? match.homeClubId : match.awayClubId;
        const favouriteClubId = homeWon ? match.awayClubId : match.homeClubId;
        await tx.insert(newsItems).values({
          leagueId: homeClub.leagueId,
          type: 'upset',
          payload: {
            matchId,
            underdogClubId,
            underdogName: homeWon ? homeClub.name : awayClub?.name ?? 'Аутсайдер',
            favouriteClubId,
            favouriteName: homeWon ? awayClub?.name ?? 'Фаворит' : homeClub.name,
            homeScore,
            awayScore,
            overallGap: Math.abs(homeAvg - awayAvg),
          },
        });
      }
    }

    // Bump league.current_round if this round's matches are now all finished
    const [round] = await tx
      .select({
        round: matches.round,
        leagueId: leagues.id,
        remaining: sql<number>`(
          SELECT count(*)::int FROM ${matches} m2
          INNER JOIN seasons s2 ON s2.id = m2.season_id
          WHERE s2.id = ${matches.seasonId}
            AND m2.round = ${matches.round}
            AND m2.status != 'finished'
            AND m2.id != ${matchId}
        )`,
      })
      .from(matches)
      .innerJoin(leagues, eq(leagues.id, sql`(SELECT league_id FROM seasons WHERE id = ${matches.seasonId})`))
      .where(eq(matches.id, matchId));

    if (round && round.remaining === 0) {
      await tx
        .update(leagues)
        .set({ currentRound: sql`GREATEST(${leagues.currentRound}, ${round.round})` })
        .where(eq(leagues.id, round.leagueId));
      // Round complete → all clubs must explicitly confirm for next round
      await tx
        .update(clubs)
        .set({ readyForRound: false })
        .where(eq(clubs.leagueId, round.leagueId));
    }
  });

  return { homeScore, awayScore };
}

export async function tick(): Promise<TickResult> {
  const result: TickResult = { started: [], finalized: [], seasonsEnded: [], errors: [] };
  const now = new Date();

  // Note: rounds are now started by readiness (setReadyAction), not by time.
  // Tick only finalizes running matches whose duration has elapsed.

  // Finalize running matches whose duration has elapsed
  const elapsedThreshold = new Date(now.getTime() - TOTAL_MATCH_REAL_MS);
  const overdue = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.status, 'running'), lte(matches.startedAt, elapsedThreshold)))
    .limit(50);

  for (const m of overdue) {
    try {
      const { homeScore, awayScore } = await finalizeMatch(m.id);
      result.finalized.push({ matchId: m.id, homeScore, awayScore });
    } catch (e) {
      result.errors.push({ matchId: m.id, error: (e as Error).message });
    }
  }

  // 3. Update current_minute for still-running matches (lightweight)
  await db.execute(sql`
    UPDATE matches
    SET current_minute = LEAST(${TOTAL_MATCH_MINUTES}, FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 / ${IN_GAME_MINUTE_REAL_MS}))
    WHERE status = 'running' AND started_at IS NOT NULL
  `);

  // 4. After finalizing matches, check if any seasons are now complete → end them
  if (result.finalized.length > 0) {
    // Find unique league ids of finalized matches' active seasons
    const finalizedMatchIds = result.finalized.map((f) => f.matchId);
    const seasonsTouched = await db
      .select({ leagueId: seasons.leagueId })
      .from(seasons)
      .innerJoin(matches, eq(matches.seasonId, seasons.id))
      .where(and(eq(seasons.status, 'active'), sql`${matches.id} = ANY(${finalizedMatchIds}::uuid[])`));
    const uniqueLeagueIds = Array.from(new Set(seasonsTouched.map((s) => s.leagueId)));

    for (const leagueId of uniqueLeagueIds) {
      try {
        const endResult = await endSeason(leagueId);
        if (endResult) result.seasonsEnded.push(endResult);
      } catch (e) {
        result.errors.push({ matchId: leagueId, error: `endSeason: ${(e as Error).message}` });
      }
    }
  }

  return result;
}
