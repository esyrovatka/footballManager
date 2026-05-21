import { integer, jsonb, pgEnum, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clubs, leagues } from './leagues';

export const positionEnum = pgEnum('position', ['GK', 'DEF', 'MID', 'FWD']);

export type PlayerAttributes = {
  attack: number;
  defense: number;
  speed: number;
  goalkeeping: number;
};

export const playerTemplates = pgTable('player_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  position: positionEnum('position').notNull(),
  baseOverall: integer('base_overall').notNull(),
  age: integer('age').notNull(),
  peakAge: integer('peak_age').notNull(),
  growthRate: real('growth_rate').notNull(),
  declineRate: real('decline_rate').notNull(),
  nationality: text('nationality'),
  attributes: jsonb('attributes').$type<PlayerAttributes>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const leaguePlayers = pgTable('league_players', {
  id: uuid('id').defaultRandom().primaryKey(),
  leagueId: uuid('league_id')
    .notNull()
    .references(() => leagues.id, { onDelete: 'cascade' }),
  clubId: uuid('club_id').references(() => clubs.id, { onDelete: 'set null' }),
  templateId: uuid('template_id')
    .notNull()
    .references(() => playerTemplates.id, { onDelete: 'restrict' }),
  currentOverall: integer('current_overall').notNull(),
  currentAge: integer('current_age').notNull(),
  attributes: jsonb('attributes').$type<PlayerAttributes>().notNull(),
  yellowCards: integer('yellow_cards').notNull().default(0),
  suspendedUntilRound: integer('suspended_until_round'),
  contractSalary: integer('contract_salary').notNull(),
  contractUntilSeason: integer('contract_until_season').notNull(),
});
