import Link from 'next/link';
import { asc, eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs, leagues } from '@/db/schema/leagues';
import { leaguePlayers } from '@/db/schema/players';
import { AppHeader } from '@/components/app-header';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const myClubs = await db
    .select({
      clubId: clubs.id,
      clubName: clubs.name,
      budget: clubs.budget,
      leagueId: leagues.id,
      leagueName: leagues.name,
      leagueStatus: leagues.status,
      currentRound: leagues.currentRound,
      playerCount: sql<number>`(SELECT COUNT(*)::int FROM ${leaguePlayers} WHERE ${leaguePlayers.clubId} = ${clubs.id})`,
    })
    .from(clubs)
    .innerJoin(leagues, eq(leagues.id, clubs.leagueId))
    .where(eq(clubs.managerUserId, session.user.id))
    .orderBy(asc(leagues.name), asc(clubs.name));

  return (
    <>
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-6">Мои клубы</h1>

        {myClubs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-10 text-center">
            <p className="text-neutral-600 dark:text-neutral-400 mb-2">Ты пока ни в одной лиге.</p>
            <p className="text-sm text-neutral-500">
              Чтобы стать менеджером — попроси администратора прислать ссылку-приглашение на клуб.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myClubs.map((c) => (
              <Link
                key={c.clubId}
                href={`/leagues/${c.leagueId}/clubs/${c.clubId}`}
                className="block rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 hover:border-neutral-400 dark:hover:border-neutral-600 transition"
              >
                <div className="text-xs uppercase text-neutral-500 tracking-wide mb-1">{c.leagueName}</div>
                <div className="text-lg font-semibold">{c.clubName}</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-neutral-500">
                  <div>
                    <div>Игроков</div>
                    <div className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                      {c.playerCount}
                    </div>
                  </div>
                  <div>
                    <div>Бюджет</div>
                    <div className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                      €{(c.budget / 1_000_000).toFixed(1)}M
                    </div>
                  </div>
                  <div>
                    <div>Статус</div>
                    <div className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                      {c.leagueStatus}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
