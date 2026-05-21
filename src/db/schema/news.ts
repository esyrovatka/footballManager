import { jsonb, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { leagues } from './leagues';

export const newsTypeEnum = pgEnum('news_type', [
  'transfer',
  'match_result',
  'upset',
  'suspension',
  'season_end',
  'season_start',
]);

export type NewsPayload = Record<string, unknown>;

export const newsItems = pgTable('news_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  leagueId: uuid('league_id')
    .notNull()
    .references(() => leagues.id, { onDelete: 'cascade' }),
  type: newsTypeEnum('type').notNull(),
  payload: jsonb('payload').$type<NewsPayload>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
