'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toggleAdminAction, type UserActionState } from '@/lib/actions/users';

function Btn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(`${label}?`)) e.preventDefault();
      }}
      className="text-xs rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
    >
      {pending ? '...' : label}
    </button>
  );
}

export function ToggleAdminButton({ userId, isAdmin, isSelf }: { userId: string; isAdmin: boolean; isSelf: boolean }) {
  const [state, setState] = useState<UserActionState>(undefined);

  async function handle() {
    const res = await toggleAdminAction(userId);
    setState(res);
  }

  if (isSelf) {
    return <span className="text-xs text-neutral-400">—</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <form action={handle}>
        <Btn label={isAdmin ? 'Снять админа' : 'Сделать админом'} />
      </form>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </div>
  );
}
