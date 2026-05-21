import { boolean, integer, pgEnum, pgTable, text, time, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const leagueStatusEnum = pgEnum('league_status', ['setup', 'active', 'finished']);
export const seasonStatusEnum = pgEnum('season_status', ['active', 'finished']);

export const leagues = pgTable('leagues', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  status: leagueStatusEnum('status').notNull().default('setup'),
  seasonNumber: integer('season_number').notNull().default(1),
  currentRound: integer('current_round').notNull().default(0),
  matchTimeLocal: time('match_time_local').notNull().default('20:00:00'),
  timezone: text('timezone').notNull().default('Europe/Kyiv'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const clubs = pgTable('clubs', {
  id: uuid('id').defaultRandom().primaryKey(),
  leagueId: uuid('league_id')
    .notNull()
    .references(() => leagues.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  budget: integer('budget').notNull(),
  managerUserId: uuid('manager_user_id').references(() => users.id, { onDelete: 'set null' }),
  isBot: boolean('is_bot').notNull().default(true),
  inviteCode: text('invite_code').unique(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const seasons = pgTable('seasons', {
  id: uuid('id').defaultRandom().primaryKey(),
  leagueId: uuid('league_id')
    .notNull()
    .references(() => leagues.id, { onDelete: 'cascade' }),
  seasonNumber: integer('season_number').notNull(),
  status: seasonStatusEnum('status').notNull().default('active'),
  startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true, mode: 'date' }),
});
