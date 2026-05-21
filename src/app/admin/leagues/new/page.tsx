import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { playerTemplates } from '@/db/schema/players';
import { LeagueCreateForm } from '@/components/league-create-form';

export default async function NewLeaguePage() {
  const [stats] = await db.select({ count: sql<number>`count(*)::int` }).from(playerTemplates);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Новая лига</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Снимок игроков из базы → распределение по клубам → расписание сезона.
        </p>
      </div>

      <LeagueCreateForm playerCount={stats?.count ?? 0} />
    </div>
  );
}
