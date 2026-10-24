'use client';

import { CampoSelect } from '../CampoBloque';
import type { PropsEditorBloque } from './tipos';

const NIVELES = [2, 3, 4].map((nivel) => ({ valor: String(nivel), texto: `Nivel ${nivel}` }));

export function EditorTitulo({ datos, indice, errores, cambiar }: PropsEditorBloque<'heading'>) {
  return (
    <>
      <CampoSelect
        indice={indice}
        campo="nivel"
        etiqueta="Nivel"
        errores={errores}
        opciones={NIVELES}
        valor={String(datos.nivel)}
        alCambiar={(nivel) => cambiar({ nivel: Number(nivel) as 2 | 3 | 4 })}
      />
    </>
  );
}
