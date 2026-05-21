'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { createLeagueAction, type CreateLeagueState } from '@/lib/actions/leagues';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-50"
    >
      {pending ? 'Создаём...' : 'Создать лигу'}
    </button>
  );
}

const fieldClass =
  'w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100';

const DEFAULT_CLUB_NAMES_8 = `Arsenal\nChelsea\nLiverpool\nManchester City\nManchester United\nNewcastle\nTottenham\nWest Ham`;
const DEFAULT_CLUB_NAMES_10 = `Arsenal\nChelsea\nLiverpool\nManchester City\nManchester United\nNewcastle\nTottenham\nWest Ham\nBrighton\nAston Villa`;

export function LeagueCreateForm({ playerCount }: { playerCount: number }) {
  const [state, formAction] = useActionState<CreateLeagueState, FormData>(createLeagueAction, undefined);
  const [numClubs, setNumClubs] = useState<8 | 10>(8);
  const requiredPlayers = numClubs * 22;
  const hasEnoughPlayers = playerCount >= requiredPlayers;

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs text-neutral-500">Название лиги</span>
          <input
            name="name"
            required
            defaultValue="Premier Cup"
            className={fieldClass}
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Количество клубов</span>
            <select
              name="numClubs"
              value={numClubs}
              onChange={(e) => setNumClubs(Number(e.target.value) as 8 | 10)}
              className={fieldClass}
            >
              <option value={8}>8</option>
              <option value={10}>10</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Время матчей</span>
            <input name="matchTime" type="time" defaultValue="20:00" className={fieldClass} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-neutral-500">Таймзона</span>
            <input name="timezone" defaultValue="Europe/Kyiv" className={fieldClass} />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs text-neutral-500">
            Названия клубов ({numClubs} штук, по одному на строку)
          </span>
          <textarea
            name="clubNames"
            required
            rows={numClubs}
            defaultValue={numClubs === 8 ? DEFAULT_CLUB_NAMES_8 : DEFAULT_CLUB_NAMES_10}
            key={numClubs}
            className={`${fieldClass} font-mono`}
          />
        </label>
      </div>

      <div
        className={`rounded-md border p-3 text-sm ${
          hasEnoughPlayers
            ? 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
            : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
        }`}
      >
        Игроков в базе: <strong>{playerCount}</strong> / нужно: <strong>{requiredPlayers}</strong>
        {!hasEnoughPlayers && (
          <>
            {' — '}
            <Link href="/admin/players" className="underline">
              сгенерируй больше
            </Link>
          </>
        )}
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded p-3">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
        <SubmitButton />
        <Link href="/admin/leagues" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline px-3 py-2">
          Отмена
        </Link>
      </div>
    </form>
  );
}
