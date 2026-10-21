'use client';

import { TextoConMarcas } from '../TextoConMarcas';
import type { PropsEditorBloque } from './tipos';

export function EditorParrafo({ bloque, indice, errores, cambiar }: PropsEditorBloque<'parrafo'>) {
  return (
    <TextoConMarcas
      indice={indice}
      campo="texto"
      etiqueta="Texto"
      valor={bloque.texto}
      alCambiar={(texto) => cambiar({ texto })}
      errores={errores}
    />
  );
}
