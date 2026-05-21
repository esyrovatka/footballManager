'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs } from '@/db/schema/leagues';
import { leaguePlayers, playerTemplates } from '@/db/schema/players';
import { isFormation, isStyle, positionsForFormation } from '@/lib/formation';
import {
  MAX_SUB_RULES,
  isValidConditionType,
  type SubRule,
  type SubRuleCondition,
} from '@/lib/sub-rules';

export type LineupFormState = { error?: string; ok?: boolean } | undefined;

const STARTERS_COUNT = 11;
const SUBS_COUNT = 7;

export async function saveDefaultLineupAction(
  clubId: string,
  _prev: LineupFormState,
  formData: FormData,
): Promise<LineupFormState> {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [club] = await db
    .select({ id: clubs.id, leagueId: clubs.leagueId, managerUserId: clubs.managerUserId })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1);

  if (!club) return { error: 'Клуб не найден' };
  if (club.managerUserId !== session.user.id && !session.user.isAdmin) {
    return { error: 'Только менеджер клуба может править состав' };
  }

  const formation = String(formData.get('formation') ?? '');
  const style = String(formData.get('style') ?? '');
  if (!isFormation(formation)) return { error: 'Некорректная формация' };
  if (!isStyle(style)) return { error: 'Некорректный стиль' };

  const startersRaw = formData.getAll('starters').map(String).filter(Boolean);
  const subsRaw = formData.getAll('subs').map(String).filter(Boolean);

  if (startersRaw.length !== STARTERS_COUNT) {
    return { error: `Стартовый состав должен содержать ${STARTERS_COUNT} игроков` };
  }
  if (subsRaw.length !== SUBS_COUNT) {
    return { error: `На скамейке должно быть ${SUBS_COUNT} игроков` };
  }

  const allIds = [...startersRaw, ...subsRaw];
  if (new Set(allIds).size !== allIds.length) {
    return { error: 'Один игрок не может быть в основе и на скамейке одновременно' };
  }

  // Verify all players belong to this club and load their positions
  const players = await db
    .select({ id: leaguePlayers.id, position: playerTemplates.position })
    .from(leaguePlayers)
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .where(and(eq(leaguePlayers.clubId, clubId), inArray(leaguePlayers.id, allIds)));

  if (players.length !== allIds.length) {
    return { error: 'Среди выбранных игроков есть не из этого клуба' };
  }

  const positionById = new Map(players.map((p) => [p.id, p.position]));
  const starterPositions = startersRaw.map((id) => positionById.get(id)!);
  const expected = positionsForFormation(formation);
  const actual = { GK: 0, DEF: 0, MID: 0, FWD: 0 } as typeof expected;
  for (const pos of starterPositions) actual[pos]++;

  for (const pos of ['GK', 'DEF', 'MID', 'FWD'] as const) {
    if (actual[pos] !== expected[pos]) {
      return {
        error: `Формация ${formation} требует ${expected[pos]} ${pos}, а в основе ${actual[pos]}`,
      };
    }
  }

  await db
    .update(clubs)
    .set({
      defaultFormation: formation,
      defaultStyle: style,
      defaultStarters: startersRaw,
      defaultSubs: subsRaw,
    })
    .where(eq(clubs.id, clubId));

  revalidatePath(`/leagues/${club.leagueId}/clubs/${clubId}`);
  revalidatePath(`/leagues/${club.leagueId}/clubs/${clubId}/lineup`);
  return { ok: true };
}

export async function saveSubRulesAction(
  clubId: string,
  _prev: LineupFormState,
  formData: FormData,
): Promise<LineupFormState> {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [club] = await db
    .select({
      id: clubs.id,
      leagueId: clubs.leagueId,
      managerUserId: clubs.managerUserId,
      defaultStarters: clubs.defaultStarters,
      defaultSubs: clubs.defaultSubs,
    })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1);

  if (!club) return { error: 'Клуб не найден' };
  if (club.managerUserId !== session.user.id && !session.user.isAdmin) {
    return { error: 'Только менеджер клуба может править правила' };
  }

  const starters = new Set(club.defaultStarters);
  const subs = new Set(club.defaultSubs);
  if (starters.size === 0 || subs.size === 0) {
    return { error: 'Сначала сохрани стартовый состав' };
  }

  const types = formData.getAll('type').map(String);
  const minutes = formData.getAll('minute').map(String);
  const playerOuts = formData.getAll('playerOut').map(String);
  const playerIns = formData.getAll('playerIn').map(String);

  const ruleCount = types.length;
  if (ruleCount > MAX_SUB_RULES) {
    return { error: `Максимум ${MAX_SUB_RULES} правил` };
  }

  const rules: SubRule[] = [];
  const usedOuts = new Set<string>();
  const usedIns = new Set<string>();

  for (let i = 0; i < ruleCount; i++) {
    const type = types[i];
    if (!isValidConditionType(type)) return { error: `Правило ${i + 1}: некорректное условие` };

    const minute = Number(minutes[i]);
    if (!Number.isFinite(minute) || minute < 1 || minute > 90) {
      return { error: `Правило ${i + 1}: минута должна быть от 1 до 90` };
    }

    const playerOutId = playerOuts[i];
    const playerInId = playerIns[i];

    if (!starters.has(playerOutId)) {
      return { error: `Правило ${i + 1}: «убрать» — игрок не в основе` };
    }
    if (!subs.has(playerInId)) {
      return { error: `Правило ${i + 1}: «выпустить» — игрок не в запасе` };
    }
    if (usedOuts.has(playerOutId)) {
      return { error: `Правило ${i + 1}: этого игрока уже убирают в другом правиле` };
    }
    if (usedIns.has(playerInId)) {
      return { error: `Правило ${i + 1}: этого игрока уже выпускают в другом правиле` };
    }
    usedOuts.add(playerOutId);
    usedIns.add(playerInId);

    const condition: SubRuleCondition = { type, minute };
    rules.push({ condition, playerOutId, playerInId, priority: i });
  }

  await db.update(clubs).set({ defaultSubRules: rules }).where(eq(clubs.id, clubId));

  revalidatePath(`/leagues/${club.leagueId}/clubs/${clubId}`);
  revalidatePath(`/leagues/${club.leagueId}/clubs/${clubId}/substitutions`);
  return { ok: true };
}
