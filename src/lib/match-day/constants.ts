// 1 in-game minute = 8 real seconds → ~12-minute match
export const IN_GAME_MINUTE_REAL_MS = 8_000;
export const TOTAL_MATCH_MINUTES = 90;
export const TOTAL_MATCH_REAL_MS = (TOTAL_MATCH_MINUTES + 1) * IN_GAME_MINUTE_REAL_MS;

export function seedFromMatchId(matchId: string): number {
  return parseInt(matchId.replace(/-/g, '').slice(0, 8), 16) >>> 0;
}
