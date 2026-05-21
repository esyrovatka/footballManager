'use server';

import { randomBytes } from 'crypto';
import { and, eq, isNotNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { clubs } from '@/db/schema/leagues';

function generateCode(): string {
  return randomBytes(8).toString('hex');
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/login');
}

export async function generateClubInviteAction(clubId: string) {
  await requireAdmin();
  const [updated] = await db
    .update(clubs)
    .set({ inviteCode: generateCode() })
    .where(and(eq(clubs.id, clubId), eq(clubs.isBot, true)))
    .returning({ leagueId: clubs.leagueId });
  if (updated) revalidatePath(`/admin/leagues/${updated.leagueId}`);
}

export async function revokeClubInviteAction(clubId: string) {
  await requireAdmin();
  const [updated] = await db
    .update(clubs)
    .set({ inviteCode: null })
    .where(eq(clubs.id, clubId))
    .returning({ leagueId: clubs.leagueId });
  if (updated) revalidatePath(`/admin/leagues/${updated.leagueId}`);
}

export async function releaseClubAction(clubId: string) {
  await requireAdmin();
  const [updated] = await db
    .update(clubs)
    .set({ managerUserId: null, isBot: true, inviteCode: null })
    .where(and(eq(clubs.id, clubId), isNotNull(clubs.managerUserId)))
    .returning({ leagueId: clubs.leagueId });
  if (updated) revalidatePath(`/admin/leagues/${updated.leagueId}`);
}

export type AcceptInviteState = { error?: string } | undefined;

export async function acceptInviteAction(
  code: string,
  _prev: AcceptInviteState,
  _formData: FormData,
): Promise<AcceptInviteState> {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?returnTo=${encodeURIComponent(`/join/${code}`)}`);
  }

  const [club] = await db
    .select({ id: clubs.id, leagueId: clubs.leagueId, isBot: clubs.isBot })
    .from(clubs)
    .where(eq(clubs.inviteCode, code))
    .limit(1);

  if (!club) return { error: 'Приглашение недействительно или уже использовано' };
  if (!club.isBot) return { error: 'Этот клуб уже занят' };

  await db
    .update(clubs)
    .set({ managerUserId: session.user.id, isBot: false, inviteCode: null })
    .where(eq(clubs.id, club.id));

  revalidatePath(`/admin/leagues/${club.leagueId}`);
  revalidatePath('/dashboard');
  redirect('/dashboard');
}
