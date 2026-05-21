import { integer, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { clubs, leagues } from './leagues';
import { leaguePlayers, playerTemplates } from './players';

export const transferStatusEnum = pgEnum('transfer_status', [
  'pending',
  'accepted',
  'rejected',
  'withdrawn',
]);

export const transferOffers = pgTable('transfer_offers', {
  id: uuid('id').defaultRandom().primaryKey(),
  leagueId: uuid('league_id')
    .notNull()
    .references(() => leagues.id, { onDelete: 'cascade' }),
  fromClubId: uuid('from_club_id')
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  toClubId: uuid('to_club_id')
    .notNull()
    .references(() => clubs.id, { onDelete: 'cascade' }),
  playerId: uuid('player_id')
    .notNull()
    .references(() => leaguePlayers.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  status: transferStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
});

export const freeAgents = pgTable('free_agents', {
  id: uuid('id').defaultRandom().primaryKey(),
  leagueId: uuid('league_id')
    .notNull()
    .references(() => leagues.id, { onDelete: 'cascade' }),
  playerTemplateId: uuid('player_template_id')
    .notNull()
    .references(() => playerTemplates.id, { onDelete: 'cascade' }),
  askingPrice: integer('asking_price').notNull(),
});
