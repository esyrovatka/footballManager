'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs, leagues, seasons } from '@/db/schema/leagues';
import { leaguePlayers, playerTemplates } from '@/db/schema/players';
import { matches } from '@/db/schema/matches';
import { buildRoundRobin } from '@/lib/schedule';
import { distributePlayers } from '@/lib/distribute-players';
import { salaryFromOverall } from '@/lib/transfers';

export type CreateLeagueState = { error?: string } | undefined;

const STARTING_BUDGET = 50_000_000; // €50M
const PLAYERS_PER_CLUB_TARGET = 22; // a bit more than 18 to allow some flexibility
const ALLOWED_CLUB_COUNTS = [8, 10] as const;
const SEASON_CONTRACT_LENGTH = 3;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/login');
}

function nextMatchDate(daysFromNow: number, matchTime: string): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const [h, m, s] = matchTime.split(':').map(Number);
  date.setHours(h ?? 20, m ?? 0, s ?? 0, 0);
  return date;
}

export async function createLeagueAction(
  _prev: CreateLeagueState,
  formData: FormData,
): Promise<CreateLeagueState> {
  await requireAdmin();

  const name = String(formData.get('name') ?? '').trim();
  const numClubs = Number(formData.get('numClubs'));
  const matchTime = String(formData.get('matchTime') ?? '20:00');
  const timezone = String(formData.get('timezone') ?? 'Europe/Kyiv').trim() || 'Europe/Kyiv';
  const clubNamesRaw = String(formData.get('clubNames') ?? '');

  if (!name) return { error: 'Название лиги обязательно' };
  if (!(ALLOWED_CLUB_COUNTS as readonly number[]).includes(numClubs)) {
    return { error: `Количество клубов должно быть одним из: ${ALLOWED_CLUB_COUNTS.join(', ')}` };
  }
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(matchTime)) {
    return { error: 'Время матча в формате HH:MM' };
  }

  const clubNames = clubNamesRaw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (clubNames.length !== numClubs) {
    return { error: `Введите ровно ${numClubs} названий клубов (по одному на строку), сейчас ${clubNames.length}` };
  }
  if (new Set(clubNames.map((n) => n.toLowerCase())).size !== clubNames.length) {
    return { error: 'Названия клубов должны быть уникальными' };
  }

  const totalNeeded = numClubs * PLAYERS_PER_CLUB_TARGET;
  const allTemplates = await db.select().from(playerTemplates);
  if (allTemplates.length < totalNeeded) {
    return {
      error: `Нужно минимум ${totalNeeded} игроков в базе (сейчас ${allTemplates.length}). Сгенерируй больше на /admin/players.`,
    };
  }

  // Pick top by overall to ensure decent quality; shuffle within tier for variety
  const selected = [...allTemplates].sort((a, b) => b.baseOverall - a.baseOverall).slice(0, totalNeeded);

  let leagueId: string;
  await db.transaction(async (tx) => {
    const [league] = await tx
      .insert(leagues)
      .values({
        name,
        status: 'setup',
        seasonNumber: 1,
        currentRound: 0,
        matchTimeLocal: matchTime.length === 5 ? `${matchTime}:00` : matchTime,
        timezone,
      })
      .returning();
    leagueId = league.id;

    const insertedClubs = await tx
      .insert(clubs)
      .values(
        clubNames.map((clubName) => ({
          leagueId: league.id,
          name: clubName,
          budget: STARTING_BUDGET,
          isBot: true,
        })),
      )
      .returning();

    const distributable = selected.map((t) => ({
      id: t.id,
      position: t.position,
      baseOverall: t.baseOverall,
      age: t.age,
      attributes: t.attributes,
    }));
    const buckets = distributePlayers(distributable, numClubs);

    const leaguePlayerRows: (typeof leaguePlayers.$inferInsert)[] = [];
    buckets.forEach((bucket, idx) => {
      const club = insertedClubs[idx];
      for (const player of bucket) {
        const template = selected.find((t) => t.id === player.id)!;
        leaguePlayerRows.push({
          leagueId: league.id,
          clubId: club.id,
          templateId: template.id,
          currentOverall: template.baseOverall,
          currentAge: template.age,
          attributes: template.attributes,
          contractSalary: salaryFromOverall(template.baseOverall),
          contractUntilSeason: 1 + SEASON_CONTRACT_LENGTH,
        });
      }
    });
    await tx.insert(leaguePlayers).values(leaguePlayerRows);

    // Remaining templates become free agents (clubId = null)
    const usedIds = new Set(selected.map((t) => t.id));
    const freeAgents = allTemplates.filter((t) => !usedIds.has(t.id));
    if (freeAgents.length > 0) {
      await tx.insert(leaguePlayers).values(
        freeAgents.map((t) => ({
          leagueId: league.id,
          clubId: null,
          templateId: t.id,
          currentOverall: t.baseOverall,
          currentAge: t.age,
          attributes: t.attributes,
          contractSalary: salaryFromOverall(t.baseOverall),
          contractUntilSeason: 1,
        })),
      );
    }

    const [season] = await tx
      .insert(seasons)
      .values({ leagueId: league.id, seasonNumber: 1, status: 'active' })
      .returning();

    // Build schedule
    const rounds = buildRoundRobin(numClubs);
    const matchRows: (typeof matches.$inferInsert)[] = [];
    rounds.forEach((round, roundIdx) => {
      const scheduledAt = nextMatchDate(roundIdx + 1, matchTime);
      for (const pair of round) {
        matchRows.push({
          seasonId: season.id,
          round: roundIdx + 1,
          homeClubId: insertedClubs[pair.home].id,
          awayClubId: insertedClubs[pair.away].id,
          scheduledAt,
          status: 'scheduled',
        });
      }
    });
    await tx.insert(matches).values(matchRows);
  });

  revalidatePath('/admin/leagues');
  revalidatePath('/admin');
  redirect(`/admin/leagues/${leagueId!}`);
}
