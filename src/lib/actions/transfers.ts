'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs } from '@/db/schema/leagues';
import { leaguePlayers, playerTemplates } from '@/db/schema/players';
import { transferOffers } from '@/db/schema/transfers';
import { newsItems } from '@/db/schema/news';
import { marketValueFromOverall, salaryFromOverall } from '@/lib/transfers';

export type TransferState = { error?: string; ok?: string } | undefined;

async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return session;
}

async function assertClubManager(clubId: string, userId: string, isAdmin: boolean) {
  const [club] = await db
    .select({ id: clubs.id, leagueId: clubs.leagueId, managerUserId: clubs.managerUserId, budget: clubs.budget })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1);
  if (!club) throw new Error('Клуб не найден');
  if (club.managerUserId !== userId && !isAdmin) {
    throw new Error('Только менеджер клуба может это делать');
  }
  return club;
}

function botShouldAccept(amount: number, marketValue: number, samePositionPlayers: number): boolean {
  // Bot reasoning:
  //  - reject if club would be left with < 3 players at that position
  //  - accept if amount >= 1.2x market value
  //  - accept if amount >= 1.5x regardless of squad depth
  if (amount >= marketValue * 1.5) return true;
  if (samePositionPlayers < 4) return false; // would leave only 3 after sale
  return amount >= marketValue * 1.2;
}

