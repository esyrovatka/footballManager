'use client';

import { useFormStatus } from 'react-dom';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm('Удалить игрока навсегда?')) e.preventDefault();
      }}
      className="text-sm rounded-md border border-red-300 dark:border-red-900 text-red-600 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
    >
      {pending ? '...' : 'Удалить'}
    </button>
  );
}

export function DeletePlayerButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <SubmitButton />
    </form>
  );
}
