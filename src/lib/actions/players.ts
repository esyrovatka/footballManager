'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { playerTemplates, type PlayerAttributes } from '@/db/schema/players';
import { generatePlayerTemplates } from '@/lib/player-generator';

export type PlayerFormState = { error?: string } | undefined;

const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const;
type Position = (typeof POSITIONS)[number];

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/login');
}

function parseFormData(formData: FormData): { values?: ParsedPlayer; error?: string } {
  const name = String(formData.get('name') ?? '').trim();
  const position = String(formData.get('position') ?? '');
  const baseOverall = Number(formData.get('baseOverall'));
  const age = Number(formData.get('age'));
  const peakAge = Number(formData.get('peakAge'));
  const growthRate = Number(formData.get('growthRate'));
  const declineRate = Number(formData.get('declineRate'));
  const nationality = String(formData.get('nationality') ?? '').trim() || null;

  const attack = Number(formData.get('attack'));
  const defense = Number(formData.get('defense'));
  const speed = Number(formData.get('speed'));
  const goalkeeping = Number(formData.get('goalkeeping'));

  if (!name) return { error: 'Имя обязательно' };
  if (!POSITIONS.includes(position as Position)) return { error: 'Некорректная позиция' };

  const ints = { baseOverall, age, peakAge, attack, defense, speed, goalkeeping };
  for (const [key, val] of Object.entries(ints)) {
    if (!Number.isFinite(val) || val < 0 || val > 100) {
      return { error: `${key} должно быть числом от 0 до 100` };
    }
  }
  if (!Number.isFinite(growthRate) || growthRate < -5 || growthRate > 5) {
    return { error: 'growthRate должен быть от -5 до 5' };
  }
  if (!Number.isFinite(declineRate) || declineRate < -5 || declineRate > 5) {
    return { error: 'declineRate должен быть от -5 до 5' };
  }
  if (age < 15 || age > 45) return { error: 'Возраст должен быть от 15 до 45' };
  if (peakAge < 18 || peakAge > 35) return { error: 'Peak age должен быть от 18 до 35' };

  return {
    values: {
      name,
      position: position as Position,
      baseOverall,
      age,
      peakAge,
      growthRate,
      declineRate,
      nationality,
      attributes: { attack, defense, speed, goalkeeping },
    },
  };
}

type ParsedPlayer = {
  name: string;
  position: Position;
  baseOverall: number;
  age: number;
  peakAge: number;
  growthRate: number;
  declineRate: number;
  nationality: string | null;
  attributes: PlayerAttributes;
};

export async function createPlayerTemplateAction(
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  await requireAdmin();
  const parsed = parseFormData(formData);
  if (parsed.error || !parsed.values) return { error: parsed.error };

  await db.insert(playerTemplates).values(parsed.values);
  revalidatePath('/admin/players');
  redirect('/admin/players');
}

export async function updatePlayerTemplateAction(
  id: string,
  _prev: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  await requireAdmin();
  const parsed = parseFormData(formData);
  if (parsed.error || !parsed.values) return { error: parsed.error };

  await db.update(playerTemplates).set(parsed.values).where(eq(playerTemplates.id, id));
  revalidatePath('/admin/players');
  revalidatePath(`/admin/players/${id}`);
  redirect('/admin/players');
}

export async function deletePlayerTemplateAction(id: string) {
  await requireAdmin();
  await db.delete(playerTemplates).where(eq(playerTemplates.id, id));
  revalidatePath('/admin/players');
  redirect('/admin/players');
}

export type GenerateState = { error?: string; created?: number } | undefined;

export async function generatePlayersAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  await requireAdmin();
  const count = Number(formData.get('count'));
  if (!Number.isFinite(count) || count < 1 || count > 500) {
    return { error: 'Количество должно быть от 1 до 500' };
  }

  const players = generatePlayerTemplates(count);
  await db.insert(playerTemplates).values(players);

  revalidatePath('/admin/players');
  revalidatePath('/admin');
  return { created: count };
}
