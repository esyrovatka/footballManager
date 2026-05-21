import Link from 'next/link';
import { auth } from '@/auth';
import { LogoutButton } from '@/components/logout-button';

export default async function Home() {
  const session = await auth();

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 text-center">
      <h1 className="text-4xl font-bold mb-3">Football Manager</h1>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-md">
        Симулятор менеджера футбольной команды с мультиплеером и асинхронными матчами в реальном времени.
      </p>

      {session?.user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Вы вошли как <span className="font-medium">{session.user.email}</span>
            {session.user.isAdmin && <span className="ml-2 text-xs uppercase text-amber-600">admin</span>}
          </p>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm"
            >
              Мои клубы
            </Link>
            <Link
              href="/profile"
              className="rounded-md border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm"
            >
              Профиль
            </Link>
            <LogoutButton />
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm"
          >
            Регистрация
          </Link>
        </div>
      )}
    </main>
  );
}
