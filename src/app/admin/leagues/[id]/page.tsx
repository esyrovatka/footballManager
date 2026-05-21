import Link from 'next/link';
import { headers } from 'next/headers';
import { asc, eq, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { clubs, leagues, seasons } from '@/db/schema/leagues';
import { users } from '@/db/schema/auth';
import { leaguePlayers } from '@/db/schema/players';
import { matches } from '@/db/schema/matches';
import { ClubInviteCell } from '@/components/club-invite-row';
import { StartLeagueButton } from '@/components/readiness-controls';
import { getReadinessStatus } from '@/lib/match-day/readiness';

export default async function LeagueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [league] = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  if (!league) notFound();

  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000';
  const proto = hdrs.get('x-forwarded-proto') ?? 'http';
  const origin = `${proto}://${host}`;

  const clubList = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      budget: clubs.budget,
      isBot: clubs.isBot,
      managerUserId: clubs.managerUserId,
      managerEmail: users.email,
      inviteCode: clubs.inviteCode,
      playerCount: sql<number>`(SELECT COUNT(*)::int FROM ${leaguePlayers} WHERE ${leaguePlayers.clubId} = ${clubs.id})`,
      avgOverall: sql<number>`(SELECT ROUND(AVG(${leaguePlayers.currentOverall}))::int FROM ${leaguePlayers} WHERE ${leaguePlayers.clubId} = ${clubs.id})`,
    })
    .from(clubs)
    .leftJoin(users, eq(users.id, clubs.managerUserId))
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
        })
        .from(matches)
        .where(eq(matches.seasonId, activeSeason.id))
        .orderBy(asc(matches.round))
        .limit(20)
    : [];

  const clubsById = new Map(clubList.map((c) => [c.id, c.name]));
  const managedCount = clubList.filter((c) => !c.isBot).length;
  const readiness = await getReadinessStatus(id);

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

      <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
        <h2 className="text-sm font-semibold">Запуск / готовность</h2>
        {league.status === 'setup' ? (
          <>
            <p className="text-xs text-neutral-500">
              Лига создана, но матчи ещё не идут. Нажми «Запустить лигу», после этого менеджеры смогут подтверждать готовность к турам.
            </p>
            <StartLeagueButton leagueId={id} />
          </>
        ) : league.status === 'active' ? (
          <p className="text-xs text-neutral-500">
            Готовы к следующему туру: <span className="font-mono">{readiness.readyHumans} / {readiness.totalHumans}</span>
            {readiness.notReadyHumans.length > 0 && (
              <> · ждём: {readiness.notReadyHumans.map((c) => c.clubName).join(', ')}</>
            )}
          </p>
        ) : (
          <p className="text-xs text-neutral-500">Лига завершена</p>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold">Клубы ({clubList.length})</h2>
          <div className="text-xs text-neutral-500">
            Занято менеджерами: {managedCount} / {clubList.length}
          </div>
        </div>
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
                  <td className="px-4 py-2">
                    <ClubInviteCell
                      clubId={c.id}
                      isBot={c.isBot}
                      managerEmail={c.managerEmail}
                      inviteCode={c.inviteCode}
                      origin={origin}
                    />
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
