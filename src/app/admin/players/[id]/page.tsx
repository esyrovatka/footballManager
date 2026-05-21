import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db } from '@/db/client';
import { playerTemplates } from '@/db/schema/players';
import { PlayerTemplateForm } from '@/components/player-template-form';
import { DeletePlayerButton } from '@/components/delete-player-button';
import { deletePlayerTemplateAction, updatePlayerTemplateAction } from '@/lib/actions/players';

export default async function EditPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [player] = await db.select().from(playerTemplates).where(eq(playerTemplates.id, id)).limit(1);
  if (!player) notFound();

  const updateAction = updatePlayerTemplateAction.bind(null, player.id);
  const deleteAction = deletePlayerTemplateAction.bind(null, player.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{player.name}</h1>
        <p className="text-sm text-neutral-500 font-mono mt-1">{player.id}</p>
      </div>

      <PlayerTemplateForm
        action={updateAction}
        defaults={{
          name: player.name,
          position: player.position,
          baseOverall: player.baseOverall,
          age: player.age,
          peakAge: player.peakAge,
          growthRate: player.growthRate,
          declineRate: player.declineRate,
          nationality: player.nationality,
          attack: player.attributes.attack,
          defense: player.attributes.defense,
          speed: player.attributes.speed,
          goalkeeping: player.attributes.goalkeeping,
        }}
        submitLabel="Сохранить"
        cancelHref="/admin/players"
        extraActions={<DeletePlayerButton action={deleteAction} />}
      />
    </div>
  );
}
