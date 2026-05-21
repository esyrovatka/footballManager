import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs, leagues } from '@/db/schema/leagues';
import { leaguePlayers, playerTemplates } from '@/db/schema/players';
import { AppHeader } from '@/components/app-header';

const POSITION_LABEL: Record<'GK' | 'DEF' | 'MID' | 'FWD', string> = {
  GK: 'Вратарь',
  DEF: 'Защитник',
  MID: 'Полузащитник',
  FWD: 'Нападающий',
};

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string; playerId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id, playerId } = await params;

  const [player] = await db
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
      peakAge: playerTemplates.peakAge,
      growthRate: playerTemplates.growthRate,
      declineRate: playerTemplates.declineRate,
      nationality: playerTemplates.nationality,
      clubId: clubs.id,
      clubName: clubs.name,
      leagueId: leagues.id,
      leagueName: leagues.name,
    })
    .from(leaguePlayers)
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .leftJoin(clubs, eq(clubs.id, leaguePlayers.clubId))
    .innerJoin(leagues, eq(leagues.id, leaguePlayers.leagueId))
    .where(and(eq(leaguePlayers.id, playerId), eq(leagues.id, id)))
    .limit(1);

  if (!player) notFound();

  // Future projection: where this player will be in 3 seasons
  const futureProjection = projectOverall(
    player.currentOverall,
    player.currentAge,
    player.peakAge,
    player.growthRate,
    player.declineRate,
    3,
  );

  return (
    <>
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div>
          <Link href={`/leagues/${id}`} className="text-sm text-neutral-500 hover:underline">
            ← {player.leagueName}
          </Link>
          <h1 className="text-2xl font-semibold mt-2">{player.name}</h1>
          <div className="text-sm text-neutral-500 mt-1">
            {POSITION_LABEL[player.position]} · {player.currentAge} лет · {player.nationality ?? '—'}
            {player.clubId && player.clubName && (
              <>
                {' · '}
                <Link href={`/leagues/${id}/clubs/${player.clubId}`} className="hover:underline">
                  {player.clubName}
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Overall" value={String(player.currentOverall)} highlight />
          <Stat label="Атака" value={String(player.attributes.attack)} />
          <Stat label="Защита" value={String(player.attributes.defense)} />
          <Stat label="Скорость" value={String(player.attributes.speed)} />
          {player.position === 'GK' && (
            <Stat label="Вратарские" value={String(player.attributes.goalkeeping)} />
          )}
        </div>

        <section>
          <h2 className="text-lg font-semibold mb-3">Контракт</h2>
          <dl className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
            <Row label="Зарплата (нед)" value={`€${(player.contractSalary / 1000).toFixed(0)}K`} />
            <Row label="Контракт до сезона" value={String(player.contractUntilSeason)} />
            <Row label="Жёлтые карточки" value={String(player.yellowCards)} />
            <Row
              label="Дисквалификация"
              value={player.suspendedUntilRound ? `до тура ${player.suspendedUntilRound}` : 'нет'}
            />
          </dl>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Перспектива</h2>
          <dl className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
            <Row label="Возраст пика" value={String(player.peakAge)} />
            <Row label="Рост до пика" value={`+${player.growthRate.toFixed(1)}/год`} />
            <Row label="Спад после пика" value={`${player.declineRate.toFixed(1)}/год`} />
            <Row label="Через 3 сезона" value={`overall ~${futureProjection} (age ${player.currentAge + 3})`} />
          </dl>
        </section>
      </main>
    </>
  );
}

function projectOverall(
  current: number,
  age: number,
  peakAge: number,
  growthRate: number,
  declineRate: number,
  years: number,
): number {
  let overall = current;
  let a = age;
  for (let i = 0; i < years; i++) {
    if (a < peakAge) overall += growthRate;
    else if (a > peakAge + 2) overall += declineRate;
    a += 1;
  }
  return Math.max(40, Math.min(99, Math.round(overall)));
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight
          ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
          : 'border-neutral-200 dark:border-neutral-800'
      }`}
    >
      <div className={`text-xs ${highlight ? 'opacity-70' : 'text-neutral-500'}`}>{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 px-4 py-2.5 text-sm">
      <dt className="text-neutral-500 col-span-1">{label}</dt>
      <dd className="col-span-2 font-medium">{value}</dd>
    </div>
  );
}
