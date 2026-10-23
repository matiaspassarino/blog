'use client';

import { CampoTexto } from '../CampoBloque';
import type { PropsEditorBloque } from './tipos';

export function EditorCodigo({ datos, indice, errores, cambiar }: PropsEditorBloque<'codeBlock'>) {
  return (
    <>
      <CampoTexto
        indice={indice}
        campo="lenguaje"
        etiqueta="Lenguaje"
        ayuda="Por ejemplo: ts, css, python"
        errores={errores}
        valor={datos.lenguaje ?? ''}
        alCambiar={(lenguaje) => cambiar({ lenguaje: lenguaje === '' ? undefined : lenguaje })}
      />
    </>
  );
}
