import type { PlayerAttributes } from '@/db/schema/players';

type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type DistributablePlayer = {
  id: string;
  position: Position;
  baseOverall: number;
  age: number;
  attributes: PlayerAttributes;
};

/**
 * Distribute players across N clubs using snake order per position,
 * balancing total overall and positional coverage.
 *
 * Snake order example for 4 clubs: [0,1,2,3,3,2,1,0,0,1,2,3,...]
 * — best players go to club 0, then club 3 gets next best, etc.
 */
export function distributePlayers<T extends DistributablePlayer>(
  players: T[],
  numClubs: number,
): T[][] {
  const buckets: Record<Position, T[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of players) buckets[p.position].push(p);

  // Sort each bucket by overall desc
  for (const pos of Object.keys(buckets) as Position[]) {
    buckets[pos].sort((a, b) => b.baseOverall - a.baseOverall);
  }

  const clubs: T[][] = Array.from({ length: numClubs }, () => []);

  // Process positions in order to make sure each club gets at least 1 GK first
  const positionOrder: Position[] = ['GK', 'DEF', 'MID', 'FWD'];
  for (const pos of positionOrder) {
    const list = buckets[pos];
    list.forEach((player, idx) => {
      const clubIdx = snakeIndex(idx, numClubs);
      clubs[clubIdx].push(player);
    });
  }

  return clubs;
}

function snakeIndex(i: number, n: number): number {
  const cycle = Math.floor(i / n);
  const offset = i % n;
  return cycle % 2 === 0 ? offset : n - 1 - offset;
}
