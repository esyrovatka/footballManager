'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  acceptOfferAction,
  makeOfferAction,
  rejectOfferAction,
  signFreeAgentAction,
  withdrawOfferAction,
  type TransferState,
} from '@/lib/actions/transfers';

function PendingButton({ label, variant }: { label: string; variant: 'default' | 'danger' | 'primary' }) {
  const { pending } = useFormStatus();
  const classes =
    variant === 'danger'
      ? 'rounded-md border border-red-300 dark:border-red-900 text-red-600 px-2.5 py-1 text-xs hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50'
      : variant === 'primary'
        ? 'rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-2.5 py-1 text-xs disabled:opacity-50'
        : 'rounded-md border border-neutral-300 dark:border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50';
  return (
    <button type="submit" disabled={pending} className={classes}>
      {pending ? '...' : label}
    </button>
  );
}

export function SignFreeAgentButton({
  clubId,
  playerId,
  price,
}: {
  clubId: string;
  playerId: string;
  price: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function handle() {
    setError(null);
    setOk(null);
    const res = await signFreeAgentAction(clubId, playerId);
    if (res?.error) setError(res.error);
    if (res?.ok) setOk(res.ok);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={handle}>
        <PendingButton label={`Подписать за €${(price / 1_000_000).toFixed(1)}M`} variant="primary" />
      </form>
      {error && <span className="text-xs text-red-600">{error}</span>}
      {ok && <span className="text-xs text-green-600">{ok}</span>}
    </div>
  );
}

export function MakeOfferRow({
  fromClubId,
  playerId,
  suggested,
}: {
  fromClubId: string;
  playerId: string;
  suggested: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<TransferState>(undefined);

  async function handle(formData: FormData) {
    formData.set('playerId', playerId);
    const res = await makeOfferAction(fromClubId, undefined, formData);
    setState(res);
    if (res?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setState(undefined);
        }}
        className="text-xs rounded-md border border-neutral-300 dark:border-neutral-700 px-2.5 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        Сделать оффер
      </button>
    );
  }

  return (
    <form action={handle} className="flex flex-col items-end gap-1">
      <div className="flex gap-1 items-center">
        <input
          name="amount"
          type="number"
          min={1_000_000}
          step={500_000}
          defaultValue={suggested}
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-xs w-32 bg-white dark:bg-neutral-900"
        />
        <PendingButton label="Отправить" variant="primary" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-500 hover:underline"
        >
          ×
        </button>
      </div>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state?.ok && <span className="text-xs text-green-600">{state.ok}</span>}
    </form>
  );
}

export function OfferDecisionButtons({ offerId, isIncoming }: { offerId: string; isIncoming: boolean }) {
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setError(null);
    const res = await acceptOfferAction(offerId);
    if (res?.error) setError(res.error);
  }

  async function reject() {
    setError(null);
    const res = await rejectOfferAction(offerId);
    if (res?.error) setError(res.error);
  }

  async function withdraw() {
    setError(null);
    const res = await withdrawOfferAction(offerId);
    if (res?.error) setError(res.error);
  }

  if (isIncoming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex gap-1">
          <form action={accept}>
            <PendingButton label="Принять" variant="primary" />
          </form>
          <form action={reject}>
            <PendingButton label="Отклонить" variant="danger" />
          </form>
        </div>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={withdraw}>
        <PendingButton label="Отозвать" variant="default" />
      </form>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
