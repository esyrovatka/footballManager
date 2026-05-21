import Link from 'next/link';
import { asc, eq, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { clubs, leagues, seasons } from '@/db/schema/leagues';
import { leaguePlayers } from '@/db/schema/players';
import { matches } from '@/db/schema/matches';

export default async function LeagueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [league] = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  if (!league) notFound();

  const clubList = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      budget: clubs.budget,
      isBot: clubs.isBot,
      managerUserId: clubs.managerUserId,
      playerCount: sql<number>`(SELECT COUNT(*)::int FROM ${leaguePlayers} WHERE ${leaguePlayers.clubId} = ${clubs.id})`,
      avgOverall: sql<number>`(SELECT ROUND(AVG(${leaguePlayers.currentOverall}))::int FROM ${leaguePlayers} WHERE ${leaguePlayers.clubId} = ${clubs.id})`,
    })
    .from(clubs)
    .where(eq(clubs.leagueId, id))
    .orderBy(asc(clubs.name));

  const [activeSeason] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.leagueId, id))
    .orderBy(asc(seasons.seasonNumber))
    .limit(1);

  const fixtures = activeSeason
    ? await db
        .select({
          id: matches.id,
          round: matches.round,
          homeClubId: matches.homeClubId,
          awayClubId: matches.awayClubId,
          scheduledAt: matches.scheduledAt,
          status: matches.status,
          homeScore: matches.homeScore,
          awayScore: matches.awayScore,
        })
        .from(matches)
        .where(eq(matches.seasonId, activeSeason.id))
        .orderBy(asc(matches.round))
        .limit(20)
    : [];

  const clubsById = new Map(clubList.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/leagues" className="text-sm text-neutral-500 hover:underline">
          ← Все лиги
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{league.name}</h1>
        <div className="text-sm text-neutral-500 mt-1">
          Статус: {league.status} · Сезон {league.seasonNumber} · Тур {league.currentRound} ·{' '}
          {league.matchTimeLocal} ({league.timezone})
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Клубы ({clubList.length})</h2>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-4 py-2 font-medium">Клуб</th>
                <th className="px-4 py-2 font-medium">Игроков</th>
                <th className="px-4 py-2 font-medium">Avg overall</th>
                <th className="px-4 py-2 font-medium">Бюджет</th>
                <th className="px-4 py-2 font-medium">Менеджер</th>
              </tr>
            </thead>
            <tbody>
              {clubList.map((c) => (
                <tr key={c.id} className="border-b border-neutral-200 dark:border-neutral-800 last:border-0">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2">{c.playerCount}</td>
                  <td className="px-4 py-2">{c.avgOverall ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">€{(c.budget / 1_000_000).toFixed(1)}M</td>
                  <td className="px-4 py-2 text-xs">
                    {c.managerUserId ? (
                      <span className="text-green-600">занят</span>
                    ) : (
                      <span className="text-neutral-500">бот</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Календарь (первые 20 матчей)</h2>
        {fixtures.length === 0 ? (
          <p className="text-sm text-neutral-500">Календарь не сгенерирован</p>
        ) : (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="px-4 py-2 font-medium">Тур</th>
                  <th className="px-4 py-2 font-medium">Дата</th>
                  <th className="px-4 py-2 font-medium">Дома</th>
                  <th className="px-4 py-2 font-medium">Гости</th>
                  <th className="px-4 py-2 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map((f) => (
                  <tr key={f.id} className="border-b border-neutral-200 dark:border-neutral-800 last:border-0">
                    <td className="px-4 py-2 text-neutral-500">{f.round}</td>
                    <td className="px-4 py-2 text-xs">{f.scheduledAt.toLocaleString()}</td>
                    <td className="px-4 py-2">{clubsById.get(f.homeClubId)}</td>
                    <td className="px-4 py-2">{clubsById.get(f.awayClubId)}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-neutral-500">{f.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
