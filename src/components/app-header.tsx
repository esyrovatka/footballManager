import Link from 'next/link';
import { auth } from '@/auth';
import { LogoutButton } from '@/components/logout-button';

export async function AppHeader() {
  const session = await auth();

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
        <Link href="/" className="font-semibold">
          Football Manager
        </Link>
        {session?.user && (
          <nav className="flex gap-4 text-sm ml-2">
            <Link href="/dashboard" className="hover:underline">
              Мои клубы
            </Link>
            <Link href="/profile" className="hover:underline">
              Профиль
            </Link>
            {session.user.isAdmin && (
              <Link href="/admin" className="hover:underline text-amber-600">
                Админ
              </Link>
            )}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3">
          {session?.user ? (
            <>
              <span className="text-sm text-neutral-600 dark:text-neutral-400 hidden sm:inline">
                {session.user.email}
              </span>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-3 py-1.5"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
