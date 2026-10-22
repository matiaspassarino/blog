'use client';

// Vista de los elementos especiales (imagen, galería, llamada a la acción y video) dentro del lienzo: la misma
// que usa la vista previa del artículo, así el lienzo muestra lo que verá el lector (contracts/componentes.md).
import type { Bloque } from '@blog/bloques';
import { Bloques } from '@blog/bloques/render';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { cn } from '../../../lib/cn';
import { ImagenAdmin } from '../../ImagenAdmin';
import { nombreDeTipo } from '../anuncios';

export function NodoBloque({ node, selected, editor, getPos }: NodeViewProps) {
  const bloque = node.attrs.bloque as Bloque;
  const posicion = typeof getPos === 'function' ? getPos() : undefined;
  const total = editor.state.doc.childCount;
  const indice = posicion === undefined ? 0 : editor.state.doc.resolve(posicion).index(0) + 1;
  return (
    <NodeViewWrapper
      contentEditable={false}
      role="group"
      aria-label={`${nombreDeTipo(bloque.tipo)}, ${indice} de ${total}`}
      data-elemento={bloque.tipo}
      data-seleccionado={selected ? 'si' : undefined}
      className={cn('my-4 rounded-md outline-offset-4', selected && 'outline-2 outline-marca')}
    >
      <Bloques contenido={[bloque]} componentes={{ Imagen: ImagenAdmin }} />
    </NodeViewWrapper>
  );
}
