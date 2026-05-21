"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type MatchEventDto = {
  id: string;
  minute: number;
  type: string;
  clubId: string | null;
  playerId: string | null;
  description: string;
};

type SnapshotData = {
  status: "scheduled" | "running" | "finished";
  currentMinute: number;
  homeScore: number;
  awayScore: number;
  events: MatchEventDto[];
};

type StateData = {
  status: "scheduled" | "running" | "finished";
  currentMinute: number;
  homeScore: number;
  awayScore: number;
};

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  kickoff: { label: "▶", cls: "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300" },
  goal: { label: "⚽", cls: "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 font-semibold" },
  chance: { label: "!", cls: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300" },
  save: { label: "🧤", cls: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300" },
  foul: { label: "⚠", cls: "bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400" },
  yellow: { label: "🟨", cls: "bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300" },
  red: { label: "🟥", cls: "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-semibold" },
  sub: { label: "⇄", cls: "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300" },
  corner: { label: "⌐", cls: "bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400" },
  injury: { label: "+", cls: "bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400" },
  key_pass: { label: "→", cls: "bg-neutral-100 dark:bg-neutral-900 text-neutral-500" },
  halftime: { label: "||", cls: "bg-neutral-200 dark:bg-neutral-800 text-neutral-700" },
  fulltime: { label: "■", cls: "bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-semibold" },
};

export function MatchLive({
  matchId,
  homeName,
  awayName,
  initialSnapshot,
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  initialSnapshot: SnapshotData;
}) {
  const [snap, setSnap] = useState<SnapshotData>(initialSnapshot);
  const [connected, setConnected] = useState(false);
  const seenIds = useRef(new Set<string>(initialSnapshot.events.map(e => e.id)));
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialSnapshot.status === "finished") return;
    const es = new EventSource(`/api/matches/${matchId}/stream`);

    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("error", () => setConnected(false));

    es.addEventListener("snapshot", e => {
      const data = JSON.parse((e as MessageEvent).data) as SnapshotData;
      seenIds.current = new Set(data.events.map(ev => ev.id));
      setSnap(data);
    });

    es.addEventListener("event", e => {
      const ev = JSON.parse((e as MessageEvent).data) as MatchEventDto;
      if (seenIds.current.has(ev.id)) return;
      seenIds.current.add(ev.id);
      setSnap(prev => ({ ...prev, events: [...prev.events, ev] }));
    });

    es.addEventListener("state", e => {
      const data = JSON.parse((e as MessageEvent).data) as StateData;
      setSnap(prev => ({ ...prev, ...data }));
    });

    es.addEventListener("done", () => {
      es.close();
      setConnected(false);
    });

    return () => es.close();
  }, [matchId, initialSnapshot.status]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [snap.events.length]);

  const sortedEvents = useMemo(() => [...snap.events].sort((a, b) => a.minute - b.minute), [snap.events]);

  const statusLabel = useMemo(() => {
    if (snap.status === "finished") return "Матч завершён";
    if (snap.status === "scheduled") return "Ещё не начался";
    return `${snap.currentMinute}'`;
  }, [snap.status, snap.currentMinute]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 bg-neutral-50 dark:bg-neutral-900">
        <div className="flex items-center justify-between gap-4">
          <div className="text-right flex-1">
            <div className="text-xs uppercase text-neutral-500 tracking-wide mb-1">Дома</div>
            <div className="text-xl font-semibold">{homeName}</div>
          </div>
          <div className="flex flex-col items-center min-w-[120px]">
            <div className="text-4xl font-bold font-mono tabular-nums">
              {snap.homeScore} : {snap.awayScore}
            </div>
            <div className="text-xs text-neutral-500 mt-1">{statusLabel}</div>
            {snap.status === "running" && (
              <div className="mt-2 flex items-center gap-1">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-neutral-400"}`} />
                <span className="text-[10px] uppercase text-neutral-500 tracking-wide">{connected ? "live" : "offline"}</span>
              </div>
            )}
          </div>
          <div className="text-left flex-1">
            <div className="text-xs uppercase text-neutral-500 tracking-wide mb-1">Гости</div>
            <div className="text-xl font-semibold">{awayName}</div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Лента событий</h2>
        <div ref={feedRef} className="rounded-lg border border-neutral-200 dark:border-neutral-800 max-h-[60vh] overflow-y-auto">
          {sortedEvents.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-neutral-500">События появятся когда матч начнётся</p>
          ) : (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {sortedEvents.map(e => {
                const badge = TYPE_BADGE[e.type] ?? { label: "·", cls: "bg-neutral-100 text-neutral-500" };
                return (
                  <li key={e.id} className="px-3 py-2 flex items-start gap-3 text-sm">
                    <span className="font-mono text-xs text-neutral-500 w-8 text-right shrink-0">{e.minute}'</span>
                    <span className={`inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded text-xs ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="flex-1">{e.description}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
