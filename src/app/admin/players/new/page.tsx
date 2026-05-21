import { PlayerTemplateForm } from '@/components/player-template-form';
import { createPlayerTemplateAction } from '@/lib/actions/players';

export default function NewPlayerPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Новый игрок</h1>
      <PlayerTemplateForm
        action={createPlayerTemplateAction}
        submitLabel="Создать"
        cancelHref="/admin/players"
      />
    </div>
  );
}
