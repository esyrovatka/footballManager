import Link from 'next/link';
import { and, asc, eq, lte } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs, leagues, seasons } from '@/db/schema/leagues';
import { matches, matchEvents } from '@/db/schema/matches';
import { AppHeader } from '@/components/app-header';
import { MatchLive, type MatchEventDto } from '@/components/match-live';

export const dynamic = 'force-dynamic';

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id, matchId } = await params;

  const [match] = await db
    .select({
      id: matches.id,
      status: matches.status,
      round: matches.round,
      scheduledAt: matches.scheduledAt,
      startedAt: matches.startedAt,
      finishedAt: matches.finishedAt,
      currentMinute: matches.currentMinute,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeClubId: matches.homeClubId,
      awayClubId: matches.awayClubId,
      leagueId: leagues.id,
      leagueName: leagues.name,
    })
    .from(matches)
    .innerJoin(seasons, eq(seasons.id, matches.seasonId))
    .innerJoin(leagues, eq(leagues.id, seasons.leagueId))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match || match.leagueId !== id) notFound();

  const clubRows = await db
    .select({ id: clubs.id, name: clubs.name })
    .from(clubs)
    .where(eq(clubs.leagueId, id));
  const clubMap = new Map(clubRows.map((c) => [c.id, c.name]));
  const homeName = clubMap.get(match.homeClubId) ?? 'Home';
  const awayName = clubMap.get(match.awayClubId) ?? 'Away';

  const now = new Date();
  const revealedEvents = await db
    .select()
    .from(matchEvents)
    .where(and(eq(matchEvents.matchId, matchId), lte(matchEvents.revealedAt, now)))
    .orderBy(asc(matchEvents.revealedAt), asc(matchEvents.minute));

  const events: MatchEventDto[] = revealedEvents.map((e) => ({
    id: e.id,
    minute: e.minute,
    type: e.type,
    clubId: e.clubId,
    playerId: e.playerId,
    description: e.description,
  }));

  // For running matches: compute initial minute from elapsed real time
  const liveMinute =
    match.status === 'finished'
      ? 90
      : match.startedAt
        ? Math.min(90, Math.floor((Date.now() - match.startedAt.getTime()) / 8_000))
        : 0;

  return (
    <>
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <Link href={`/leagues/${id}`} className="text-sm text-neutral-500 hover:underline">
            ← {match.leagueName}
          </Link>
          <div className="text-xs text-neutral-500 mt-2">
            Тур {match.round} · {match.scheduledAt.toLocaleString()}
          </div>
        </div>

        <MatchLive
          matchId={matchId}
          homeName={homeName}
          awayName={awayName}
          initialSnapshot={{
            status: match.status as 'scheduled' | 'running' | 'finished',
            currentMinute: liveMinute,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            events,
          }}
        />

        <div className="text-xs text-neutral-500 flex gap-4">
          <Link href={`/leagues/${id}/clubs/${match.homeClubId}`} className="hover:underline">
            {homeName} →
          </Link>
          <Link href={`/leagues/${id}/clubs/${match.awayClubId}`} className="hover:underline">
            {awayName} →
          </Link>
        </div>
      </main>
    </>
  );
}
