import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { users } from '@/db/schema/auth';
import { clubs, leagues } from '@/db/schema/leagues';
import { ToggleAdminButton } from '@/components/toggle-admin-button';

type ManagedClub = { clubId: string; clubName: string; leagueId: string; leagueName: string };

export default async function AdminUsersPage() {
  const session = await auth();
  const selfId = session?.user?.id ?? '';

  const userList = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      clubsCount: sql<number>`(SELECT COUNT(*)::int FROM ${clubs} WHERE ${clubs.managerUserId} = ${users.id})`,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  // Per-user managed clubs (single query for everyone — small dataset for MVP)
  const allManaged = await db
    .select({
      userId: clubs.managerUserId,
      clubId: clubs.id,
      clubName: clubs.name,
      leagueId: leagues.id,
      leagueName: leagues.name,
    })
    .from(clubs)
    .innerJoin(leagues, eq(leagues.id, clubs.leagueId))
    .where(sql`${clubs.managerUserId} IS NOT NULL`);

  const managedByUser = new Map<string, ManagedClub[]>();
  for (const row of allManaged) {
    if (!row.userId) continue;
    const list = managedByUser.get(row.userId) ?? [];
    list.push({
      clubId: row.clubId,
      clubName: row.clubName,
      leagueId: row.leagueId,
      leagueName: row.leagueName,
    });
    managedByUser.set(row.userId, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Пользователи</h1>
        <p className="text-sm text-neutral-500 mt-1">{userList.length} аккаунтов</p>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Имя</th>
              <th className="px-4 py-2 font-medium">Роль</th>
              <th className="px-4 py-2 font-medium">Клубы</th>
              <th className="px-4 py-2 font-medium">Создан</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {userList.map((u) => {
              const managed = managedByUser.get(u.id) ?? [];
              return (
                <tr key={u.id} className="border-b border-neutral-200 dark:border-neutral-800 last:border-0 align-top">
                  <td className="px-4 py-2 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-2">{u.name ?? '—'}</td>
                  <td className="px-4 py-2">
                    {u.isAdmin ? (
                      <span className="inline-block text-xs uppercase tracking-wide bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                        admin
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-500">user</span>
                    )}
                    {u.id === selfId && <span className="ml-2 text-xs text-neutral-500">(you)</span>}
                  </td>
                  <td className="px-4 py-2">
                    {managed.length === 0 ? (
                      <span className="text-xs text-neutral-400">—</span>
                    ) : (
                      <ul className="text-xs space-y-0.5">
                        {managed.map((m) => (
                          <li key={m.clubId}>
                            <Link
                              href={`/admin/leagues/${m.leagueId}`}
                              className="hover:underline text-neutral-500"
                            >
                              {m.leagueName}
                            </Link>
                            {' · '}
                            <Link
                              href={`/leagues/${m.leagueId}/clubs/${m.clubId}`}
                              className="hover:underline font-medium"
                            >
                              {m.clubName}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-neutral-500">{u.createdAt.toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right">
                    <ToggleAdminButton userId={u.id} isAdmin={u.isAdmin} isSelf={u.id === selfId} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
