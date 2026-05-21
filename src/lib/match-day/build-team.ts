import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { clubs } from '@/db/schema/leagues';
import { leaguePlayers, playerTemplates } from '@/db/schema/players';
import { isFormation, isStyle, positionsForFormation, type Formation, type Style } from '@/lib/formation';
import type { EnginePlayer, EngineTeam, EnginePosition } from '@/engine/types';

type RawPlayer = {
  id: string;
  position: EnginePosition;
  name: string;
  currentOverall: number;
  attack: number;
  defense: number;
  speed: number;
  goalkeeping: number;
};

function toEnginePlayer(p: RawPlayer): EnginePlayer {
  return {
    id: p.id,
    name: p.name,
    position: p.position,
    attack: p.attack,
    defense: p.defense,
    speed: p.speed,
    goalkeeping: p.goalkeeping,
    overall: p.currentOverall,
  };
}

/**
 * Build an EngineTeam from DB. Uses club's saved default lineup if it
 * looks valid; otherwise falls back to a position-balanced auto pick.
 */
export async function buildEngineTeam(clubId: string): Promise<EngineTeam> {
  const [club] = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      defaultFormation: clubs.defaultFormation,
      defaultStyle: clubs.defaultStyle,
      defaultStarters: clubs.defaultStarters,
      defaultSubs: clubs.defaultSubs,
    })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1);

  if (!club) throw new Error(`Club not found: ${clubId}`);

  const rosterRows = await db
    .select({
      id: leaguePlayers.id,
      position: playerTemplates.position,
      name: playerTemplates.name,
      currentOverall: leaguePlayers.currentOverall,
      attributes: leaguePlayers.attributes,
    })
    .from(leaguePlayers)
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .where(eq(leaguePlayers.clubId, clubId));

  const roster: RawPlayer[] = rosterRows.map((r) => ({
    id: r.id,
    name: r.name,
    position: r.position,
    currentOverall: r.currentOverall,
    attack: r.attributes.attack,
    defense: r.attributes.defense,
    speed: r.attributes.speed,
    goalkeeping: r.attributes.goalkeeping,
  }));

  const rosterMap = new Map(roster.map((p) => [p.id, p]));

  const formation: Formation =
    club.defaultFormation && isFormation(club.defaultFormation) ? club.defaultFormation : '4-4-2';
  const style: Style =
    club.defaultStyle && isStyle(club.defaultStyle) ? club.defaultStyle : 'balanced';

  const expected = positionsForFormation(formation);

  let starters: RawPlayer[] = [];
  let subs: RawPlayer[] = [];

  // Try to use saved lineup
  const savedStarters = (club.defaultStarters ?? [])
    .map((id) => rosterMap.get(id))
    .filter((p): p is RawPlayer => Boolean(p));
  const savedSubs = (club.defaultSubs ?? [])
    .map((id) => rosterMap.get(id))
    .filter((p): p is RawPlayer => Boolean(p));

  // Validate: 11 starters, position counts match formation
  const counts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of savedStarters) counts[p.position]++;
  const validStarters =
    savedStarters.length === 11 && (['GK', 'DEF', 'MID', 'FWD'] as const).every((pos) => counts[pos] === expected[pos]);

  if (validStarters) {
    starters = savedStarters;
    subs = savedSubs.slice(0, 7);
  } else {
    // Auto-fill: best per position
    const byPosition: Record<EnginePosition, RawPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of roster) byPosition[p.position].push(p);
    for (const pos of Object.keys(byPosition) as EnginePosition[]) {
      byPosition[pos].sort((a, b) => b.currentOverall - a.currentOverall);
    }

    for (const pos of ['GK', 'DEF', 'MID', 'FWD'] as EnginePosition[]) {
      const needed = expected[pos];
      const got = byPosition[pos].slice(0, needed);
      starters.push(...got);
    }

    // Subs: next best available
    const usedIds = new Set(starters.map((p) => p.id));
    subs = roster
      .filter((p) => !usedIds.has(p.id))
      .sort((a, b) => b.currentOverall - a.currentOverall)
      .slice(0, 7);
  }

  if (starters.length < 11) {
    throw new Error(`Club ${club.name} doesn't have enough players for a starting XI (${starters.length}/11)`);
  }

  return {
    clubId: club.id,
    clubName: club.name,
    formation,
    style,
    starters: starters.map(toEnginePlayer),
    subs: subs.map(toEnginePlayer),
  };
}
