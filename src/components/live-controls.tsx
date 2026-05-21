'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { liveSubAction, type LiveActionState } from '@/lib/actions/live';
import type { LineupPlayer } from '@/lib/match-day/get-match-lineup';

const POSITION_LABEL: Record<LineupPlayer['position'], string> = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
};

function SubBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-3 py-1.5 text-sm disabled:opacity-50"
    >
      {pending ? 'Применяем...' : 'Заменить'}
    </button>
  );
}

const fieldClass =
  'rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm';

export function LiveControls({
  matchId,
  clubName,
  starters,
  subs,
  subsUsed,
  maxSubs,
}: {
  matchId: string;
  clubName: string;
  starters: LineupPlayer[];
  subs: LineupPlayer[];
  subsUsed: number;
  maxSubs: number;
}) {
  const [state, setState] = useState<LiveActionState>(undefined);
  const [count, setCount] = useState(subsUsed);
  const [outId, setOutId] = useState(starters[0]?.id ?? '');
  const [inId, setInId] = useState(subs[0]?.id ?? '');

  async function handle(formData: FormData) {
    formData.set('playerOut', outId);
    formData.set('playerIn', inId);
    const res = await liveSubAction(matchId, formData);
    setState(res);
    if (res?.ok) setCount((c) => c + 1);
  }

  const exhausted = count >= maxSubs;

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Live-управление · {clubName}</div>
          <div className="text-xs text-neutral-500">
            Использовано замен: <span className="font-mono">{count} / {maxSubs}</span>
          </div>
        </div>
      </div>

      {exhausted ? (
        <p className="text-sm text-neutral-500">Лимит замен исчерпан.</p>
      ) : (
        <form action={handle} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Снять</span>
            <select value={outId} onChange={(e) => setOutId(e.target.value)} className={fieldClass}>
              {starters.map((p) => (
                <option key={p.id} value={p.id}>
                  {POSITION_LABEL[p.position]} · {p.name} ({p.currentOverall})
                </option>
              ))}
            </select>
          </label>
          <span className="text-neutral-400 px-1">→</span>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-500">Выпустить</span>
            <select value={inId} onChange={(e) => setInId(e.target.value)} className={fieldClass}>
              {subs.map((p) => (
                <option key={p.id} value={p.id}>
                  {POSITION_LABEL[p.position]} · {p.name} ({p.currentOverall})
                </option>
              ))}
            </select>
          </label>
          <SubBtn />
        </form>
      )}

      {state?.ok && <p className="text-sm text-green-600">{state.ok}</p>}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </div>
  );
}
