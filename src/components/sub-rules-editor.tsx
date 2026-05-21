'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { saveSubRulesAction, type LineupFormState } from '@/lib/actions/lineups';
import {
  MAX_SUB_RULES,
  SUB_RULE_CONDITION_LABEL,
  SUB_RULE_CONDITION_TYPES,
  type SubRule,
} from '@/lib/sub-rules';

type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type LineupPlayer = {
  id: string;
  name: string;
  position: Position;
  currentOverall: number;
};

type DraftRule = {
  type: SubRule['condition']['type'];
  minute: number;
  playerOutId: string;
  playerInId: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-50"
    >
      {pending ? 'Сохраняем...' : 'Сохранить правила'}
    </button>
  );
}

const fieldClass =
  'rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100';

export function SubRulesEditor({
  clubId,
  leagueId,
  starters,
  subs,
  initialRules,
}: {
  clubId: string;
  leagueId: string;
  starters: LineupPlayer[];
  subs: LineupPlayer[];
  initialRules: SubRule[];
}) {
  const [rules, setRules] = useState<DraftRule[]>(
    initialRules.map((r) => ({
      type: r.condition.type,
      minute: 'minute' in r.condition ? r.condition.minute : 60,
      playerOutId: r.playerOutId,
      playerInId: r.playerInId,
    })),
  );

  const boundAction = saveSubRulesAction.bind(null, clubId);
  const [state, formAction] = useActionState<LineupFormState, FormData>(boundAction, undefined);

  function updateRule(idx: number, patch: Partial<DraftRule>) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRule(idx: number) {
    setRules((prev) => prev.filter((_, i) => i !== idx));
  }

  function addRule() {
    if (rules.length >= MAX_SUB_RULES) return;
    setRules((prev) => [
      ...prev,
      {
        type: 'losing_after_minute',
        minute: 60,
        playerOutId: starters[0]?.id ?? '',
        playerInId: subs[0]?.id ?? '',
      },
    ]);
  }

  const noLineup = starters.length === 0 || subs.length === 0;

  return (
    <form action={formAction} className="space-y-4">
      {noLineup ? (
        <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-4 text-sm text-amber-700 dark:text-amber-300">
          Сначала сохрани состав на странице{' '}
          <Link href={`/leagues/${leagueId}/clubs/${clubId}/lineup`} className="underline">
            «Состав на матч»
          </Link>
          .
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {rules.length === 0 && (
              <p className="text-sm text-neutral-500">
                Правил пока нет. Они сработают на матч, если ты не зайдёшь в live-режим.
              </p>
            )}
            {rules.map((rule, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-neutral-500">
                    Правило {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRule(idx)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Удалить
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center text-sm">
                  <div className="flex items-center gap-2">
                    <select
                      name="type"
                      value={rule.type}
                      onChange={(e) =>
                        updateRule(idx, { type: e.target.value as DraftRule['type'] })
                      }
                      className={fieldClass + ' flex-1'}
                    >
                      {SUB_RULE_CONDITION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {SUB_RULE_CONDITION_LABEL[t]}
                        </option>
                      ))}
                    </select>
                    <input
                      name="minute"
                      type="number"
                      min={1}
                      max={90}
                      value={rule.minute}
                      onChange={(e) => updateRule(idx, { minute: Number(e.target.value) })}
                      className={fieldClass + ' w-20'}
                    />
                    <span className="text-xs text-neutral-500">мин</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-neutral-500">Снять</span>
                      <select
                        name="playerOut"
                        value={rule.playerOutId}
                        onChange={(e) => updateRule(idx, { playerOutId: e.target.value })}
                        className={fieldClass}
                      >
                        {starters.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.position} · {p.name} ({p.currentOverall})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs text-neutral-500">Выпустить</span>
                      <select
                        name="playerIn"
                        value={rule.playerInId}
                        onChange={(e) => updateRule(idx, { playerInId: e.target.value })}
                        className={fieldClass}
                      >
                        {subs.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.position} · {p.name} ({p.currentOverall})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {rules.length < MAX_SUB_RULES && (
            <button
              type="button"
              onClick={addRule}
              className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm w-full hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              + Добавить правило ({rules.length}/{MAX_SUB_RULES})
            </button>
          )}

          <div className="flex items-center gap-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <SubmitButton />
            <Link
              href={`/leagues/${leagueId}/clubs/${clubId}`}
              className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline px-3 py-2"
            >
              Назад
            </Link>
            {state?.ok && <span className="text-sm text-green-600">Правила сохранены</span>}
            {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
          </div>
        </>
      )}
    </form>
  );
}
