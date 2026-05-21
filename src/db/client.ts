import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Build-safe init: postgres.js connects lazily (only on first query), so
// constructing the client with a placeholder URL during `next build` is
// harmless. At runtime, a request that actually hits the DB without
// DATABASE_URL set will fail loudly with the sentinel URL.
const url = process.env.DATABASE_URL ?? 'postgres://missing@localhost:5432/missing';

const client = postgres(url, { prepare: false });

export const db = drizzle(client, { schema });
export type DB = typeof db;
