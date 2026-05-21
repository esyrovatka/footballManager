import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs, leagues } from '@/db/schema/leagues';
import { leaguePlayers, playerTemplates } from '@/db/schema/players';
import { AppHeader } from '@/components/app-header';
import { LineupEditor, type RosterPlayer } from '@/components/lineup-editor';

export default async function LineupPage({
  params,
}: {
  params: Promise<{ id: string; clubId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id, clubId } = await params;

  const [club] = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      managerUserId: clubs.managerUserId,
      defaultFormation: clubs.defaultFormation,
      defaultStyle: clubs.defaultStyle,
      defaultStarters: clubs.defaultStarters,
      defaultSubs: clubs.defaultSubs,
      leagueName: leagues.name,
    })
    .from(clubs)
    .innerJoin(leagues, eq(leagues.id, clubs.leagueId))
    .where(and(eq(clubs.id, clubId), eq(clubs.leagueId, id)))
    .limit(1);

  if (!club) notFound();
  if (club.managerUserId !== session.user.id && !session.user.isAdmin) {
    redirect(`/leagues/${id}/clubs/${clubId}`);
  }

  const roster: RosterPlayer[] = await db
    .select({
      id: leaguePlayers.id,
      name: playerTemplates.name,
      position: playerTemplates.position,
      currentOverall: leaguePlayers.currentOverall,
      currentAge: leaguePlayers.currentAge,
    })
    .from(leaguePlayers)
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .where(eq(leaguePlayers.clubId, clubId));

  const rosterIds = new Set(roster.map((p) => p.id));
  const validStarters = (club.defaultStarters ?? []).filter((id) => rosterIds.has(id));
  const validSubs = (club.defaultSubs ?? []).filter((id) => rosterIds.has(id));

  return (
    <>
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <Link href={`/leagues/${id}/clubs/${clubId}`} className="text-sm text-neutral-500 hover:underline">
            ← {club.name}
          </Link>
          <h1 className="text-2xl font-semibold mt-2">Состав на матч</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Этот состав используется на каждый матч, пока не изменишь.
          </p>
        </div>

        <LineupEditor
          clubId={clubId}
          leagueId={id}
          roster={roster}
          initialFormation={club.defaultFormation ?? '4-4-2'}
          initialStyle={club.defaultStyle ?? 'balanced'}
          initialStarters={validStarters}
          initialSubs={validSubs}
        />
      </main>
    </>
  );
}
