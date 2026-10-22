'use client';

import { CampoSelect, CampoTexto } from '../CampoBloque';
import type { PropsEditorBloque } from './tipos';

const NIVELES = [2, 3, 4].map((nivel) => ({ valor: String(nivel), texto: `Nivel ${nivel}` }));

export function EditorTitulo({ bloque, indice, errores, cambiar }: PropsEditorBloque<'titulo'>) {
  return (
    <>
      <CampoSelect
        indice={indice}
        campo="nivel"
        etiqueta="Nivel"
        errores={errores}
        opciones={NIVELES}
        valor={String(bloque.nivel)}
        alCambiar={(nivel) => cambiar({ nivel: Number(nivel) as 2 | 3 | 4 })}
      />
      <CampoTexto
        indice={indice}
        campo="texto"
        etiqueta="Texto"
        errores={errores}
        valor={bloque.texto}
        alCambiar={(texto) => cambiar({ texto })}
      />
    </>
  );
}
