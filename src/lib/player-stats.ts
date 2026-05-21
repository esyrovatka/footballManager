import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

export type TopScorerRow = {
  player_id: string;
  player_name: string;
  club_id: string | null;
  club_name: string | null;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  goals: number;
  apps: number;
};

export async function getTopScorers(leagueId: string, limit = 10): Promise<TopScorerRow[]> {
  const rows = await db.execute(sql`
    WITH player_events AS (
      SELECT me.player_id, me.type, me.match_id
      FROM match_events me
      INNER JOIN matches m ON m.id = me.match_id
      INNER JOIN seasons s ON s.id = m.season_id
      WHERE s.league_id = ${leagueId}::uuid
        AND me.player_id IS NOT NULL
    )
    SELECT
      lp.id AS player_id,
      pt.name AS player_name,
      lp.club_id,
      c.name AS club_name,
      pt.position,
      COUNT(*) FILTER (WHERE pe.type = 'goal')::int AS goals,
      COUNT(DISTINCT pe.match_id)::int AS apps
    FROM player_events pe
    INNER JOIN league_players lp ON lp.id = pe.player_id
    INNER JOIN player_templates pt ON pt.id = lp.template_id
    LEFT JOIN clubs c ON c.id = lp.club_id
    GROUP BY lp.id, pt.name, lp.club_id, c.name, pt.position
    HAVING COUNT(*) FILTER (WHERE pe.type = 'goal') > 0
    ORDER BY goals DESC, apps ASC
    LIMIT ${limit}
  `);
  return rows as unknown as TopScorerRow[];
}

export type PlayerStats = {
  goals: number;
  yellows: number;
  reds: number;
  apps: number;
};

export async function getPlayerStats(playerId: string): Promise<PlayerStats> {
  const rows = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE type = 'goal')::int AS goals,
      COUNT(*) FILTER (WHERE type = 'yellow')::int AS yellows,
      COUNT(*) FILTER (WHERE type = 'red')::int AS reds,
      COUNT(DISTINCT match_id)::int AS apps
    FROM match_events
    WHERE player_id = ${playerId}::uuid
  `);
  const r = (rows as unknown as PlayerStats[])[0];
  return r ?? { goals: 0, yellows: 0, reds: 0, apps: 0 };
}
