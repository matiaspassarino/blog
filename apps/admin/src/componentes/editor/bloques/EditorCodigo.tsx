'use client';

import { CampoLargo, CampoTexto } from '../CampoBloque';
import type { PropsEditorBloque } from './tipos';

export function EditorCodigo({ bloque, indice, errores, cambiar }: PropsEditorBloque<'codigo'>) {
  return (
    <>
      <CampoLargo
        indice={indice}
        campo="codigo"
        etiqueta="Código"
        errores={errores}
        valor={bloque.codigo}
        alCambiar={(codigo) => cambiar({ codigo })}
      />
      <CampoTexto
        indice={indice}
        campo="lenguaje"
        etiqueta="Lenguaje"
        ayuda="Por ejemplo: ts, css, python"
        errores={errores}
        valor={bloque.lenguaje ?? ''}
        alCambiar={(lenguaje) => cambiar({ lenguaje: lenguaje === '' ? undefined : lenguaje })}
      />
    </>
  );
}
