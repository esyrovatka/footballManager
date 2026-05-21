import Link from 'next/link';
import { and, asc, desc, eq, ilike, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { playerTemplates } from '@/db/schema/players';

type SearchParams = {
  q?: string;
  position?: string;
  sort?: string;
};

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const;

export default async function PlayersListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q = '', position = '', sort = 'overall_desc' } = await searchParams;

  const filters: SQL[] = [];
  if (q) filters.push(ilike(playerTemplates.name, `%${q}%`));
  if (position && (POSITIONS as readonly string[]).includes(position)) {
    filters.push(eq(playerTemplates.position, position as (typeof POSITIONS)[number]));
  }

  const orderBy =
    sort === 'name'
      ? asc(playerTemplates.name)
      : sort === 'age_asc'
        ? asc(playerTemplates.age)
        : sort === 'overall_asc'
          ? asc(playerTemplates.baseOverall)
          : desc(playerTemplates.baseOverall);

  const list = await db
    .select()
    .from(playerTemplates)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(orderBy);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Игроки</h1>
          <p className="text-sm text-neutral-500 mt-1">База шаблонов ({list.length})</p>
        </div>
        <Link
          href="/admin/players/new"
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white px-4 py-2 text-sm"
        >
          + Добавить
        </Link>
      </div>

      <form className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Поиск по имени</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Marco..."
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm bg-white dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Позиция</span>
          <select
            name="position"
            defaultValue={position}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm bg-white dark:bg-neutral-900"
          >
            <option value="">Все</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500">Сортировка</span>
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm bg-white dark:bg-neutral-900"
          >
            <option value="overall_desc">Overall ↓</option>
            <option value="overall_asc">Overall ↑</option>
            <option value="age_asc">Возраст ↑</option>
            <option value="name">Имя</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md border border-neutral-300 dark:border-neutral-700 px-4 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Применить
        </button>
        {(q || position || sort !== 'overall_desc') && (
          <Link href="/admin/players" className="text-sm text-neutral-500 hover:underline self-center">
            Сбросить
          </Link>
        )}
      </form>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="px-4 py-2 font-medium">Имя</th>
              <th className="px-4 py-2 font-medium">Позиция</th>
              <th className="px-4 py-2 font-medium">Overall</th>
              <th className="px-4 py-2 font-medium">Возраст</th>
              <th className="px-4 py-2 font-medium">Peak</th>
              <th className="px-4 py-2 font-medium">Рост/Спад</th>
              <th className="px-4 py-2 font-medium">Нация</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                  Игроки не найдены
                </td>
              </tr>
            ) : (
              list.map((p) => (
                <tr key={p.id} className="border-b border-neutral-200 dark:border-neutral-800 last:border-0">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block rounded bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs">
                      {p.position}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-semibold">{p.baseOverall}</td>
                  <td className="px-4 py-2">{p.age}</td>
                  <td className="px-4 py-2 text-neutral-500">{p.peakAge}</td>
                  <td className="px-4 py-2 text-neutral-500 text-xs">
                    +{p.growthRate.toFixed(1)} / {p.declineRate.toFixed(1)}
                  </td>
                  <td className="px-4 py-2 text-neutral-500">{p.nationality ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/players/${p.id}`}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      Изменить
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
