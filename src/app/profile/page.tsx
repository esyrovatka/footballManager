import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { LogoutButton } from '@/components/logout-button';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id, email, name, isAdmin } = session.user;

  return (
    <main className="min-h-dvh px-4 py-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-xl font-semibold">
          Football Manager
        </Link>
        <LogoutButton />
      </div>

      <h1 className="text-2xl font-semibold mb-6">Профиль</h1>

      <dl className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
        <div className="grid grid-cols-3 px-4 py-3 text-sm">
          <dt className="text-neutral-500">ID</dt>
          <dd className="col-span-2 font-mono text-xs">{id}</dd>
        </div>
        <div className="grid grid-cols-3 px-4 py-3 text-sm">
          <dt className="text-neutral-500">Email</dt>
          <dd className="col-span-2">{email}</dd>
        </div>
        <div className="grid grid-cols-3 px-4 py-3 text-sm">
          <dt className="text-neutral-500">Имя</dt>
          <dd className="col-span-2">{name ?? '—'}</dd>
        </div>
        <div className="grid grid-cols-3 px-4 py-3 text-sm">
          <dt className="text-neutral-500">Роль</dt>
          <dd className="col-span-2">{isAdmin ? 'Админ' : 'Пользователь'}</dd>
        </div>
      </dl>

      {isAdmin && (
        <div className="mt-6">
          <Link
            href="/admin"
            className="inline-block rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm"
          >
            Админ-панель
          </Link>
        </div>
      )}
    </main>
  );
}
