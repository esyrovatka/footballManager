import type { PlayerAttributes } from '@/db/schema/players';

type Template = {
  peakAge: number;
  growthRate: number;
  declineRate: number;
};

type Player = {
  currentOverall: number;
  currentAge: number;
  attributes: PlayerAttributes;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Recompute overall + attributes after one in-game season.
 * Pure: only uses input + Math.random().
 */
export function advanceOneYear(
  player: Player,
  template: Template,
): { currentAge: number; currentOverall: number; attributes: PlayerAttributes } {
  const age = player.currentAge;
  const peakAge = template.peakAge;

  let delta = 0;
  if (age < peakAge) {
    delta = template.growthRate + (Math.random() - 0.5);
  } else if (age <= peakAge + 2) {
    delta = (Math.random() - 0.5) * 0.6;
  } else {
    delta = template.declineRate + (Math.random() - 0.5);
  }

  const oldOverall = player.currentOverall;
  const newOverall = clamp(Math.round(oldOverall + delta), 40, 99);

  // Scale attributes by the same ratio so engine reflects the change.
  const factor = oldOverall === 0 ? 1 : newOverall / oldOverall;
  const attrs = player.attributes;
  const newAttrs: PlayerAttributes = {
    attack: clamp(Math.round(attrs.attack * factor), 1, 99),
    defense: clamp(Math.round(attrs.defense * factor), 1, 99),
    speed: clamp(Math.round(attrs.speed * factor), 1, 99),
    goalkeeping: clamp(Math.round(attrs.goalkeeping * factor), 1, 99),
  };

  return { currentAge: age + 1, currentOverall: newOverall, attributes: newAttrs };
}

/**
 * Prize money by final rank. Total clubs must be 8 or 10.
 * Returns euros (not millions).
 */
export function prizeMoneyEur(rank: number, totalClubs: number): number {
  const map: Record<number, number[]> = {
    8: [15, 10, 7, 5, 4, 3, 2, 1],
    10: [15, 10, 7, 5, 4, 3, 3, 2, 2, 1],
  };
  const table = map[totalClubs] ?? map[8];
  const idx = Math.min(rank - 1, table.length - 1);
  return table[idx] * 1_000_000;
}
