import Link from 'next/link';
import { asc, desc, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs, leagues, seasons } from '@/db/schema/leagues';
import { matches } from '@/db/schema/matches';
import { newsItems } from '@/db/schema/news';
import { AppHeader } from '@/components/app-header';
import { NewsFeed, type NewsItemRow } from '@/components/news-feed';
import { getStandings } from '@/lib/standings';
import { getTopScorers } from '@/lib/player-stats';

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id } = await params;
  const [league] = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  if (!league) notFound();

  const [activeSeason] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.leagueId, id))
    .orderBy(asc(seasons.seasonNumber))
    .limit(1);

  if (!activeSeason) notFound();

  const [standings, clubList, fixtures, topScorers, recentNews] = await Promise.all([
    getStandings(id, activeSeason.id),
    db
      .select({ id: clubs.id, name: clubs.name, managerUserId: clubs.managerUserId })
      .from(clubs)
      .where(eq(clubs.leagueId, id))
      .orderBy(asc(clubs.name)),
    db
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
      .orderBy(asc(matches.round), asc(matches.scheduledAt)),
    getTopScorers(id, 10),
    db
      .select({
        id: newsItems.id,
        type: newsItems.type,
        createdAt: newsItems.createdAt,
        payload: newsItems.payload,
      })
      .from(newsItems)
      .where(eq(newsItems.leagueId, id))
      .orderBy(desc(newsItems.createdAt))
      .limit(5),
  ]);

  const clubsById = new Map(clubList.map((c) => [c.id, c.name]));
  const myClubId = clubList.find((c) => c.managerUserId === session.user.id)?.id;

  // Group fixtures by round
  const rounds = new Map<number, typeof fixtures>();
  for (const f of fixtures) {
    if (!rounds.has(f.round)) rounds.set(f.round, []);
    rounds.get(f.round)!.push(f);
  }

  return (
    <>
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">{league.name}</h1>
          <div className="text-sm text-neutral-500 mt-1">
            Сезон {league.seasonNumber} · Тур {league.currentRound} / {Array.from(rounds.keys()).length} ·{' '}
            {league.matchTimeLocal}
          </div>
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-3">Турнирная таблица</h2>
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="px-3 py-2 font-medium w-8 text-right">#</th>
                  <th className="px-3 py-2 font-medium">Клуб</th>
                  <th className="px-3 py-2 font-medium text-right">И</th>
                  <th className="px-3 py-2 font-medium text-right">В</th>
                  <th className="px-3 py-2 font-medium text-right">Н</th>
                  <th className="px-3 py-2 font-medium text-right">П</th>
                  <th className="px-3 py-2 font-medium text-right">ГЗ</th>
                  <th className="px-3 py-2 font-medium text-right">ГП</th>
                  <th className="px-3 py-2 font-medium text-right">РЗ</th>
                  <th className="px-3 py-2 font-medium text-right">О</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, idx) => (
                  <tr
                    key={row.club_id}
                    className={`border-b border-neutral-200 dark:border-neutral-800 last:border-0 ${
                      row.club_id === myClubId ? 'bg-amber-50 dark:bg-amber-950/30' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-right text-neutral-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/leagues/${id}/clubs/${row.club_id}`} className="hover:underline">
                        {row.club_name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">{row.played}</td>
                    <td className="px-3 py-2 text-right">{row.wins}</td>
                    <td className="px-3 py-2 text-right">{row.draws}</td>
                    <td className="px-3 py-2 text-right">{row.losses}</td>
                    <td className="px-3 py-2 text-right">{row.goals_for}</td>
                    <td className="px-3 py-2 text-right">{row.goals_against}</td>
                    <td className="px-3 py-2 text-right text-neutral-500">
                      {row.goal_diff > 0 ? '+' : ''}
                      {row.goal_diff}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            И — игры, В/Н/П — победы/ничьи/поражения, ГЗ/ГП — голы забитые/пропущенные, РЗ — разница, О — очки
          </p>
        </section>

        {recentNews.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-semibold">Новости</h2>
              <Link href={`/leagues/${id}/news`} className="text-sm text-neutral-500 hover:underline">
                Все →
              </Link>
            </div>
            <NewsFeed leagueId={id} items={recentNews as NewsItemRow[]} />
          </section>
        )}

        {topScorers.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Бомбардиры</h2>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    <th className="px-3 py-2 font-medium w-8 text-right">#</th>
                    <th className="px-3 py-2 font-medium">Игрок</th>
                    <th className="px-3 py-2 font-medium">Клуб</th>
                    <th className="px-3 py-2 font-medium">Поз</th>
                    <th className="px-3 py-2 font-medium text-right">Голы</th>
                    <th className="px-3 py-2 font-medium text-right">Матчи</th>
                  </tr>
                </thead>
                <tbody>
                  {topScorers.map((p, idx) => (
                    <tr
                      key={p.player_id}
                      className="border-b border-neutral-200 dark:border-neutral-800 last:border-0"
                    >
                      <td className="px-3 py-2 text-right text-neutral-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium">
                        <Link href={`/leagues/${id}/players/${p.player_id}`} className="hover:underline">
                          {p.player_name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {p.club_id ? (
                          <Link href={`/leagues/${id}/clubs/${p.club_id}`} className="hover:underline">
                            {p.club_name}
                          </Link>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">{p.position}</td>
                      <td className="px-3 py-2 text-right font-semibold">{p.goals}</td>
                      <td className="px-3 py-2 text-right text-neutral-500">{p.apps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-3">Календарь</h2>
          <div className="space-y-4">
            {Array.from(rounds.entries()).map(([round, roundFixtures]) => (
              <div
                key={round}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
              >
                <div className="bg-neutral-50 dark:bg-neutral-900 px-4 py-2 text-xs uppercase text-neutral-500 tracking-wide flex justify-between">
                  <span>Тур {round}</span>
                  <span>{roundFixtures[0].scheduledAt.toLocaleDateString()}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {roundFixtures.map((f) => (
                      <tr
                        key={f.id}
                        className="border-t border-neutral-200 dark:border-neutral-800 first:border-t-0"
                      >
                        <td className="px-4 py-2 w-1/2 text-right">
                          <Link
                            href={`/leagues/${id}/clubs/${f.homeClubId}`}
                            className={`hover:underline ${
                              f.homeClubId === myClubId ? 'font-semibold text-amber-700 dark:text-amber-400' : ''
                            }`}
                          >
                            {clubsById.get(f.homeClubId)}
                          </Link>
                        </td>
                        <td className="px-3 py-2 w-20 text-center font-mono">
                          <Link href={`/leagues/${id}/matches/${f.id}`} className="hover:underline">
                            {f.status === 'finished' ? (
                              <span>
                                {f.homeScore} : {f.awayScore}
                              </span>
                            ) : f.status === 'running' ? (
                              <span className="text-green-600 text-xs animate-pulse">LIVE</span>
                            ) : (
                              <span className="text-neutral-400 text-xs">
                                {f.scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="px-4 py-2 w-1/2">
                          <Link
                            href={`/leagues/${id}/clubs/${f.awayClubId}`}
                            className={`hover:underline ${
                              f.awayClubId === myClubId ? 'font-semibold text-amber-700 dark:text-amber-400' : ''
                            }`}
                          >
                            {clubsById.get(f.awayClubId)}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
