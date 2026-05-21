import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { clubs, leagues } from '@/db/schema/leagues';

export default async function LeaguesListPage() {
  const list = await db
    .select({
      id: leagues.id,
      name: leagues.name,
      status: leagues.status,
      seasonNumber: leagues.seasonNumber,
      currentRound: leagues.currentRound,
      createdAt: leagues.createdAt,
      clubCount: sql<number>`(SELECT COUNT(*)::int FROM ${clubs} WHERE ${clubs.leagueId} = ${leagues.id})`,
    })
    .from(leagues)
    .orderBy(desc(leagues.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Лиги</h1>
          <p className="text-sm text-neutral-500 mt-1">{list.length} создано</p>
        </div>
        <Link
          href="/admin/leagues/new"
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm"
        >
          + Создать лигу
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center text-neutral-500">
          Лиг ещё нет. Создай первую — будет нужно минимум 176 игроков в базе (8 клубов × 22).
        </div>
      ) : (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-4 py-2 font-medium">Название</th>
                <th className="px-4 py-2 font-medium">Статус</th>
                <th className="px-4 py-2 font-medium">Сезон</th>
                <th className="px-4 py-2 font-medium">Тур</th>
                <th className="px-4 py-2 font-medium">Клубов</th>
                <th className="px-4 py-2 font-medium">Создана</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.id} className="border-b border-neutral-200 dark:border-neutral-800 last:border-0">
                  <td className="px-4 py-2 font-medium">{l.name}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block rounded bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs">
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{l.seasonNumber}</td>
                  <td className="px-4 py-2">{l.currentRound}</td>
                  <td className="px-4 py-2">{l.clubCount}</td>
                  <td className="px-4 py-2 text-neutral-500 text-xs">{l.createdAt.toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/admin/leagues/${l.id}`} className="text-blue-600 hover:underline text-xs">
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