export async function signFreeAgentAction(
  clubId: string,
  playerId: string,
): Promise<TransferState> {
  const session = await requireSession();
  let club;
  try {
    club = await assertClubManager(clubId, session.user.id, session.user.isAdmin);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const [player] = await db
    .select({
      id: leaguePlayers.id,
      leagueId: leaguePlayers.leagueId,
      clubId: leaguePlayers.clubId,
      currentOverall: leaguePlayers.currentOverall,
      name: playerTemplates.name,
    })
    .from(leaguePlayers)
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .where(eq(leaguePlayers.id, playerId))
    .limit(1);

  if (!player || player.leagueId !== club.leagueId) return { error: 'Игрок не найден' };
  if (player.clubId !== null) return { error: 'Игрок уже принадлежит клубу' };

  const price = marketValueFromOverall(player.currentOverall);
  if (club.budget < price) return { error: `Не хватает бюджета: нужно €${(price / 1_000_000).toFixed(1)}M` };

  await db.transaction(async (tx) => {
    await tx
      .update(clubs)
      .set({ budget: sql`${clubs.budget} - ${price}` })
      .where(eq(clubs.id, clubId));
    await tx
      .update(leaguePlayers)
      .set({ clubId, contractSalary: salaryFromOverall(player.currentOverall) })
      .where(eq(leaguePlayers.id, playerId));
    await tx.insert(newsItems).values({
      leagueId: club.leagueId,
      type: 'transfer',
      payload: { kind: 'free_agent', clubId, playerName: player.name, amount: price },
    });
  });

  revalidatePath(`/leagues/${club.leagueId}/clubs/${clubId}`);
  revalidatePath(`/leagues/${club.leagueId}/clubs/${clubId}/transfers`);
  revalidatePath(`/leagues/${club.leagueId}`);
  return { ok: `Подписан ${player.name} за €${(price / 1_000_000).toFixed(1)}M` };
}

export async function makeOfferAction(
  fromClubId: string,
  _prev: TransferState,
  formData: FormData,
): Promise<TransferState> {
  const session = await requireSession();
  let club;
  try {
    club = await assertClubManager(fromClubId, session.user.id, session.user.isAdmin);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const playerId = String(formData.get('playerId') ?? '');
  const amount = Number(formData.get('amount'));
  if (!playerId) return { error: 'Игрок не выбран' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Сумма должна быть > 0' };
  if (amount > club.budget) return { error: 'Не хватает бюджета' };

  const [player] = await db
    .select({
      id: leaguePlayers.id,
      leagueId: leaguePlayers.leagueId,
      clubId: leaguePlayers.clubId,
      currentOverall: leaguePlayers.currentOverall,
      name: playerTemplates.name,
      position: playerTemplates.position,
    })
    .from(leaguePlayers)
    .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
    .where(eq(leaguePlayers.id, playerId))
    .limit(1);

  if (!player || player.leagueId !== club.leagueId) return { error: 'Игрок не найден' };
  if (!player.clubId) return { error: 'Игрок — свободный агент, подписывай прямо' };
  if (player.clubId === fromClubId) return { error: 'Это ваш игрок' };

  const [sellerClub] = await db
    .select({ id: clubs.id, isBot: clubs.isBot, managerUserId: clubs.managerUserId })
    .from(clubs)
    .where(eq(clubs.id, player.clubId))
    .limit(1);

  if (!sellerClub) return { error: 'Клуб-владелец не найден' };

  if (sellerClub.isBot) {
    // Bot decides immediately
    const samePositionCount = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(leaguePlayers)
      .innerJoin(playerTemplates, eq(playerTemplates.id, leaguePlayers.templateId))
      .where(
        and(
          eq(leaguePlayers.clubId, sellerClub.id),
          eq(playerTemplates.position, player.position),
        ),
      );
    const samePos = samePositionCount[0]?.c ?? 0;
    const marketValue = marketValueFromOverall(player.currentOverall);
    const accept = botShouldAccept(amount, marketValue, samePos);

    if (accept) {
      await db.transaction(async (tx) => {
        await tx.insert(transferOffers).values({
          leagueId: club.leagueId,
          fromClubId,
          toClubId: sellerClub.id,
          playerId,
          amount,
          status: 'accepted',
          resolvedAt: new Date(),
        });
        await tx.update(clubs).set({ budget: sql`${clubs.budget} - ${amount}` }).where(eq(clubs.id, fromClubId));
        await tx.update(clubs).set({ budget: sql`${clubs.budget} + ${amount}` }).where(eq(clubs.id, sellerClub.id));
        await tx
          .update(leaguePlayers)
          .set({ clubId: fromClubId, contractSalary: salaryFromOverall(player.currentOverall) })
          .where(eq(leaguePlayers.id, playerId));
        await tx.insert(newsItems).values({
          leagueId: club.leagueId,
          type: 'transfer',
          payload: { kind: 'transfer', from: sellerClub.id, to: fromClubId, playerName: player.name, amount },
        });
      });
      revalidatePath(`/leagues/${club.leagueId}/clubs/${fromClubId}/transfers`);
      revalidatePath(`/leagues/${club.leagueId}/clubs/${fromClubId}`);
      return { ok: `Бот принял оффер за €${(amount / 1_000_000).toFixed(1)}M, ${player.name} в команде` };
    }

    await db.insert(transferOffers).values({
      leagueId: club.leagueId,
      fromClubId,
      toClubId: sellerClub.id,
      playerId,
      amount,
      status: 'rejected',
      resolvedAt: new Date(),
    });
    revalidatePath(`/leagues/${club.leagueId}/clubs/${fromClubId}/transfers`);
    return { error: `Бот отклонил оффер. Маркет ~€${(marketValue / 1_000_000).toFixed(1)}M, попробуй больше` };
  }

  // Human seller — create pending offer
  await db.insert(transferOffers).values({
    leagueId: club.leagueId,
    fromClubId,
    toClubId: sellerClub.id,
    playerId,
    amount,
    status: 'pending',
  });
  revalidatePath(`/leagues/${club.leagueId}/clubs/${fromClubId}/transfers`);
  revalidatePath(`/leagues/${club.leagueId}/clubs/${sellerClub.id}/transfers`);
  return { ok: `Оффер отправлен (€${(amount / 1_000_000).toFixed(1)}M)` };
}

export async function acceptOfferAction(offerId: string): Promise<TransferState> {
  const session = await requireSession();

  const [offer] = await db
    .select()
    .from(transferOffers)
    .where(eq(transferOffers.id, offerId))
    .limit(1);
  if (!offer) return { error: 'Оффер не найден' };
  if (offer.status !== 'pending') return { error: 'Оффер уже разрешён' };

  let toClub;
  try {
    toClub = await assertClubManager(offer.toClubId, session.user.id, session.user.isAdmin);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const [player] = await db
    .select({ id: leaguePlayers.id, clubId: leaguePlayers.clubId, currentOverall: leaguePlayers.currentOverall })
    .from(leaguePlayers)
    .where(eq(leaguePlayers.id, offer.playerId))
    .limit(1);
  if (!player || player.clubId !== offer.toClubId) {
    return { error: 'Игрок уже не в твоём клубе' };
  }

  const [fromClub] = await db.select({ budget: clubs.budget }).from(clubs).where(eq(clubs.id, offer.fromClubId)).limit(1);
  if (!fromClub || fromClub.budget < offer.amount) {
    return { error: 'У клуба-покупателя не хватает бюджета' };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(transferOffers)
      .set({ status: 'accepted', resolvedAt: new Date() })
      .where(eq(transferOffers.id, offerId));
    await tx.update(clubs).set({ budget: sql`${clubs.budget} - ${offer.amount}` }).where(eq(clubs.id, offer.fromClubId));
    await tx.update(clubs).set({ budget: sql`${clubs.budget} + ${offer.amount}` }).where(eq(clubs.id, offer.toClubId));
    await tx
      .update(leaguePlayers)
      .set({ clubId: offer.fromClubId, contractSalary: salaryFromOverall(player.currentOverall) })
      .where(eq(leaguePlayers.id, offer.playerId));
    await tx.insert(newsItems).values({
      leagueId: toClub.leagueId,
      type: 'transfer',
      payload: { kind: 'transfer', from: offer.toClubId, to: offer.fromClubId, playerId: offer.playerId, amount: offer.amount },
    });
  });

  revalidatePath(`/leagues/${toClub.leagueId}/clubs/${offer.toClubId}/transfers`);
  revalidatePath(`/leagues/${toClub.leagueId}/clubs/${offer.fromClubId}/transfers`);
  return { ok: 'Оффер принят, игрок переведён' };
}

export async function rejectOfferAction(offerId: string): Promise<TransferState> {
  const session = await requireSession();

  const [offer] = await db
    .select({ id: transferOffers.id, toClubId: transferOffers.toClubId, status: transferOffers.status, leagueId: transferOffers.leagueId })
    .from(transferOffers)
    .where(eq(transferOffers.id, offerId))
    .limit(1);
  if (!offer) return { error: 'Оффер не найден' };
  if (offer.status !== 'pending') return { error: 'Оффер уже разрешён' };

  try {
    await assertClubManager(offer.toClubId, session.user.id, session.user.isAdmin);
  } catch (e) {
    return { error: (e as Error).message };
  }

  await db
    .update(transferOffers)
    .set({ status: 'rejected', resolvedAt: new Date() })
    .where(eq(transferOffers.id, offerId));

  revalidatePath(`/leagues/${offer.leagueId}/clubs/${offer.toClubId}/transfers`);
  return { ok: 'Оффер отклонён' };
}

export async function withdrawOfferAction(offerId: string): Promise<TransferState> {
  const session = await requireSession();

  const [offer] = await db
    .select({ id: transferOffers.id, fromClubId: transferOffers.fromClubId, status: transferOffers.status, leagueId: transferOffers.leagueId })
    .from(transferOffers)
    .where(eq(transferOffers.id, offerId))
    .limit(1);
  if (!offer) return { error: 'Оффер не найден' };
  if (offer.status !== 'pending') return { error: 'Оффер уже разрешён' };

  try {
    await assertClubManager(offer.fromClubId, session.user.id, session.user.isAdmin);
  } catch (e) {
    return { error: (e as Error).message };
  }

  await db
    .update(transferOffers)
    .set({ status: 'withdrawn', resolvedAt: new Date() })
    .where(eq(transferOffers.id, offerId));

  revalidatePath(`/leagues/${offer.leagueId}/clubs/${offer.fromClubId}/transfers`);
  return { ok: 'Оффер отозван' };
}

