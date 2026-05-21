'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { loginAction, registerAction, type AuthFormState } from '@/lib/actions/auth';

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
    >
      {pending ? '...' : label}
    </button>
  );
}

const fieldClass =
  'w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100';

export function LoginForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="text-lg font-semibold">Вход</h1>

      <label className="block space-y-1">
        <span className="text-sm text-neutral-700 dark:text-neutral-300">Email</span>
        <input name="email" type="email" required autoComplete="email" className={fieldClass} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-neutral-700 dark:text-neutral-300">Пароль</span>
        <input name="password" type="password" required autoComplete="current-password" className={fieldClass} />
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton label="Войти" />

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Нет аккаунта?{' '}
        <Link href="/register" className="underline">
          Регистрация
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(registerAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <h1 className="text-lg font-semibold">Регистрация</h1>

      <label className="block space-y-1">
        <span className="text-sm text-neutral-700 dark:text-neutral-300">Имя (необязательно)</span>
        <input name="name" type="text" autoComplete="name" className={fieldClass} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-neutral-700 dark:text-neutral-300">Email</span>
        <input name="email" type="email" required autoComplete="email" className={fieldClass} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-neutral-700 dark:text-neutral-300">Пароль</span>
        <input name="password" type="password" required minLength={6} autoComplete="new-password" className={fieldClass} />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-neutral-700 dark:text-neutral-300">Повторите пароль</span>
        <input
          name="passwordConfirm"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={fieldClass}
        />
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <SubmitButton label="Создать аккаунт" />

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Уже есть аккаунт?{' '}
        <Link href="/login" className="underline">
          Войти
        </Link>
      </p>
    </form>
  );
}
