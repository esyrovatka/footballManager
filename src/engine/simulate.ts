import { mulberry32, weightedPick, type Rng } from './random';
import { computeTeamStrength, type TeamStrength } from './team-strength';
import {
  FULLTIME,
  HALFTIME,
  KICKOFF,
  chanceText,
  cornerText,
  foulText,
  goalText,
  keyPassText,
  redText,
  saveText,
  yellowText,
} from './text-templates';
import type { EngineEvent, EnginePlayer, EngineTeam, EngineResult } from './types';

type Side = 'home' | 'away';

type MatchState = {
  homeScore: number;
  awayScore: number;
  homeShots: number;
  awayShots: number;
  homeOnPitch: EnginePlayer[];
  awayOnPitch: EnginePlayer[];
  // Track yellow cards per player to flag second-yellows as reds
  yellowCount: Map<string, number>;
};

function pitch(state: MatchState, side: Side): EnginePlayer[] {
  return side === 'home' ? state.homeOnPitch : state.awayOnPitch;
}

function score(state: MatchState, side: Side): number {
  return side === 'home' ? state.homeScore : state.awayScore;
}

function bumpScore(state: MatchState, side: Side) {
  if (side === 'home') state.homeScore++;
  else state.awayScore++;
}

function bumpShot(state: MatchState, side: Side) {
  if (side === 'home') state.homeShots++;
  else state.awayShots++;
}

function pickAttacker(rand: Rng, players: EnginePlayer[]): EnginePlayer {
  // Forwards weighted heavily, then mids, then defenders for set pieces
  return weightedPick(rand, players, (p) => {
    const base = p.attack;
    const posMult = p.position === 'FWD' ? 3 : p.position === 'MID' ? 1.5 : p.position === 'DEF' ? 0.3 : 0;
    return base * posMult;
  });
}

function pickDefender(rand: Rng, players: EnginePlayer[]): EnginePlayer {
  return weightedPick(rand, players, (p) => {
    const base = p.defense;
    const posMult = p.position === 'DEF' ? 3 : p.position === 'MID' ? 1.5 : p.position === 'FWD' ? 0.3 : 0;
    return base * posMult;
  });
}

function getGoalkeeper(players: EnginePlayer[]): EnginePlayer | undefined {
  return players.find((p) => p.position === 'GK');
}

/**
 * Probability that a team creates an attacking situation in a given minute.
 * Scales with team's attack vs opponent's defense.
 */
function attackProbability(att: TeamStrength, def: TeamStrength): number {
  const ratio = att.attack / Math.max(40, def.defense);
  return Math.min(0.2, 0.07 * Math.pow(ratio, 1.5));
}

/**
 * Probability that an attacking situation becomes a goal (vs save/miss).
 * Scales with attacker quality vs goalkeeper.
 */
function goalConversion(rand: Rng, attacker: EnginePlayer, gk: EnginePlayer | undefined): 'goal' | 'save' | 'miss' {
  const gkSkill = gk?.goalkeeping ?? 50;
  const attackerSkill = attacker.attack;
  // base 18% conversion at parity, ratio shifts it
  const ratio = attackerSkill / gkSkill;
  const goalProb = Math.max(0.05, Math.min(0.4, 0.18 * Math.pow(ratio, 1.5)));
  const saveProb = 0.5 * (gkSkill / Math.max(50, attackerSkill));
  const roll = rand();
  if (roll < goalProb) return 'goal';
  if (roll < goalProb + saveProb) return 'save';
  return 'miss';
}

export function simulate(home: EngineTeam, away: EngineTeam, seed: number): EngineResult {
  const rand = mulberry32(seed);
  const homeStrength = computeTeamStrength(home);
  const awayStrength = computeTeamStrength(away);

  const state: MatchState = {
    homeScore: 0,
    awayScore: 0,
    homeShots: 0,
    awayShots: 0,
    homeOnPitch: [...home.starters],
    awayOnPitch: [...away.starters],
    yellowCount: new Map(),
  };

  const events: EngineEvent[] = [];
  events.push({
    minute: 0,
    type: 'kickoff',
    description: KICKOFF(home.clubName, away.clubName),
  });

  for (let minute = 1; minute <= 90; minute++) {
    if (minute === 46) {
      events.push({
        minute: 45,
        type: 'halftime',
        description: HALFTIME(state.homeScore, state.awayScore, home.clubName, away.clubName),
      });
    }

    // Roll for events this minute
    runMinute(minute, 'home', home, away, homeStrength, awayStrength, state, events, rand);
    runMinute(minute, 'away', away, home, awayStrength, homeStrength, state, events, rand);
  }

  events.push({
    minute: 90,
    type: 'fulltime',
    description: FULLTIME(state.homeScore, state.awayScore, home.clubName, away.clubName),
  });

  return {
    events,
    homeScore: state.homeScore,
    awayScore: state.awayScore,
    homeShots: state.homeShots,
    awayShots: state.awayShots,
  };
}

