'use server';

import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/auth';
import { db } from '@/db/client';
import { users } from '@/db/schema/auth';

export type AuthFormState = { error?: string } | undefined;

const MIN_PASSWORD_LENGTH = 6;

function safeReturnTo(value: FormDataEntryValue | null): string {
  const raw = typeof value === 'string' ? value : '';
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/profile';
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const passwordConfirm = String(formData.get('passwordConfirm') ?? '');

  if (!email || !password) return { error: 'Email и пароль обязательны' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Некорректный email' };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов` };
  }
  if (password !== passwordConfirm) return { error: 'Пароли не совпадают' };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: 'Пользователь с таким email уже зарегистрирован' };

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({
    name: name || null,
    email,
    passwordHash,
  });

  try {
    await signIn('credentials', { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: 'Ошибка автоматического входа' };
    throw error;
  }

  redirect(safeReturnTo(formData.get('returnTo')));
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email и пароль обязательны' };

  try {
    await signIn('credentials', { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: error.type === 'CredentialsSignin' ? 'Неверный email или пароль' : 'Ошибка входа' };
    }
    throw error;
  }

  redirect(safeReturnTo(formData.get('returnTo')));
}

export async function logoutAction() {
  await signOut({ redirectTo: '/' });
}
