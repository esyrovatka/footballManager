import Link from 'next/link';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs, leagues, seasons } from '@/db/schema/leagues';
import { users } from '@/db/schema/auth';
import { leaguePlayers, playerTemplates } from '@/db/schema/players';
import { matches } from '@/db/schema/matches';
import { AppHeader } from '@/components/app-header';

const POSITION_ORDER: Record<'GK' | 'DEF' | 'MID' | 'FWD', number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
const POSITION_LABEL: Record<'GK' | 'DEF' | 'MID' | 'FWD', string> = {
  GK: 'Вратари',
  DEF: 'Защитники',
  MID: 'Полузащитники',
  FWD: 'Нападающие',
};

export default async function ClubPage({
  params,
}: {
  params: Promise<{ id: string; clubId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id, clubId } = await params;

  const [clubRow] = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      budget: clubs.budget,
      isBot: clubs.isBot,
      managerUserId: clubs.managerUserId,
      managerEmail: users.email,
      managerName: users.name,
      defaultFormation: clubs.defaultFormation,
      defaultStyle: clubs.defaultStyle,
      defaultStartersCount: sql<number>`COALESCE(array_length(${clubs.defaultStarters}, 1), 0)::int`,
      defaultSubsCount: sql<number>`COALESCE(array_length(${clubs.defaultSubs}, 1), 0)::int`,
      defaultSubRulesCount: sql<number>`COALESCE(jsonb_array_length(${clubs.defaultSubRules}), 0)::int`,
      leagueId: leagues.id,
      leagueName: leagues.name,
      leagueStatus: leagues.status,
    })
    .from(clubs)
    .innerJoin(leagues, eq(leagues.id, clubs.leagueId))
    .leftJoin(users, eq(users.id, clubs.managerUserId))
    .where(and(eq(clubs.id, clubId), eq(clubs.leagueId, id)))
    .limit(1);

  if (!clubRow) notFound();

  const roster = await db
    .select({
      id: leaguePlayers.id,
      currentOverall: leaguePlayers.currentOverall,
      currentAge: leaguePlayers.currentAge,
      contractSalary: leaguePlayers.contractSalary,
      contractUntilSeason: leaguePlayers.contractUntilSeason,
      yellowCards: leaguePlayers.yellowCards,
      suspendedUntilRound: leaguePlayers.suspendedUntilRound,
      attributes: leaguePlayers.attributes,
      name: playerTemplates.name,
      position: playerTemplates.position,
      nationality: playerTemplates.nationality,
    })
    .from(leaguePlayers)
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .where(eq(leaguePlayers.clubId, clubId));

  // group by position
  roster.sort((a, b) => {
    if (POSITION_ORDER[a.position] !== POSITION_ORDER[b.position]) {
      return POSITION_ORDER[a.position] - POSITION_ORDER[b.position];
    }
    return b.currentOverall - a.currentOverall;
  });

  const totalSalary = roster.reduce((s, p) => s + p.contractSalary, 0);
  const avgOverall =
    roster.length > 0
      ? Math.round(roster.reduce((s, p) => s + p.currentOverall, 0) / roster.length)
      : 0;

  const [activeSeason] = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.leagueId, id))
    .orderBy(asc(seasons.seasonNumber))
    .limit(1);

  const upcomingFixtures = activeSeason
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
        .where(
          and(
            eq(matches.seasonId, activeSeason.id),
            or(eq(matches.homeClubId, clubId), eq(matches.awayClubId, clubId)),
          ),
        )
        .orderBy(asc(matches.round))
        .limit(8)
    : [];

  const opponentIds = new Set<string>();
  for (const f of upcomingFixtures) {
    opponentIds.add(f.homeClubId);
    opponentIds.add(f.awayClubId);
  }
  const opponentNames =
    opponentIds.size > 0
      ? await db
          .select({ id: clubs.id, name: clubs.name })
          .from(clubs)
          .where(inArray(clubs.id, Array.from(opponentIds)))
      : [];
  const opponentMap = new Map(opponentNames.map((c) => [c.id, c.name]));

  const isMyClub = clubRow.managerUserId === session.user.id;

  // group roster by position
  const byPosition: Record<'GK' | 'DEF' | 'MID' | 'FWD', typeof roster> = {
    GK: [],
    DEF: [],
    MID: [],
    FWD: [],
  };
  for (const p of roster) byPosition[p.position].push(p);

  return (
    <>
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <Link href={`/leagues/${id}`} className="text-sm text-neutral-500 hover:underline">
            ← {clubRow.leagueName}
          </Link>
          <div className="flex items-center justify-between mt-2">
            <h1 className="text-2xl font-semibold">{clubRow.name}</h1>
            {isMyClub && (
              <span className="text-xs uppercase tracking-wide bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-1 rounded">
                Твой клуб
              </span>
            )}
          </div>
          <div className="text-sm text-neutral-500 mt-1">
            Менеджер:{' '}
            {clubRow.managerEmail ? (
              <span className="text-neutral-700 dark:text-neutral-300">
                {clubRow.managerName ?? clubRow.managerEmail}
              </span>
            ) : (
              <span>бот</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Бюджет" value={`€${(clubRow.budget / 1_000_000).toFixed(1)}M`} />
          <Stat label="Зарплат/нед" value={`€${(totalSalary / 1_000_000).toFixed(2)}M`} />
          <Stat label="Игроков" value={String(roster.length)} />
          <Stat label="Avg overall" value={String(avgOverall)} />
        </div>

        {isMyClub && (
          <section className="space-y-3">
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold mb-1">Состав на матч</div>
                  <div className="text-xs text-neutral-500">
                    {clubRow.defaultFormation &&
                    clubRow.defaultStartersCount === 11 &&
                    clubRow.defaultSubsCount === 7 ? (
                      <>
                        <span className="text-green-600">✓ Готов</span> · {clubRow.defaultFormation} ·{' '}
                        {clubRow.defaultStyle}
                      </>
                    ) : (
                      <span className="text-amber-600">Состав не задан — будет авто-заполнен</span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/leagues/${id}/clubs/${clubId}/lineup`}
                  className="rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm whitespace-nowrap"
                >
                  Редактировать
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold mb-1">Правила автозамен</div>
                  <div className="text-xs text-neutral-500">
                    {clubRow.defaultSubRulesCount > 0 ? (
                      <span className="text-green-600">
                        ✓ {clubRow.defaultSubRulesCount} из 3
                      </span>
                    ) : (
                      <span className="text-neutral-500">
                        Не заданы — в live-режиме делай замены вручную
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/leagues/${id}/clubs/${clubId}/substitutions`}
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm whitespace-nowrap"
                >
                  Редактировать
                </Link>
              </div>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-3">Ростер</h2>
          <div className="space-y-4">
            {(['GK', 'DEF', 'MID', 'FWD'] as const).map((pos) => (
              <div key={pos}>
                <div className="text-xs uppercase text-neutral-500 tracking-wide mb-2">
                  {POSITION_LABEL[pos]} ({byPosition[pos].length})
                </div>
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
                      <tr className="border-b border-neutral-200 dark:border-neutral-800">
                        <th className="px-4 py-2 font-medium">Имя</th>
                        <th className="px-4 py-2 font-medium text-right">Overall</th>
                        <th className="px-4 py-2 font-medium text-right">Возраст</th>
                        <th className="px-4 py-2 font-medium">Нация</th>
                        <th className="px-4 py-2 font-medium text-right">ЖК</th>
                        <th className="px-4 py-2 font-medium text-right">Зарплата</th>
                        <th className="px-4 py-2 font-medium text-right">Контракт до</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byPosition[pos].length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-6 text-center text-neutral-500 text-xs">
                            Нет игроков этой позиции
                          </td>
                        </tr>
                      ) : (
                        byPosition[pos].map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-neutral-200 dark:border-neutral-800 last:border-0"
                          >
                            <td className="px-4 py-2">
                              <Link
                                href={`/leagues/${id}/players/${p.id}`}
                                className="hover:underline font-medium"
                              >
                                {p.name}
                              </Link>
                            </td>
                            <td className="px-4 py-2 text-right font-semibold">{p.currentOverall}</td>
                            <td className="px-4 py-2 text-right text-neutral-500">{p.currentAge}</td>
                            <td className="px-4 py-2 text-neutral-500 text-xs">{p.nationality ?? '—'}</td>
                            <td className="px-4 py-2 text-right text-neutral-500 text-xs">
                              {p.yellowCards}
                              {p.suspendedUntilRound && (
                                <span className="ml-1 text-red-600">диск.</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs">
                              €{(p.contractSalary / 1000).toFixed(0)}K
                            </td>
                            <td className="px-4 py-2 text-right text-neutral-500 text-xs">
                              {p.contractUntilSeason}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        {upcomingFixtures.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Ближайшие матчи</h2>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    <th className="px-3 py-2 font-medium">Тур</th>
                    <th className="px-3 py-2 font-medium">Дата</th>
                    <th className="px-3 py-2 font-medium">Соперник</th>
                    <th className="px-3 py-2 font-medium">Дома/В гостях</th>
                    <th className="px-3 py-2 font-medium text-right">Счёт</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingFixtures.map((f) => {
                    const isHome = f.homeClubId === clubId;
                    const opponentId = isHome ? f.awayClubId : f.homeClubId;
                    return (
                      <tr
                        key={f.id}
                        className="border-b border-neutral-200 dark:border-neutral-800 last:border-0"
                      >
                        <td className="px-3 py-2 text-neutral-500">{f.round}</td>
                        <td className="px-3 py-2 text-xs">{f.scheduledAt.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <Link href={`/leagues/${id}/clubs/${opponentId}`} className="hover:underline">
                            {opponentMap.get(opponentId)}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs text-neutral-500">
                          {isHome ? 'Дома' : 'В гостях'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {f.status === 'finished' ? `${f.homeScore} : ${f.awayScore}` : <span className="text-neutral-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}
