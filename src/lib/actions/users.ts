'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { users } from '@/db/schema/auth';

export type UserActionState = { error?: string; ok?: string } | undefined;

export async function toggleAdminAction(userId: string): Promise<UserActionState> {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/login');

  if (session.user.id === userId) {
    return { error: 'Нельзя снять админа с самого себя' };
  }

  const [user] = await db
    .select({ id: users.id, isAdmin: users.isAdmin, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { error: 'Пользователь не найден' };

  await db.update(users).set({ isAdmin: !user.isAdmin }).where(eq(users.id, userId));
  revalidatePath('/admin/users');
  return { ok: `${user.email}: admin = ${!user.isAdmin}` };
}
