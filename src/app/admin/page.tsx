import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { playerTemplates } from '@/db/schema/players';
import { leagues } from '@/db/schema/leagues';
import { matches } from '@/db/schema/matches';
import { TickButton } from '@/components/tick-button';

export default async function AdminDashboard() {
  const [playerStats] = await db.select({ count: sql<number>`count(*)::int` }).from(playerTemplates);
  const [leagueStats] = await db.select({ count: sql<number>`count(*)::int` }).from(leagues);
  const [scheduledStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matches)
    .where(sql`${matches.status} = 'scheduled'`);
  const [runningStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matches)
    .where(sql`${matches.status} = 'running'`);
  const [finishedStats] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matches)
    .where(sql`${matches.status} = 'finished'`);

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

      <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
        <h2 className="text-lg font-semibold mb-3">Матчи</h2>
        <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
          <Stat label="Scheduled" value={scheduledStats?.count ?? 0} color="text-neutral-600" />
          <Stat label="Running" value={runningStats?.count ?? 0} color="text-green-600" />
          <Stat label="Finished" value={finishedStats?.count ?? 0} color="text-neutral-400" />
        </div>
        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 space-y-2">
          <p className="text-xs text-neutral-500">
            Tick стартует матчи, у которых пришло время, и финализирует те, у которых истекли 90 минут (по 8 сек/мин real-time).
          </p>
          <TickButton />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
