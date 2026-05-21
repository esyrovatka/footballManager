import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

export type StandingsRow = {
  club_id: string;
  club_name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
};

export async function getStandings(leagueId: string, seasonId: string): Promise<StandingsRow[]> {
  const rows = await db.execute(sql`
    WITH match_results AS (
      SELECT
        home_club_id AS club_id,
        home_score AS gf,
        away_score AS ga,
        CASE
          WHEN home_score > away_score THEN 1
          WHEN home_score < away_score THEN -1
          ELSE 0
        END AS outcome
      FROM matches
      WHERE season_id = ${seasonId}::uuid AND status = 'finished'
      UNION ALL
      SELECT
        away_club_id AS club_id,
        away_score AS gf,
        home_score AS ga,
        CASE
          WHEN away_score > home_score THEN 1
          WHEN away_score < home_score THEN -1
          ELSE 0
        END AS outcome
      FROM matches
      WHERE season_id = ${seasonId}::uuid AND status = 'finished'
    )
    SELECT
      c.id AS club_id,
      c.name AS club_name,
      COUNT(mr.outcome)::int AS played,
      COUNT(*) FILTER (WHERE mr.outcome = 1)::int AS wins,
      COUNT(*) FILTER (WHERE mr.outcome = 0)::int AS draws,
      COUNT(*) FILTER (WHERE mr.outcome = -1)::int AS losses,
      COALESCE(SUM(mr.gf), 0)::int AS goals_for,
      COALESCE(SUM(mr.ga), 0)::int AS goals_against,
      (COALESCE(SUM(mr.gf), 0) - COALESCE(SUM(mr.ga), 0))::int AS goal_diff,
      (COUNT(*) FILTER (WHERE mr.outcome = 1) * 3 + COUNT(*) FILTER (WHERE mr.outcome = 0))::int AS points
    FROM clubs c
    LEFT JOIN match_results mr ON mr.club_id = c.id
    WHERE c.league_id = ${leagueId}::uuid
    GROUP BY c.id, c.name
    ORDER BY points DESC, goal_diff DESC, goals_for DESC, c.name ASC
  `);
  return rows as unknown as StandingsRow[];
}
