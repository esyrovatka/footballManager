import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { playerTemplates } from '@/db/schema/players';
import { leagues } from '@/db/schema/leagues';

export default async function AdminDashboard() {
  const [playerStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playerTemplates);
  const [leagueStats] = await db.select({ count: sql<number>`count(*)::int` }).from(leagues);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Админ-панель</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/admin/players"
          className="block rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 hover:border-neutral-400 dark:hover:border-neutral-600 transition"
        >
          <div className="text-sm text-neutral-500 mb-1">База игроков</div>
          <div className="text-3xl font-semibold">{playerStats?.count ?? 0}</div>
          <div className="text-xs text-neutral-500 mt-2">шаблонов в базе</div>
        </Link>

        <Link
          href="/admin/leagues"
          className="block rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 hover:border-neutral-400 dark:hover:border-neutral-600 transition"
        >
          <div className="text-sm text-neutral-500 mb-1">Лиги</div>
          <div className="text-3xl font-semibold">{leagueStats?.count ?? 0}</div>
          <div className="text-xs text-neutral-500 mt-2">создано</div>
        </Link>
      </div>
    </div>
  );
}