function runMinute(
  minute: number,
  side: Side,
  attackingTeam: EngineTeam,
  defendingTeam: EngineTeam,
  attStrength: TeamStrength,
  defStrength: TeamStrength,
  state: MatchState,
  events: EngineEvent[],
  rand: Rng,
) {
  const players = pitch(state, side);
  if (players.length < 7) return; // too many reds, no play

  // 1. Maybe an attacking situation
  if (rand() < attackProbability(attStrength, defStrength)) {
    const attacker = pickAttacker(rand, players);
    bumpShot(state, side);

    // Roll outcome
    const defendingPlayers = pitch(state, side === 'home' ? 'away' : 'home');
    const gk = getGoalkeeper(defendingPlayers);
    const outcome = goalConversion(rand, attacker, gk);

    events.push({
      minute,
      type: 'chance',
      clubId: attackingTeam.clubId,
      playerId: attacker.id,
      description: chanceText(rand, attacker.name),
    });

    if (outcome === 'goal') {
      bumpScore(state, side);
      events.push({
        minute,
        type: 'goal',
        clubId: attackingTeam.clubId,
        playerId: attacker.id,
        description: goalText(rand, attacker.name, gk?.name ?? 'вратарь'),
        payload: {
          newScore: { home: state.homeScore, away: state.awayScore },
        },
      });
    } else if (outcome === 'save') {
      events.push({
        minute,
        type: 'save',
        clubId: defendingTeam.clubId,
        playerId: gk?.id,
        description: saveText(rand, attacker.name, gk?.name ?? 'вратарь'),
      });
    }
    // 'miss' is implicit — just the chance event, no follow-up
  }

  // 2. Maybe a key pass (often standalone narrative)
  if (rand() < 0.025) {
    const passer = pickAttacker(rand, players);
    const receiver = pickAttacker(rand, players.filter((p) => p.id !== passer.id));
    if (receiver) {
      events.push({
        minute,
        type: 'key_pass',
        clubId: attackingTeam.clubId,
        playerId: passer.id,
        description: keyPassText(rand, passer.name, receiver.name),
      });
    }
  }

  // 3. Maybe a corner
  if (rand() < 0.022) {
    events.push({
      minute,
      type: 'corner',
      clubId: attackingTeam.clubId,
      description: cornerText(rand, defendingTeam.clubName),
    });
  }

  // 4. Maybe a foul → maybe card
  if (rand() < 0.06) {
    const defenderPlayers = pitch(state, side === 'home' ? 'away' : 'home');
    if (defenderPlayers.length > 0) {
      const fouler = pickDefender(rand, defenderPlayers);
      events.push({
        minute,
        type: 'foul',
        clubId: side === 'home' ? defendingTeam.clubId : attackingTeam.clubId,
        playerId: fouler.id,
        description: foulText(rand, fouler.name),
      });

      // Card outcome
      const cardRoll = rand();
      if (cardRoll < 0.18) {
        const newYellow = (state.yellowCount.get(fouler.id) ?? 0) + 1;
        state.yellowCount.set(fouler.id, newYellow);
        events.push({
          minute,
          type: 'yellow',
          clubId: side === 'home' ? defendingTeam.clubId : attackingTeam.clubId,
          playerId: fouler.id,
          description: yellowText(fouler.name),
        });
        if (newYellow >= 2) {
          // Second yellow → red
          removePlayer(state, side === 'home' ? 'away' : 'home', fouler.id);
          events.push({
            minute,
            type: 'red',
            clubId: side === 'home' ? defendingTeam.clubId : attackingTeam.clubId,
            playerId: fouler.id,
            description: redText(fouler.name),
          });
        }
      } else if (cardRoll < 0.185) {
        // Direct red (very rare)
        removePlayer(state, side === 'home' ? 'away' : 'home', fouler.id);
        events.push({
          minute,
          type: 'red',
          clubId: side === 'home' ? defendingTeam.clubId : attackingTeam.clubId,
          playerId: fouler.id,
          description: redText(fouler.name),
        });
      }
    }
  }
}

function removePlayer(state: MatchState, side: Side, playerId: string) {
  if (side === 'home') {
    state.homeOnPitch = state.homeOnPitch.filter((p) => p.id !== playerId);
  } else {
    state.awayOnPitch = state.awayOnPitch.filter((p) => p.id !== playerId);
  }
}
