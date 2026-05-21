import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { lineups } from '@/db/schema/matches';
import { leaguePlayers, playerTemplates } from '@/db/schema/players';

export type LineupPlayer = {
  id: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  currentOverall: number;
};

export type MatchLineup = {
  starters: LineupPlayer[];
  subs: LineupPlayer[];
};

export async function getMatchLineup(matchId: string, clubId: string): Promise<MatchLineup | null> {
  const [row] = await db
    .select({ starters: lineups.starters, subs: lineups.subs })
    .from(lineups)
    .where(and(eq(lineups.matchId, matchId), eq(lineups.clubId, clubId)))
    .limit(1);
  if (!row) return null;

  const allIds = [...row.starters, ...row.subs];
  if (allIds.length === 0) return { starters: [], subs: [] };

  const players = await db
    .select({
      id: leaguePlayers.id,
      name: playerTemplates.name,
      position: playerTemplates.position,
      currentOverall: leaguePlayers.currentOverall,
    })
    .from(leaguePlayers)
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .where(inArray(leaguePlayers.id, allIds))
    .orderBy(asc(playerTemplates.position));

  const byId = new Map(players.map((p) => [p.id, p]));
  return {
    starters: row.starters
      .map((id) => byId.get(id))
      .filter((p): p is LineupPlayer => Boolean(p)),
    subs: row.subs
      .map((id) => byId.get(id))
      .filter((p): p is LineupPlayer => Boolean(p)),
  };
}
