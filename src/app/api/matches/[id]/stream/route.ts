import { and, asc, eq, gt, lte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { matches, matchEvents } from '@/db/schema/matches';
import { IN_GAME_MINUTE_REAL_MS } from '@/lib/match-day/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 1500;
const KEEPALIVE_MS = 15_000;
const MAX_STREAM_MS = 14 * 60_000; // safety cap: 14 min

function sseChunk(data: unknown, event?: string): string {
  const lines: string[] = [];
  if (event) lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  return lines.join('\n') + '\n\n';
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params;

  const [match] = await db
    .select({ id: matches.id, status: matches.status })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) {
    return new Response('Match not found', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const closeOnce = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const send = (data: unknown, event?: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseChunk(data, event)));
        } catch {
          closed = true;
        }
      };

      // Initial state + already-revealed events
      const now = new Date();
      const [snapshot] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
      if (!snapshot) {
        closeOnce();
        return;
      }
      const revealed = await db
        .select()
        .from(matchEvents)
        .where(and(eq(matchEvents.matchId, matchId), lte(matchEvents.revealedAt, now)))
        .orderBy(asc(matchEvents.revealedAt), asc(matchEvents.minute));

      send(
        {
          status: snapshot.status,
          currentMinute: snapshot.currentMinute,
          homeScore: snapshot.homeScore,
          awayScore: snapshot.awayScore,
          events: revealed.map(toEventDto),
        },
        'snapshot',
      );

      if (snapshot.status === 'finished') {
        send({}, 'done');
        closeOnce();
        return;
      }

      let lastRevealedAt = revealed.length > 0 ? revealed[revealed.length - 1].revealedAt! : new Date(0);
      const startTime = Date.now();

      const interval = setInterval(async () => {
        if (closed) return;
        try {
          const nowTick = new Date();
          const newEvents = await db
            .select()
            .from(matchEvents)
            .where(
              and(
                eq(matchEvents.matchId, matchId),
                gt(matchEvents.revealedAt, lastRevealedAt),
                lte(matchEvents.revealedAt, nowTick),
              ),
            )
            .orderBy(asc(matchEvents.revealedAt), asc(matchEvents.minute));

          if (newEvents.length > 0) {
            for (const ev of newEvents) {
              send(toEventDto(ev), 'event');
            }
            lastRevealedAt = newEvents[newEvents.length - 1].revealedAt!;
          }

          // Live current minute from elapsed time (cheaper than re-querying match)
          const [stateRow] = await db
            .select({
              status: matches.status,
              currentMinute: matches.currentMinute,
              homeScore: matches.homeScore,
              awayScore: matches.awayScore,
              startedAt: matches.startedAt,
            })
            .from(matches)
            .where(eq(matches.id, matchId))
            .limit(1);

          if (stateRow) {
            // Compute live minute from elapsed (more responsive than DB refresh)
            const elapsedMs = stateRow.startedAt ? Date.now() - stateRow.startedAt.getTime() : 0;
            const liveMinute =
              stateRow.status === 'finished'
                ? 90
                : Math.min(90, Math.floor(elapsedMs / IN_GAME_MINUTE_REAL_MS));

            // Score from revealed goal events to avoid jumping ahead
            const goalsSoFar = await db
              .select({
                clubId: matchEvents.clubId,
                c: sql<number>`count(*)::int`,
              })
              .from(matchEvents)
              .where(
                and(
                  eq(matchEvents.matchId, matchId),
                  eq(matchEvents.type, 'goal'),
                  lte(matchEvents.revealedAt, nowTick),
                ),
              )
              .groupBy(matchEvents.clubId);

            const [m] = await db
              .select({ homeClubId: matches.homeClubId, awayClubId: matches.awayClubId })
              .from(matches)
              .where(eq(matches.id, matchId))
              .limit(1);

            let homeScore = 0;
            let awayScore = 0;
            for (const g of goalsSoFar) {
              if (g.clubId === m?.homeClubId) homeScore = g.c;
              if (g.clubId === m?.awayClubId) awayScore = g.c;
            }

            send(
              { status: stateRow.status, currentMinute: liveMinute, homeScore, awayScore },
              'state',
            );

            if (stateRow.status === 'finished') {
              send({}, 'done');
              clearInterval(interval);
              clearInterval(keepalive);
              closeOnce();
              return;
            }
          }

          if (Date.now() - startTime > MAX_STREAM_MS) {
            clearInterval(interval);
            clearInterval(keepalive);
            closeOnce();
          }
        } catch {
          // swallow transient errors; client will reconnect
        }
      }, POLL_INTERVAL_MS);

      const keepalive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
        }
      }, KEEPALIVE_MS);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        clearInterval(keepalive);
        closeOnce();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function toEventDto(e: typeof matchEvents.$inferSelect) {
  return {
    id: e.id,
    minute: e.minute,
    type: e.type,
    clubId: e.clubId,
    playerId: e.playerId,
    description: e.description,
  };
}
