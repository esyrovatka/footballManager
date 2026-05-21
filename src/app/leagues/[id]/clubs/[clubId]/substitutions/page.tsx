import Link from 'next/link';
import { and, eq, inArray } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs, leagues } from '@/db/schema/leagues';
import { leaguePlayers, playerTemplates } from '@/db/schema/players';
import { AppHeader } from '@/components/app-header';
import { SubRulesEditor, type LineupPlayer } from '@/components/sub-rules-editor';

export default async function SubstitutionsPage({
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
      defaultStarters: clubs.defaultStarters,
      defaultSubs: clubs.defaultSubs,
      defaultSubRules: clubs.defaultSubRules,
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

  const allIds = [...club.defaultStarters, ...club.defaultSubs];
  const rosterMap = new Map<string, LineupPlayer>();

  if (allIds.length > 0) {
    const rows = await db
      .select({
        id: leaguePlayers.id,
        name: playerTemplates.name,
        position: playerTemplates.position,
        currentOverall: leaguePlayers.currentOverall,
      })
      .from(leaguePlayers)
      .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
      .where(inArray(leaguePlayers.id, allIds));
    for (const r of rows) rosterMap.set(r.id, r);
  }

  const starters = club.defaultStarters
    .map((id) => rosterMap.get(id))
    .filter((p): p is LineupPlayer => Boolean(p));
  const subs = club.defaultSubs
    .map((id) => rosterMap.get(id))
    .filter((p): p is LineupPlayer => Boolean(p));

  return (
    <>
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <Link href={`/leagues/${id}/clubs/${clubId}`} className="text-sm text-neutral-500 hover:underline">
            ← {club.name}
          </Link>
          <h1 className="text-2xl font-semibold mt-2">Правила автозамен</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Сработают на матч, если ты не зайдёшь в live-режим. До {3} правил.
          </p>
        </div>

        <SubRulesEditor
          clubId={clubId}
          leagueId={id}
          starters={starters}
          subs={subs}
          initialRules={club.defaultSubRules}
        />
      </main>
    </>
  );
}
