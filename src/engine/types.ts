import type { Formation, Style } from '@/lib/formation';

export type EnginePosition = 'GK' | 'DEF' | 'MID' | 'FWD';

export type EnginePlayer = {
  id: string;
  name: string;
  position: EnginePosition;
  attack: number;
  defense: number;
  speed: number;
  goalkeeping: number;
  overall: number;
};

export type EngineTeam = {
  clubId: string;
  clubName: string;
  formation: Formation;
  style: Style;
  starters: EnginePlayer[]; // 11
  subs: EnginePlayer[]; // 7
};

export type EngineEventType =
  | 'kickoff'
  | 'chance'
  | 'goal'
  | 'save'
  | 'foul'
  | 'yellow'
  | 'red'
  | 'sub'
  | 'corner'
  | 'injury'
  | 'key_pass'
  | 'halftime'
  | 'fulltime';

export type EngineEvent = {
  minute: number;
  type: EngineEventType;
  clubId?: string;
  playerId?: string;
  description: string;
  payload?: Record<string, unknown>;
};

export type EngineResult = {
  events: EngineEvent[];
  homeScore: number;
  awayScore: number;
  homeShots: number;
  awayShots: number;
};
