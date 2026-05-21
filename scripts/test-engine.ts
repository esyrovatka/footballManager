import { simulate } from '../src/engine/simulate';
import type { EngineTeam, EnginePlayer } from '../src/engine/types';

function makePlayer(
  id: string,
  name: string,
  position: EnginePlayer['position'],
  overall: number,
): EnginePlayer {
  const base = overall;
  return {
    id,
    name,
    position,
    overall,
    attack: position === 'FWD' ? base + 5 : position === 'MID' ? base : position === 'DEF' ? base - 15 : 20,
    defense: position === 'DEF' ? base + 5 : position === 'MID' ? base : position === 'FWD' ? base - 25 : 60,
    speed: base,
    goalkeeping: position === 'GK' ? base + 5 : 10,
  };
}

function makeTeam(name: string, overall: number): EngineTeam {
  const starters: EnginePlayer[] = [];
  starters.push(makePlayer(`${name}-gk`, `${name} GK`, 'GK', overall));
  for (let i = 0; i < 4; i++) starters.push(makePlayer(`${name}-def${i}`, `${name} DEF${i}`, 'DEF', overall));
  for (let i = 0; i < 4; i++) starters.push(makePlayer(`${name}-mid${i}`, `${name} MID${i}`, 'MID', overall));
  for (let i = 0; i < 2; i++) starters.push(makePlayer(`${name}-fwd${i}`, `${name} FWD${i}`, 'FWD', overall));
  const subs: EnginePlayer[] = [];
  for (let i = 0; i < 7; i++) subs.push(makePlayer(`${name}-sub${i}`, `${name} SUB${i}`, 'MID', overall - 5));
  return {
    clubId: `${name}-id`,
    clubName: name,
    formation: '4-4-2',
    style: 'balanced',
    starters,
    subs,
  };
}

function single() {
  const home = makeTeam('Home', 75);
  const away = makeTeam('Away', 70);
  const result = simulate(home, away, 12345);

  console.log(`Score: ${result.homeScore}:${result.awayScore} (shots ${result.homeShots} vs ${result.awayShots})`);
  console.log(`Total events: ${result.events.length}\n`);

  console.log('--- Sample events ---');
  for (const e of result.events.slice(0, 20)) {
    console.log(`  ${String(e.minute).padStart(2)}'  ${e.type.padEnd(8)}  ${e.description}`);
  }
  console.log('  ...');
  for (const e of result.events.slice(-5)) {
    console.log(`  ${String(e.minute).padStart(2)}'  ${e.type.padEnd(8)}  ${e.description}`);
  }

  // Determinism check
  const r2 = simulate(home, away, 12345);
  console.log(`\nDeterminism: same seed → ${r2.homeScore}:${r2.awayScore} ${r2.events.length} events ✓`);
  if (r2.homeScore !== result.homeScore || r2.awayScore !== result.awayScore) {
    console.error('!! NON-DETERMINISTIC');
    process.exit(1);
  }
}

function stats() {
  const home = makeTeam('Home', 75);
  const away = makeTeam('Away', 75);

  const N = 1000;
  let totalGoals = 0;
  let totalEvents = 0;
  let homeWins = 0,
    awayWins = 0,
    draws = 0;
  const goalsHist = new Map<number, number>();
  let totalReds = 0;
  let totalYellows = 0;
  let totalShots = 0;

  for (let i = 0; i < N; i++) {
    const r = simulate(home, away, i);
    totalGoals += r.homeScore + r.awayScore;
    totalEvents += r.events.length;
    totalShots += r.homeShots + r.awayShots;
    if (r.homeScore > r.awayScore) homeWins++;
    else if (r.homeScore < r.awayScore) awayWins++;
    else draws++;
    const sum = r.homeScore + r.awayScore;
    goalsHist.set(sum, (goalsHist.get(sum) ?? 0) + 1);
    for (const e of r.events) {
      if (e.type === 'yellow') totalYellows++;
      if (e.type === 'red') totalReds++;
    }
  }

  console.log(`\n--- Stats from ${N} sims, equal-strength teams (75 vs 75) ---`);
  console.log(`Avg goals/match: ${(totalGoals / N).toFixed(2)} (target ~2.5)`);
  console.log(`Avg events/match: ${(totalEvents / N).toFixed(1)} (target 30-80)`);
  console.log(`Avg shots/match: ${(totalShots / N).toFixed(1)}`);
  console.log(`Win distribution: home ${homeWins}, draw ${draws}, away ${awayWins}`);
  console.log(`Avg yellows/match: ${(totalYellows / N).toFixed(2)}`);
  console.log(`Avg reds/match: ${(totalReds / N).toFixed(3)}`);
  console.log(`Goals/match distribution:`);
  const sortedKeys = Array.from(goalsHist.keys()).sort((a, b) => a - b);
  for (const k of sortedKeys) {
    const count = goalsHist.get(k)!;
    const pct = (count / N) * 100;
    const bar = '█'.repeat(Math.round(pct / 2));
    console.log(`  ${String(k).padStart(2)}: ${String(count).padStart(4)}  ${bar} ${pct.toFixed(1)}%`);
  }

  // Now test that stronger team usually wins
  const strong = makeTeam('Strong', 85);
  const weak = makeTeam('Weak', 65);
  let strongWins = 0,
    weakWins = 0,
    sDraws = 0;
  for (let i = 0; i < N; i++) {
    const r = simulate(strong, weak, i);
    if (r.homeScore > r.awayScore) strongWins++;
    else if (r.homeScore < r.awayScore) weakWins++;
    else sDraws++;
  }
  console.log(`\nStrong (85) vs Weak (65): strong ${strongWins}, draw ${sDraws}, weak ${weakWins}`);
}

single();
stats();
process.exit(0);
