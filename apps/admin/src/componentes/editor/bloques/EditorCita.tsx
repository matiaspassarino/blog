'use client';

import { CampoTexto } from '../CampoBloque';
import { TextoConMarcas } from '../TextoConMarcas';
import type { PropsEditorBloque } from './tipos';

export function EditorCita({ bloque, indice, errores, cambiar }: PropsEditorBloque<'cita'>) {
  return (
    <>
      <TextoConMarcas
        indice={indice}
        campo="texto"
        etiqueta="Texto"
        valor={bloque.texto}
        alCambiar={(texto) => cambiar({ texto })}
        errores={errores}
      />
      <CampoTexto
        indice={indice}
        campo="autor"
        etiqueta="Autor"
        errores={errores}
        valor={bloque.autor ?? ''}
        alCambiar={(autor) => cambiar({ autor: autor === '' ? undefined : autor })}
      />
      <CampoTexto
        indice={indice}
        campo="fuente"
        etiqueta="Fuente (dirección https)"
        errores={errores}
        valor={bloque.fuente ?? ''}
        alCambiar={(fuente) => cambiar({ fuente: fuente === '' ? undefined : fuente })}
      />
    </>
  );
}
