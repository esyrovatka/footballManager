import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { leagues } from '@/db/schema/leagues';
import { newsItems } from '@/db/schema/news';
import { AppHeader } from '@/components/app-header';
import { NewsFeed, type NewsItemRow } from '@/components/news-feed';

export default async function LeagueNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id } = await params;
  const [league] = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  if (!league) notFound();

  const items = await db
    .select({
      id: newsItems.id,
      type: newsItems.type,
      createdAt: newsItems.createdAt,
      payload: newsItems.payload,
    })
    .from(newsItems)
    .where(eq(newsItems.leagueId, id))
    .orderBy(desc(newsItems.createdAt))
    .limit(100);

  return (
    <>
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <Link href={`/leagues/${id}`} className="text-sm text-neutral-500 hover:underline">
            ← {league.name}
          </Link>
          <h1 className="text-2xl font-semibold mt-2">Лента новостей</h1>
        </div>

        <NewsFeed leagueId={id} items={items as NewsItemRow[]} />
      </main>
    </>
  );
}
