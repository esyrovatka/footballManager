'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import type { PlayerFormState } from '@/lib/actions/players';

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const;

export type PlayerFormDefaults = {
  name?: string;
  position?: (typeof POSITIONS)[number];
  baseOverall?: number;
  age?: number;
  peakAge?: number;
  growthRate?: number;
  declineRate?: number;
  nationality?: string | null;
  attack?: number;
  defense?: number;
  speed?: number;
  goalkeeping?: number;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-50"
    >
      {pending ? '...' : label}
    </button>
  );
}

const fieldClass =
  'w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-3">
    <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{title}</h3>
    {children}
  </div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className="text-xs text-neutral-500">{label}</span>
    {children}
  </label>
);

export function PlayerTemplateForm({
  action,
  defaults,
  submitLabel,
  cancelHref,
  extraActions,
}: {
  action: (prev: PlayerFormState, formData: FormData) => Promise<PlayerFormState>;
  defaults?: PlayerFormDefaults;
  submitLabel: string;
  cancelHref: string;
  extraActions?: React.ReactNode;
}) {
  const [state, formAction] = useActionState<PlayerFormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <Section title="Основное">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Имя">
            <input name="name" required defaultValue={defaults?.name ?? ''} className={fieldClass} />
          </Field>
          <Field label="Позиция">
            <select name="position" defaultValue={defaults?.position ?? 'MID'} className={fieldClass}>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Нация (код, напр. UA)">
            <input
              name="nationality"
              defaultValue={defaults?.nationality ?? ''}
              maxLength={3}
              className={fieldClass}
            />
          </Field>
          <Field label="Возраст">
            <input
              name="age"
              type="number"
              min={15}
              max={45}
              required
              defaultValue={defaults?.age ?? 22}
              className={fieldClass}
            />
          </Field>
        </div>
      </Section>

      <Section title="Прогрессия">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Base Overall (0-100)">
            <input
              name="baseOverall"
              type="number"
              min={0}
              max={100}
              required
              defaultValue={defaults?.baseOverall ?? 70}
              className={fieldClass}
            />
          </Field>
          <Field label="Peak Age (18-35)">
            <input
              name="peakAge"
              type="number"
              min={18}
              max={35}
              required
              defaultValue={defaults?.peakAge ?? 27}
              className={fieldClass}
            />
          </Field>
          <div />
          <Field label="Growth Rate (до пика, -5 до 5)">
            <input
              name="growthRate"
              type="number"
              step="0.1"
              min={-5}
              max={5}
              required
              defaultValue={defaults?.growthRate ?? 1.5}
              className={fieldClass}
            />
          </Field>
          <Field label="Decline Rate (после пика, -5 до 5)">
            <input
              name="declineRate"
              type="number"
              step="0.1"
              min={-5}
              max={5}
              required
              defaultValue={defaults?.declineRate ?? -1.5}
              className={fieldClass}
            />
          </Field>
        </div>
      </Section>

      <Section title="Атрибуты (0-100)">
        <div className="grid grid-cols-4 gap-3">
          <Field label="Атака">
            <input
              name="attack"
              type="number"
              min={0}
              max={100}
              required
              defaultValue={defaults?.attack ?? 70}
              className={fieldClass}
            />
          </Field>
          <Field label="Защита">
            <input
              name="defense"
              type="number"
              min={0}
              max={100}
              required
              defaultValue={defaults?.defense ?? 70}
              className={fieldClass}
            />
          </Field>
          <Field label="Скорость">
            <input
              name="speed"
              type="number"
              min={0}
              max={100}
              required
              defaultValue={defaults?.speed ?? 70}
              className={fieldClass}
            />
          </Field>
          <Field label="Вратарские">
            <input
              name="goalkeeping"
              type="number"
              min={0}
              max={100}
              required
              defaultValue={defaults?.goalkeeping ?? 10}
              className={fieldClass}
            />
          </Field>
        </div>
      </Section>

      {state?.error && (
        <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded p-3">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
        <SubmitButton label={submitLabel} />
        <Link
          href={cancelHref}
          className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline px-3 py-2"
        >
          Отмена
        </Link>
        {extraActions && <div className="ml-auto">{extraActions}</div>}
      </div>
    </form>
  );
}
