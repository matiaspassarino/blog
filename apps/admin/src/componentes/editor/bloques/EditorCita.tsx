'use client';

import { CampoTexto } from '../CampoBloque';
import type { PropsEditorBloque } from './tipos';

export function EditorCita({ datos, indice, errores, cambiar }: PropsEditorBloque<'blockquote'>) {
  return (
    <>
      <CampoTexto
        indice={indice}
        campo="autor"
        etiqueta="Autor"
        errores={errores}
        valor={datos.autor ?? ''}
        alCambiar={(autor) => cambiar({ autor: autor === '' ? undefined : autor })}
      />
      <CampoTexto
        indice={indice}
        campo="fuente"
        etiqueta="Fuente (dirección https)"
        errores={errores}
        valor={datos.fuente ?? ''}
        alCambiar={(fuente) => cambiar({ fuente: fuente === '' ? undefined : fuente })}
      />
    </>
  );
}
