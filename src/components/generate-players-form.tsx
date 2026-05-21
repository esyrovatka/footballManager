'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { generatePlayersAction, type GenerateState } from '@/lib/actions/players';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
    >
      {pending ? 'Генерация...' : 'Сгенерировать'}
    </button>
  );
}

export function GeneratePlayersForm() {
  const [state, formAction] = useActionState<GenerateState, FormData>(generatePlayersAction, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">Случайные игроки</span>
        <input
          name="count"
          type="number"
          min={1}
          max={500}
          defaultValue={50}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm bg-white dark:bg-neutral-900 w-24"
        />
      </label>
      <SubmitButton />
      {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      {state?.created && <span className="text-sm text-green-600">Добавлено {state.created} игроков</span>}
    </form>
  );
}
