import Link from 'next/link';

type NewsType = 'transfer' | 'match_result' | 'upset' | 'suspension' | 'season_end' | 'season_start';

export type NewsItemRow = {
  id: string;
  type: NewsType;
  createdAt: Date;
  payload: Record<string, unknown>;
};

const TYPE_BADGE: Record<NewsType, { label: string; cls: string }> = {
  transfer: { label: 'Трансфер', cls: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' },
  match_result: { label: 'Результат', cls: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300' },
  upset: { label: 'Сенсация!', cls: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-semibold' },
  suspension: { label: 'Дисквал.', cls: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' },
  season_end: { label: 'Финал сезона', cls: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-semibold' },
  season_start: { label: 'Старт сезона', cls: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300' },
};

function renderItem(leagueId: string, item: NewsItemRow): React.ReactNode {
  const p = item.payload as Record<string, unknown>;
  switch (item.type) {
    case 'transfer': {
      const kind = String(p.kind ?? 'transfer');
      const playerName = String(p.playerName ?? 'Игрок');
      const amount = Number(p.amount ?? 0);
      const amountStr = `€${(amount / 1_000_000).toFixed(1)}M`;
      if (kind === 'free_agent') {
        return (
          <>
            <strong>{playerName}</strong> подписан как свободный агент за {amountStr}.
          </>
        );
      }
      return (
        <>
          <strong>{playerName}</strong> переходит из одного клуба в другой за {amountStr}.
        </>
      );
    }
    case 'match_result': {
      const homeName = String(p.homeName ?? 'Дома');
      const awayName = String(p.awayName ?? 'Гости');
      const homeScore = Number(p.homeScore ?? 0);
      const awayScore = Number(p.awayScore ?? 0);
      const round = Number(p.round ?? 0);
      const matchId = String(p.matchId ?? '');
      return (
        <>
          Тур {round}: <strong>{homeName}</strong>{' '}
          <Link href={`/leagues/${leagueId}/matches/${matchId}`} className="font-mono hover:underline">
            {homeScore} : {awayScore}
          </Link>{' '}
          <strong>{awayName}</strong>
        </>
      );
    }
    case 'upset': {
      const underdog = String(p.underdogName ?? 'Аутсайдер');
      const fav = String(p.favouriteName ?? 'Фаворит');
      const gap = Number(p.overallGap ?? 0);
      return (
        <>
          Сенсация: <strong>{underdog}</strong> обыграл <strong>{fav}</strong> (разница overall {gap})!
        </>
      );
    }
    case 'suspension': {
      const playerName = String(p.playerName ?? 'Игрок');
      const until = Number(p.untilRound ?? 0);
      return (
        <>
          <strong>{playerName}</strong> дисквалифицирован до тура {until}.
        </>
      );
    }
    case 'season_end': {
      const championName = String(p.championName ?? '');
      const seasonNumber = Number(p.seasonNumber ?? 0);
      return (
        <>
          Сезон {seasonNumber} завершён. Чемпион — <strong>{championName}</strong>!
        </>
      );
    }
    case 'season_start': {
      const seasonNumber = Number(p.seasonNumber ?? 0);
      return <>Стартует сезон {seasonNumber}.</>;
    }
    default:
      return <span className="text-neutral-500">Событие</span>;
  }
}

export function NewsFeed({ leagueId, items }: { leagueId: string; items: NewsItemRow[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-sm text-neutral-500">
        Пока ничего не произошло
      </div>
    );
  }

  return (
    <ul className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-800">
      {items.map((item) => {
        const badge = TYPE_BADGE[item.type] ?? { label: item.type, cls: 'bg-neutral-100' };
        return (
          <li key={item.id} className="px-4 py-3 flex items-start gap-3 text-sm">
            <span className={`inline-block rounded text-xs px-2 py-0.5 whitespace-nowrap ${badge.cls}`}>
              {badge.label}
            </span>
            <div className="flex-1">
              <div>{renderItem(leagueId, item)}</div>
              <div className="text-xs text-neutral-500 mt-1">{item.createdAt.toLocaleString()}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
