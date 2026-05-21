import { bigint, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { clubs, seasons } from './leagues';
import { leaguePlayers } from './players';

export const matchStatusEnum = pgEnum('match_status', ['scheduled', 'running', 'finished']);

export const formationEnum = pgEnum('formation', [
  '4-4-2',
  '4-3-3',
  '3-5-2',
  '5-3-2',
  '4-2-3-1',
  '4-5-1',
]);

export const styleEnum = pgEnum('style', ['attack', 'balanced', 'defense']);

export const matchEventTypeEnum = pgEnum('match_event_type', [
  'kickoff',
  'chance',
  'goal',
  'save',
  'foul',
  'yellow',
  'red',
  'sub',
  'corner',
  'injury',
  'key_pass',
  'halftime',
  'fulltime',
]);

export const liveDirectiveTypeEnum = pgEnum('live_directive_type', ['sub', 'tactic_change']);

export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  seasonId: uuid('season_id')
    .notNull()
    .references(() => seasons.id, { onDelete: 'cascade' }),
  round: integer('round').notNull(),
  homeClubId: uuid('home_club_id')
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  awayClubId: uuid('away_club_id')
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'date' }).notNull(),
  status: matchStatusEnum('status').notNull().default('scheduled'),
  homeScore: integer('home_score').notNull().default(0),
  awayScore: integer('away_score').notNull().default(0),
  currentMinute: integer('current_minute').notNull().default(0),
  engineSeed: bigint('engine_seed', { mode: 'number' }),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
});

export type MatchEventPayload = Record<string, unknown>;

export const matchEvents = pgTable('match_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  minute: integer('minute').notNull(),
  type: matchEventTypeEnum('type').notNull(),
  clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),
  playerId: uuid('player_id').references(() => leaguePlayers.id, { onDelete: 'set null' }),
  description: text('description').notNull(),
  payload: jsonb('payload').$type<MatchEventPayload>(),
  revealedAt: timestamp('revealed_at', { withTimezone: true, mode: 'date' }),
});

export const lineups = pgTable('lineups', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  clubId: uuid('club_id')
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  formation: formationEnum('formation').notNull(),
  style: styleEnum('style').notNull(),
  starters: uuid('starters').array().notNull(),
  subs: uuid('subs').array().notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export type SubRuleCondition =
  | { type: 'losing_after_minute'; minute: number }
  | { type: 'drawing_after_minute'; minute: number }
  | { type: 'winning_after_minute'; minute: number }
  | { type: 'player_tired'; playerId: string; threshold: number }
  | { type: 'player_yellow'; playerId: string };

export const subRules = pgTable('sub_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  lineupId: uuid('lineup_id')
    .notNull()
    .references(() => lineups.id, { onDelete: 'cascade' }),
  condition: jsonb('condition').$type<SubRuleCondition>().notNull(),
  playerInId: uuid('player_in_id').notNull(),
  playerOutId: uuid('player_out_id').notNull(),
  priority: integer('priority').notNull().default(0),
});

export type LiveDirectivePayload =
  | { type: 'sub'; playerInId: string; playerOutId: string }
  | { type: 'tactic_change'; formation?: string; style?: string };

export const liveDirectives = pgTable('live_directives', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  clubId: uuid('club_id')
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  type: liveDirectiveTypeEnum('type').notNull(),
  payload: jsonb('payload').$type<LiveDirectivePayload>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'date' }),
});
