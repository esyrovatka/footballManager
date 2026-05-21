'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { setReadyAction, startLeagueAction, type ReadyState } from '@/lib/actions/readiness';

function Btn({ label, variant = 'primary' }: { label: string; variant?: 'primary' | 'secondary' }) {
  const { pending } = useFormStatus();
  const cls =
    variant === 'primary'
      ? 'rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-50'
      : 'rounded-md border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50';
  return (
    <button type="submit" disabled={pending} className={cls}>
      {pending ? '...' : label}
    </button>
  );
}

export function StartLeagueButton({ leagueId }: { leagueId: string }) {
  const [state, setState] = useState<ReadyState>(undefined);

  async function handle() {
    const res = await startLeagueAction(leagueId);
    setState(res);
  }

  return (
    <div className="flex items-center gap-3">
      <form action={handle}>
        <Btn label="Запустить лигу" />
      </form>
      {state?.ok && <span className="text-sm text-green-600">{state.ok}</span>}
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
    </div>
  );
}

export function ReadyButton({
  clubId,
  isReady,
  nextRound,
  disabled,
  disabledReason,
}: {
  clubId: string;
  isReady: boolean;
  nextRound: number;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, setState] = useState<ReadyState>(undefined);
  const [optimistic, setOptimistic] = useState(isReady);

  async function handle() {
    const next = !optimistic;
    setOptimistic(next);
    const res = await setReadyAction(clubId, next);
    if (res?.error) {
      setOptimistic(!next);
    }
    setState(res);
  }

  if (disabled) {
    return (
      <div className="text-sm text-neutral-500">
        {disabledReason ?? 'Сейчас идёт тур, ждём окончания.'}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <form action={handle}>
        {optimistic ? (
          <Btn label={`✓ Готов к туру ${nextRound}`} variant="secondary" />
        ) : (
          <Btn label={`Готов к туру ${nextRound}?`} />
        )}
      </form>
      {state?.ok && <span className="text-sm text-green-600">{state.ok}</span>}
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
    </div>
  );
}
