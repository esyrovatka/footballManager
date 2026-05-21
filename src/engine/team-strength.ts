import type { Style } from '@/lib/formation';
import type { EnginePlayer, EngineTeam } from './types';

export type TeamStrength = {
  attack: number;
  defense: number;
  midfield: number;
  goalkeeping: number;
  overall: number;
};

const STYLE_ATTACK_MOD: Record<Style, number> = {
  attack: 1.15,
  balanced: 1.0,
  defense: 0.9,
};

const STYLE_DEFENSE_MOD: Record<Style, number> = {
  attack: 0.9,
  balanced: 1.0,
  defense: 1.2,
};

function avgBy<T>(items: T[], fn: (i: T) => number, fallback = 0): number {
  if (items.length === 0) return fallback;
  return items.reduce((s, i) => s + fn(i), 0) / items.length;
}

export function computeTeamStrength(team: EngineTeam): TeamStrength {
  const byPos: Record<'GK' | 'DEF' | 'MID' | 'FWD', EnginePlayer[]> = {
    GK: [],
    DEF: [],
    MID: [],
    FWD: [],
  };
  for (const p of team.starters) byPos[p.position].push(p);

  // Forwards drive attack, defenders drive defense, midfielders contribute to both.
  const fwdAttack = avgBy(byPos.FWD, (p) => p.attack, 50);
  const midAttack = avgBy(byPos.MID, (p) => p.attack, 50);
  const defAttack = avgBy(byPos.DEF, (p) => p.attack, 30);

  const defDefense = avgBy(byPos.DEF, (p) => p.defense, 50);
  const midDefense = avgBy(byPos.MID, (p) => p.defense, 50);
  const fwdDefense = avgBy(byPos.FWD, (p) => p.defense, 30);

  const midfield = avgBy(byPos.MID, (p) => (p.attack + p.defense + p.speed) / 3, 50);
  const goalkeeping = avgBy(byPos.GK, (p) => p.goalkeeping, 50);

  const attack = (fwdAttack * 0.6 + midAttack * 0.3 + defAttack * 0.1) * STYLE_ATTACK_MOD[team.style];
  const defense =
    (defDefense * 0.55 + midDefense * 0.3 + fwdDefense * 0.05 + goalkeeping * 0.1) *
    STYLE_DEFENSE_MOD[team.style];

  const overall = avgBy(team.starters, (p) => p.overall, 60);

  return { attack, defense, midfield, goalkeeping, overall };
}
