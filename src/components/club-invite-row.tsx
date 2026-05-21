'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  generateClubInviteAction,
  releaseClubAction,
  revokeClubInviteAction,
} from '@/lib/actions/invites';

function PlainButton({
  action,
  label,
  variant = 'default',
  confirm,
}: {
  action: () => Promise<void>;
  label: string;
  variant?: 'default' | 'danger';
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const classes =
    variant === 'danger'
      ? 'rounded-md border border-red-300 dark:border-red-900 text-red-600 px-2.5 py-1 text-xs hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50'
      : 'rounded-md border border-neutral-300 dark:border-neutral-700 px-2.5 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50';

  return (
    <form action={action} className="inline">
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (confirm && !window.confirm(confirm)) e.preventDefault();
        }}
        className={classes}
      >
        {pending ? '...' : label}
      </button>
    </form>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="font-mono text-xs underline text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100"
    >
      {copied ? 'Скопировано!' : url}
    </button>
  );
}

export function ClubInviteCell({
  clubId,
  isBot,
  managerEmail,
  inviteCode,
  origin,
}: {
  clubId: string;
  isBot: boolean;
  managerEmail: string | null;
  inviteCode: string | null;
  origin: string;
}) {
  if (!isBot && managerEmail) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-green-600 text-xs">{managerEmail}</span>
        <PlainButton
          action={releaseClubAction.bind(null, clubId)}
          label="Отвязать"
          variant="danger"
          confirm="Отвязать менеджера от клуба?"
        />
      </div>
    );
  }

  if (inviteCode) {
    const url = `${origin}/join/${inviteCode}`;
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <CopyLink url={url} />
        <PlainButton action={revokeClubInviteAction.bind(null, clubId)} label="Отозвать" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-neutral-500 text-xs">бот</span>
      <PlainButton action={generateClubInviteAction.bind(null, clubId)} label="Пригласить" />
    </div>
  );
}
