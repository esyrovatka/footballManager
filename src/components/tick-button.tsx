'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { tickNowAction, type TickActionState } from '@/lib/actions/match-day';

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-50"
    >
      {pending ? 'Обрабатываем...' : 'Tick now'}
    </button>
  );
}

export function TickButton() {
  const [state, formAction] = useActionState<TickActionState, FormData>(
    async () => tickNowAction(),
    undefined,
  );
  return (
    <div className="flex items-center gap-3">
      <form action={formAction}>
        <Btn />
      </form>
      {state?.ok && <span className="text-sm text-green-600">{state.ok}</span>}
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
    </div>
  );
}
