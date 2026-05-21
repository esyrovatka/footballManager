import { pgEnum } from 'drizzle-orm/pg-core';

export const formationEnum = pgEnum('formation', [
  '4-4-2',
  '4-3-3',
  '3-5-2',
  '5-3-2',
  '4-2-3-1',
  '4-5-1',
]);

export const styleEnum = pgEnum('style', ['attack', 'balanced', 'defense']);
