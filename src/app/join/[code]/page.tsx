import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs, leagues } from '@/db/schema/leagues';
import { AcceptInviteForm } from '@/components/accept-invite-form';

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const [invite] = await db
    .select({
      clubId: clubs.id,
      clubName: clubs.name,
      isBot: clubs.isBot,
      leagueName: leagues.name,
      leagueId: leagues.id,
    })
    .from(clubs)
    .innerJoin(leagues, eq(leagues.id, clubs.leagueId))
    .where(eq(clubs.inviteCode, code))
    .limit(1);

  const session = await auth();

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4 py-8">
      <Link href="/" className="text-xl font-semibold mb-6">
        Football Manager
      </Link>
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-sm space-y-4">
        {!invite ? (
          <>
            <h1 className="text-lg font-semibold">Приглашение недействительно</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Ссылка устарела или была отозвана.
            </p>
            <Link href="/" className="block text-center text-sm underline">
              На главную
            </Link>
          </>
        ) : !invite.isBot ? (
          <>
            <h1 className="text-lg font-semibold">Клуб уже занят</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              За {invite.clubName} уже играет другой менеджер.
            </p>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Приглашение</p>
              <h1 className="text-lg font-semibold">{invite.clubName}</h1>
              <p className="text-sm text-neutral-500">{invite.leagueName}</p>
            </div>

            {session?.user ? (
              <>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Вход выполнен как <strong>{session.user.email}</strong>.
                </p>
                <AcceptInviteForm code={code} />
              </>
            ) : (
              <>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Чтобы принять приглашение, войди или зарегистрируйся.
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`/login?returnTo=${encodeURIComponent(`/join/${code}`)}`}
                    className="flex-1 text-center rounded-md bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 text-white py-2 text-sm"
                  >
                    Войти
                  </Link>
                  <Link
                    href={`/register?returnTo=${encodeURIComponent(`/join/${code}`)}`}
                    className="flex-1 text-center rounded-md border border-neutral-300 dark:border-neutral-700 py-2 text-sm"
                  >
                    Регистрация
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
