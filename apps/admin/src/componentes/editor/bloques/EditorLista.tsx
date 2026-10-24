'use client';

import { Checkbox } from '../../ui/checkbox';
import type { PropsEditorBloque } from './tipos';

export function EditorLista({ datos, cambiar }: PropsEditorBloque<'bulletList'>) {
  return (
    <label className="flex min-h-(--tactil-min) items-center gap-2">
      <Checkbox checked={datos.ordenada} onChange={(e) => cambiar({ ordenada: e.target.checked })} />
      Lista ordenada
    </label>
  );
}
