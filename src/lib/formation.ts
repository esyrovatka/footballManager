export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '5-3-2' | '4-2-3-1' | '4-5-1';
export type Style = 'attack' | 'balanced' | 'defense';

export type PositionCounts = {
  GK: number;
  DEF: number;
  MID: number;
  FWD: number;
};

export const FORMATIONS: Formation[] = ['4-4-2', '4-3-3', '3-5-2', '5-3-2', '4-2-3-1', '4-5-1'];
export const STYLES: Style[] = ['attack', 'balanced', 'defense'];

const FORMATION_COUNTS: Record<Formation, PositionCounts> = {
  '4-4-2': { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  '4-3-3': { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  '3-5-2': { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  '5-3-2': { GK: 1, DEF: 5, MID: 3, FWD: 2 },
  '4-2-3-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  '4-5-1': { GK: 1, DEF: 4, MID: 5, FWD: 1 },
};

export function isFormation(value: string): value is Formation {
  return (FORMATIONS as readonly string[]).includes(value);
}

export function isStyle(value: string): value is Style {
  return (STYLES as readonly string[]).includes(value);
}

export function positionsForFormation(formation: Formation): PositionCounts {
  return FORMATION_COUNTS[formation];
}
