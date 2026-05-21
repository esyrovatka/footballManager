'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import {
  FORMATIONS,
  STYLES,
  positionsForFormation,
  type Formation,
  type Style,
} from '@/lib/formation';
import { saveDefaultLineupAction, type LineupFormState } from '@/lib/actions/lineups';

type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type RosterPlayer = {
  id: string;
  name: string;
  position: Position;
  currentOverall: number;
  currentAge: number;
};

const POSITION_LABEL: Record<Position, string> = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
};

const POSITION_ORDER: Record<Position, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-50"
    >
      {pending ? 'Сохраняем...' : 'Сохранить состав'}
    </button>
  );
}

export function LineupEditor({
  clubId,
  leagueId,
  roster,
  initialFormation,
  initialStyle,
  initialStarters,
  initialSubs,
}: {
  clubId: string;
  leagueId: string;
  roster: RosterPlayer[];
  initialFormation: Formation;
  initialStyle: Style;
  initialStarters: string[];
  initialSubs: string[];
}) {
  const [formation, setFormation] = useState<Formation>(initialFormation);
  const [style, setStyle] = useState<Style>(initialStyle);
  const [starters, setStarters] = useState<string[]>(initialStarters);
  const [subs, setSubs] = useState<string[]>(initialSubs);

  const boundAction = saveDefaultLineupAction.bind(null, clubId);
  const [state, formAction] = useActionState<LineupFormState, FormData>(boundAction, undefined);

  const rosterMap = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const expected = positionsForFormation(formation);

  const actualCounts = useMemo(() => {
    const c = { GK: 0, DEF: 0, MID: 0, FWD: 0 } as Record<Position, number>;
    for (const id of starters) {
      const p = rosterMap.get(id);
      if (p) c[p.position]++;
    }
    return c;
  }, [starters, rosterMap]);

  const startersSet = useMemo(() => new Set(starters), [starters]);
  const subsSet = useMemo(() => new Set(subs), [subs]);

  function assignToStarters(playerId: string) {
    const p = rosterMap.get(playerId);
    if (!p) return;
    if (startersSet.has(playerId) || subsSet.has(playerId)) return;
    if (actualCounts[p.position] >= expected[p.position]) return;
    setStarters((prev) => [...prev, playerId]);
  }

  function assignToSubs(playerId: string) {
    if (startersSet.has(playerId) || subsSet.has(playerId)) return;
    if (subs.length >= 7) return;
    setSubs((prev) => [...prev, playerId]);
  }

  function remove(playerId: string) {
    setStarters((prev) => prev.filter((id) => id !== playerId));
    setSubs((prev) => prev.filter((id) => id !== playerId));
  }

  function autoFill() {
    // Greedy: best by overall per position for starters, then any for subs
    const byPosition: Record<Position, RosterPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of roster) byPosition[p.position].push(p);
    for (const pos of Object.keys(byPosition) as Position[]) {
      byPosition[pos].sort((a, b) => b.currentOverall - a.currentOverall);
    }

    const newStarters: string[] = [];
    for (const pos of ['GK', 'DEF', 'MID', 'FWD'] as Position[]) {
      for (let i = 0; i < expected[pos]; i++) {
        const player = byPosition[pos][i];
        if (player) newStarters.push(player.id);
      }
    }

    const used = new Set(newStarters);
    const remaining = roster
      .filter((p) => !used.has(p.id))
      .sort((a, b) => b.currentOverall - a.currentOverall);
    const newSubs = remaining.slice(0, 7).map((p) => p.id);

    setStarters(newStarters);
    setSubs(newSubs);
  }

  function clearAll() {
    setStarters([]);
    setSubs([]);
  }

  // Group roster for the picker
  const rosterByPosition = useMemo(() => {
    const grouped: Record<Position, RosterPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of roster) grouped[p.position].push(p);
    for (const pos of Object.keys(grouped) as Position[]) {
      grouped[pos].sort((a, b) => b.currentOverall - a.currentOverall);
    }
    return grouped;
  }, [roster]);

  // Starters grouped for display
  const startersByPosition = useMemo(() => {
    const grouped: Record<Position, RosterPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const id of starters) {
      const p = rosterMap.get(id);
      if (p) grouped[p.position].push(p);
    }
    return grouped;
  }, [starters, rosterMap]);

  const totalReady = starters.length === 11 && subs.length === 7;
  const formationOk = (['GK', 'DEF', 'MID', 'FWD'] as Position[]).every(
    (pos) => actualCounts[pos] === expected[pos],
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Формация</span>
          <select
            name="formation"
            value={formation}
            onChange={(e) => {
              setFormation(e.target.value as Formation);
              setStarters([]);
            }}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm bg-white dark:bg-neutral-900"
          >
            {FORMATIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Стиль</span>
          <select
            name="style"
            value={style}
            onChange={(e) => setStyle(e.target.value as Style)}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm bg-white dark:bg-neutral-900"
          >
            <option value="attack">атакующий</option>
            <option value="balanced">балансированный</option>
            <option value="defense">защитный</option>
          </select>
        </label>

        <button
          type="button"
          onClick={autoFill}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Авто-состав
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Очистить
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">
              Стартовый состав ({starters.length}/11)
            </h3>
            <div className="space-y-3">
              {(['GK', 'DEF', 'MID', 'FWD'] as Position[]).map((pos) => (
                <div key={pos}>
                  <div
                    className={`text-xs uppercase tracking-wide mb-1.5 ${
                      actualCounts[pos] === expected[pos]
                        ? 'text-green-600'
                        : actualCounts[pos] > expected[pos]
                          ? 'text-red-600'
                          : 'text-neutral-500'
                    }`}
                  >
                    {POSITION_LABEL[pos]} {actualCounts[pos]}/{expected[pos]}
                  </div>
                  <div className="space-y-1">
                    {Array.from({ length: expected[pos] }).map((_, idx) => {
                      const player = startersByPosition[pos][idx];
                      return (
                        <div
                          key={idx}
                          className="rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 text-sm flex items-center justify-between"
                        >
                          {player ? (
                            <>
                              <input type="hidden" name="starters" value={player.id} />
                              <span>
                                {player.name}{' '}
                                <span className="text-neutral-500 text-xs">
                                  · {player.currentOverall} · {player.currentAge}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => remove(player.id)}
                                className="text-xs text-red-600 hover:underline"
                              >
                                убрать
                              </button>
                            </>
                          ) : (
                            <span className="text-neutral-400 text-xs italic">пусто</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Скамейка ({subs.length}/7)</h3>
            <div className="space-y-1">
              {Array.from({ length: 7 }).map((_, idx) => {
                const player = subs[idx] ? rosterMap.get(subs[idx]) : null;
                return (
                  <div
                    key={idx}
                    className="rounded-md border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 text-sm flex items-center justify-between"
                  >
                    {player ? (
                      <>
                        <input type="hidden" name="subs" value={player.id} />
                        <span>
                          <span className="text-xs text-neutral-500 mr-2 font-mono">
                            {POSITION_LABEL[player.position]}
                          </span>
                          {player.name}{' '}
                          <span className="text-neutral-500 text-xs">
                            · {player.currentOverall} · {player.currentAge}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => remove(player.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          убрать
                        </button>
                      </>
                    ) : (
                      <span className="text-neutral-400 text-xs italic">пусто</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Ростер ({roster.length})</h3>
          <div className="space-y-3">
            {(['GK', 'DEF', 'MID', 'FWD'] as Position[]).map((pos) => (
              <div key={pos}>
                <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1.5">
                  {POSITION_LABEL[pos]} ({rosterByPosition[pos].length})
                </div>
                <div className="space-y-1">
                  {rosterByPosition[pos].map((p) => {
                    const inStarters = startersSet.has(p.id);
                    const inSubs = subsSet.has(p.id);
                    const assigned = inStarters || inSubs;
                    const canStart =
                      !assigned && actualCounts[p.position] < expected[p.position];
                    const canBench = !assigned && subs.length < 7;

                    return (
                      <div
                        key={p.id}
                        className={`rounded-md border px-3 py-1.5 text-sm flex items-center justify-between gap-2 ${
                          assigned
                            ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 opacity-60'
                            : 'border-neutral-200 dark:border-neutral-800'
                        }`}
                      >
                        <span>
                          <span className="font-medium">{p.name}</span>{' '}
                          <span className="text-neutral-500 text-xs">
                            · {p.currentOverall} · {p.currentAge}
                          </span>
                          {inStarters && (
                            <span className="ml-2 text-xs text-green-600">в основе</span>
                          )}
                          {inSubs && <span className="ml-2 text-xs text-blue-600">в запасе</span>}
                        </span>
                        {!assigned && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => assignToStarters(p.id)}
                              disabled={!canStart}
                              className="text-xs rounded border border-green-300 dark:border-green-900 text-green-700 dark:text-green-400 px-2 py-0.5 hover:bg-green-50 dark:hover:bg-green-950 disabled:opacity-40"
                              title={
                                canStart
                                  ? 'Поставить в основу'
                                  : `Лимит ${POSITION_LABEL[pos]} заполнен`
                              }
                            >
                              В основу
                            </button>
                            <button
                              type="button"
                              onClick={() => assignToSubs(p.id)}
                              disabled={!canBench}
                              className="text-xs rounded border border-blue-300 dark:border-blue-900 text-blue-700 dark:text-blue-400 px-2 py-0.5 hover:bg-blue-50 dark:hover:bg-blue-950 disabled:opacity-40"
                            >
                              В запас
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <SubmitButton />
        <Link
          href={`/leagues/${leagueId}/clubs/${clubId}`}
          className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline px-3 py-2"
        >
          Назад
        </Link>
        {state?.ok && (
          <span className="text-sm text-green-600">Состав сохранён</span>
        )}
        {state?.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
        {!totalReady && (
          <span className="text-xs text-neutral-500 ml-auto">
            Нужно 11 в основе и 7 в запасе
          </span>
        )}
        {totalReady && !formationOk && (
          <span className="text-xs text-red-600 ml-auto">Состав не соответствует формации</span>
        )}
      </div>
    </form>
  );
}
