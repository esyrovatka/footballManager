import Link from 'next/link';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs, leagues } from '@/db/schema/leagues';
import { leaguePlayers, playerTemplates } from '@/db/schema/players';
import { transferOffers } from '@/db/schema/transfers';
import { AppHeader } from '@/components/app-header';
import {
  MakeOfferRow,
  OfferDecisionButtons,
  SignFreeAgentButton,
} from '@/components/transfer-buttons';
import { marketValueFromOverall } from '@/lib/transfers';

type Position = 'GK' | 'DEF' | 'MID' | 'FWD';
const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

const POSITION_LABEL: Record<Position, string> = {
  GK: 'Вратарь',
  DEF: 'Защитник',
  MID: 'Полузащитник',
  FWD: 'Нападающий',
};

export default async function TransfersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; clubId: string }>;
  searchParams: Promise<{ pos?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id, clubId } = await params;
  const { pos = '' } = await searchParams;

  const [clubRow] = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      budget: clubs.budget,
      managerUserId: clubs.managerUserId,
      leagueId: leagues.id,
      leagueName: leagues.name,
    })
    .from(clubs)
    .innerJoin(leagues, eq(leagues.id, clubs.leagueId))
    .where(and(eq(clubs.id, clubId), eq(clubs.leagueId, id)))
    .limit(1);

  if (!clubRow) notFound();
  if (clubRow.managerUserId !== session.user.id && !session.user.isAdmin) {
    redirect(`/leagues/${id}/clubs/${clubId}`);
  }

  // Incoming offers (for my players)
  const incoming = await db
    .select({
      id: transferOffers.id,
      amount: transferOffers.amount,
      createdAt: transferOffers.createdAt,
      playerId: transferOffers.playerId,
      playerName: playerTemplates.name,
      position: playerTemplates.position,
      currentOverall: leaguePlayers.currentOverall,
      fromClubId: transferOffers.fromClubId,
      fromClubName: clubs.name,
    })
    .from(transferOffers)
    .innerJoin(leaguePlayers, eq(leaguePlayers.id, transferOffers.playerId))
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .innerJoin(clubs, eq(clubs.id, transferOffers.fromClubId))
    .where(and(eq(transferOffers.toClubId, clubId), eq(transferOffers.status, 'pending')))
    .orderBy(desc(transferOffers.createdAt));

  // Outgoing offers
  const outgoing = await db
    .select({
      id: transferOffers.id,
      amount: transferOffers.amount,
      status: transferOffers.status,
      createdAt: transferOffers.createdAt,
      resolvedAt: transferOffers.resolvedAt,
      playerName: playerTemplates.name,
      toClubId: transferOffers.toClubId,
      toClubName: clubs.name,
    })
    .from(transferOffers)
    .innerJoin(leaguePlayers, eq(leaguePlayers.id, transferOffers.playerId))
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .innerJoin(clubs, eq(clubs.id, transferOffers.toClubId))
    .where(eq(transferOffers.fromClubId, clubId))
    .orderBy(desc(transferOffers.createdAt))
    .limit(20);

  // Free agents (all in this league)
  const freeAgents = await db
    .select({
      id: leaguePlayers.id,
      currentOverall: leaguePlayers.currentOverall,
      currentAge: leaguePlayers.currentAge,
      name: playerTemplates.name,
      position: playerTemplates.position,
      nationality: playerTemplates.nationality,
    })
    .from(leaguePlayers)
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .where(and(eq(leaguePlayers.leagueId, id), isNull(leaguePlayers.clubId)))
    .orderBy(desc(leaguePlayers.currentOverall));

  // Browse other clubs' players, optionally filtered by position
  const positionFilter = POSITIONS.includes(pos as Position) ? (pos as Position) : null;
  const browseList = positionFilter
    ? await db
        .select({
          id: leaguePlayers.id,
          currentOverall: leaguePlayers.currentOverall,
          currentAge: leaguePlayers.currentAge,
          name: playerTemplates.name,
          position: playerTemplates.position,
          clubId: clubs.id,
          clubName: clubs.name,
        })
        .from(leaguePlayers)
        .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
        .innerJoin(clubs, eq(clubs.id, leaguePlayers.clubId))
        .where(
          and(
            eq(leaguePlayers.leagueId, id),
            ne(leaguePlayers.clubId, clubId),
            eq(playerTemplates.position, positionFilter),
          ),
        )
        .orderBy(desc(leaguePlayers.currentOverall))
        .limit(30)
    : [];

  return (
    <>
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <Link href={`/leagues/${id}/clubs/${clubId}`} className="text-sm text-neutral-500 hover:underline">
            ← {clubRow.name}
          </Link>
          <div className="flex items-baseline justify-between mt-2">
            <h1 className="text-2xl font-semibold">Трансферный рынок</h1>
            <div className="text-sm text-neutral-500">
              Бюджет:{' '}
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                €{(clubRow.budget / 1_000_000).toFixed(1)}M
              </span>
            </div>
          </div>
        </div>

        {incoming.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">
              Входящие офферы <span className="text-amber-600">({incoming.length})</span>
            </h2>
            <div className="space-y-2">
              {incoming.map((o) => {
                const marketValue = marketValueFromOverall(o.currentOverall);
                return (
                  <div
                    key={o.id}
                    className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 flex flex-wrap items-center gap-3 justify-between"
                  >
                    <div>
                      <div className="font-medium">{o.playerName}</div>
                      <div className="text-xs text-neutral-500">
                        {o.position} · OVR {o.currentOverall} · от {o.fromClubName} ·{' '}
                        предложение: <span className="font-mono">€{(o.amount / 1_000_000).toFixed(1)}M</span>
                        {' '}(маркет ~€{(marketValue / 1_000_000).toFixed(1)}M)
                      </div>
                    </div>
                    <OfferDecisionButtons offerId={o.id} isIncoming />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {outgoing.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Исходящие офферы</h2>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    <th className="px-3 py-2 font-medium">Игрок</th>
                    <th className="px-3 py-2 font-medium">Клуб</th>
                    <th className="px-3 py-2 font-medium text-right">Сумма</th>
                    <th className="px-3 py-2 font-medium">Статус</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {outgoing.map((o) => (
                    <tr key={o.id} className="border-b border-neutral-200 dark:border-neutral-800 last:border-0">
                      <td className="px-3 py-2 font-medium">{o.playerName}</td>
                      <td className="px-3 py-2">{o.toClubName}</td>
                      <td className="px-3 py-2 text-right font-mono">€{(o.amount / 1_000_000).toFixed(1)}M</td>
                      <td className="px-3 py-2 text-xs">
                        <span
                          className={
                            o.status === 'accepted'
                              ? 'text-green-600'
                              : o.status === 'rejected'
                                ? 'text-red-600'
                                : o.status === 'withdrawn'
                                  ? 'text-neutral-500'
                                  : 'text-amber-600'
                          }
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {o.status === 'pending' && <OfferDecisionButtons offerId={o.id} isIncoming={false} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-3">
            Свободные агенты <span className="text-neutral-500 text-sm">({freeAgents.length})</span>
          </h2>
          {freeAgents.length === 0 ? (
            <p className="text-sm text-neutral-500">Свободных агентов нет</p>
          ) : (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    <th className="px-3 py-2 font-medium">Имя</th>
                    <th className="px-3 py-2 font-medium">Поз</th>
                    <th className="px-3 py-2 font-medium text-right">OVR</th>
                    <th className="px-3 py-2 font-medium text-right">Возраст</th>
                    <th className="px-3 py-2 font-medium">Нация</th>
                    <th className="px-3 py-2 text-right">Цена</th>
                  </tr>
                </thead>
                <tbody>
                  {freeAgents.map((p) => {
                    const price = marketValueFromOverall(p.currentOverall);
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-neutral-200 dark:border-neutral-800 last:border-0"
                      >
                        <td className="px-3 py-2 font-medium">
                          <Link href={`/leagues/${id}/players/${p.id}`} className="hover:underline">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs">{p.position}</td>
                        <td className="px-3 py-2 text-right font-semibold">{p.currentOverall}</td>
                        <td className="px-3 py-2 text-right text-neutral-500">{p.currentAge}</td>
                        <td className="px-3 py-2 text-xs text-neutral-500">{p.nationality ?? '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <SignFreeAgentButton clubId={clubId} playerId={p.id} price={price} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Игроки других клубов</h2>
          <div className="mb-3 flex gap-2 flex-wrap">
            {POSITIONS.map((p) => (
              <Link
                key={p}
                href={`/leagues/${id}/clubs/${clubId}/transfers?pos=${p}`}
                className={`rounded-md px-3 py-1 text-xs border ${
                  positionFilter === p
                    ? 'bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white border-neutral-900 dark:border-neutral-100'
                    : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {POSITION_LABEL[p]}
              </Link>
            ))}
            {positionFilter && (
              <Link
                href={`/leagues/${id}/clubs/${clubId}/transfers`}
                className="rounded-md px-3 py-1 text-xs text-neutral-500 hover:underline"
              >
                Сбросить
              </Link>
            )}
          </div>

          {!positionFilter ? (
            <p className="text-sm text-neutral-500">Выбери позицию, чтобы посмотреть топ-30 по overall</p>
          ) : (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    <th className="px-3 py-2 font-medium">Имя</th>
                    <th className="px-3 py-2 font-medium">Клуб</th>
                    <th className="px-3 py-2 font-medium text-right">OVR</th>
                    <th className="px-3 py-2 font-medium text-right">Возраст</th>
                    <th className="px-3 py-2 text-right">Маркет</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {browseList.map((p) => {
                    const market = marketValueFromOverall(p.currentOverall);
                    return (
                      <tr
                        key={p.id}
                        className="border-b border-neutral-200 dark:border-neutral-800 last:border-0"
                      >
                        <td className="px-3 py-2 font-medium">
                          <Link href={`/leagues/${id}/players/${p.id}`} className="hover:underline">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <Link href={`/leagues/${id}/clubs/${p.clubId}`} className="hover:underline">
                            {p.clubName}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">{p.currentOverall}</td>
                        <td className="px-3 py-2 text-right text-neutral-500">{p.currentAge}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">€{(market / 1_000_000).toFixed(1)}M</td>
                        <td className="px-3 py-2 text-right">
                          <MakeOfferRow fromClubId={clubId} playerId={p.id} suggested={Math.round(market * 1.2)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
