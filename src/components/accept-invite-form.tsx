'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { acceptInviteAction, type AcceptInviteState } from '@/lib/actions/invites';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white py-2 text-sm font-medium disabled:opacity-50"
    >
      {pending ? 'Принимаем...' : 'Стать менеджером'}
    </button>
  );
}

export function AcceptInviteForm({ code }: { code: string }) {
  const boundAction = acceptInviteAction.bind(null, code);
  const [state, formAction] = useActionState<AcceptInviteState, FormData>(boundAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded p-3">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
