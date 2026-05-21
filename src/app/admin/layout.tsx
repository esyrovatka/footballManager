import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { LogoutButton } from '@/components/logout-button';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!session.user.isAdmin) redirect('/');

  return (
    <div className="min-h-dvh">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
          <Link href="/" className="font-semibold">
            Football Manager
          </Link>
          <span className="text-xs uppercase text-amber-600">admin</span>
          <nav className="flex gap-4 text-sm ml-4">
            <Link href="/admin" className="hover:underline">
              Dashboard
            </Link>
            <Link href="/admin/players" className="hover:underline">
              Игроки
            </Link>
            <Link href="/admin/leagues" className="hover:underline">
              Лиги
            </Link>
            <Link href="/admin/users" className="hover:underline">
              Пользователи
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">{session.user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
