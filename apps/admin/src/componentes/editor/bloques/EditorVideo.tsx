'use client';

import { CampoSelect, CampoTexto } from '../CampoBloque';
import type { PropsEditorBloque } from './tipos';

const PROVEEDORES = [
  { valor: 'youtube', texto: 'YouTube' },
  { valor: 'vimeo', texto: 'Vimeo' },
];

export function EditorVideo({ datos, indice, errores, cambiar }: PropsEditorBloque<'video'>) {
  return (
    <>
      <CampoSelect
        indice={indice}
        campo="proveedor"
        etiqueta="Proveedor"
        errores={errores}
        opciones={PROVEEDORES}
        valor={datos.proveedor}
        alCambiar={(proveedor) => cambiar({ proveedor: proveedor as 'youtube' | 'vimeo' })}
      />
      <CampoTexto
        indice={indice}
        campo="idVideo"
        etiqueta="ID del video"
        errores={errores}
        valor={datos.idVideo}
        alCambiar={(idVideo) => cambiar({ idVideo })}
      />
      <CampoTexto
        indice={indice}
        campo="titulo"
        etiqueta="Título del video"
        errores={errores}
        valor={datos.titulo}
        alCambiar={(titulo) => cambiar({ titulo })}
      />
    </>
  );
}
