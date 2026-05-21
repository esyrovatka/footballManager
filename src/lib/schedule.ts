export type SchedulePair = { home: number; away: number };
export type ScheduleRound = SchedulePair[];

/**
 * Round-robin schedule for N teams (N must be even).
 * Returns 2*(N-1) rounds — first half + mirrored second half (home/away swapped).
 * Teams are referred to by 0-based indices.
 */
export function buildRoundRobin(n: number): ScheduleRound[] {
  if (n < 2 || n % 2 !== 0) {
    throw new Error(`Round-robin requires even N >= 2, got ${n}`);
  }

  const teams = Array.from({ length: n }, (_, i) => i);
  const halfRounds: ScheduleRound[] = [];

  for (let r = 0; r < n - 1; r++) {
    const round: ScheduleRound = [];
    for (let i = 0; i < n / 2; i++) {
      const home = teams[i];
      const away = teams[n - 1 - i];
      // Alternate home/away by round to balance home advantage
      if (r % 2 === 0) {
        round.push({ home, away });
      } else {
        round.push({ home: away, away: home });
      }
    }
    halfRounds.push(round);
    // Rotate: keep teams[0] fixed, rotate the rest clockwise
    teams.splice(1, 0, teams.pop()!);
  }

  // Second half: mirror with home/away swapped
  const secondHalf: ScheduleRound[] = halfRounds.map((round) =>
    round.map(({ home, away }) => ({ home: away, away: home })),
  );

  return [...halfRounds, ...secondHalf];
}
