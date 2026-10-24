'use client';

// Vista de los elementos especiales (imagen, galería, llamada a la acción y video) dentro del lienzo: la misma
// que usa la vista previa del artículo, así el lienzo muestra lo que verá el lector (contracts/componentes.md).
import { normalizarDocumento, type ElementoDe } from '@blog/bloques';
import { Documento } from '@blog/bloques/render';
import { NodeViewWrapper, useEditorState, type NodeViewProps } from '@tiptap/react';
import { claveErrores, claveSubidas } from '../claves';
import { cn } from '../../../../lib/cn';
import { ImagenAdmin } from '../../../ImagenAdmin';
import { nombreDeTipo, tipoVisibleDe } from '../../anuncios';

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

const SIN_ERRORES: string[] = [];

export function NodoBloque({ node, selected, editor, getPos }: NodeViewProps) {
  // El elemento en forma canónica (sin los atributos vacíos del esquema del editor).
  const documento = normalizarDocumento({ type: 'doc', content: [node.toJSON()] });
  const elemento = documento.content[0] as ElementoDe<'imagen' | 'galeria' | 'cta' | 'video'>;
  const { type: tipo, attrs } = elemento;
  // Posición y total se calculan al dibujar y cada vez que cambia el documento (mover o quitar otro elemento).
  const { indice, total } = useEditorState({
    editor,
    selector: ({ editor: actual }) => {
      const { doc } = actual?.state ?? { doc: null };
      const posicion = typeof getPos === 'function' ? getPos() : undefined;
      if (!doc || posicion === undefined) return { indice: 0, total: 0 };
      const ultimo = doc.lastChild;
      // El párrafo vacío del final (donde se pone el cursor tras un elemento especial) no es un elemento más.
      const sobrante = doc.childCount > 1 && ultimo?.type.name === 'paragraph' && ultimo.content.size === 0 ? 1 : 0;
      return { indice: doc.resolve(posicion).index(0) + 1, total: doc.childCount - sobrante };
    },
  });
  const errores = useEditorState({
    editor,
    selector: ({ editor: actual }) =>
      (actual ? claveErrores.getState(actual.state)?.get(String(node.attrs.id)) : undefined) ?? SIN_ERRORES,
  });
  const subiendo = useEditorState({
    editor,
    selector: ({ editor: actual }) =>
      actual ? (claveSubidas.getState(actual.state)?.has(String(node.attrs.id)) ?? false) : false,
  });
  const vacio =
    (tipo === 'imagen' && !('imagen' in attrs && attrs.imagen?.ruta)) ||
    (tipo === 'galeria' && !('imagenes' in attrs && attrs.imagenes?.length));
  return (
    <NodeViewWrapper
      contentEditable={false}
      role="group"
      aria-label={`${conMayuscula(nombreDeTipo(tipoVisibleDe(tipo)))}, ${indice} de ${total}`}
      data-elemento={tipo}
      data-seleccionado={selected ? 'si' : undefined}
      className={cn('my-4 scroll-mt-24 rounded-md outline-offset-4', selected && 'outline-2 outline-marca')}
    >
      {subiendo ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-borde bg-superficie p-4 text-texto-suave">
          <p className="font-semibold">Subiendo imagen…</p>
          <p className="text-sm">No se puede mover ni quitar hasta que termine.</p>
        </div>
      ) : vacio ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-borde bg-superficie p-4 text-texto-suave">
          <p>{tipo === 'imagen' ? 'Todavía no elegiste una imagen' : 'Todavía no agregaste imágenes'}</p>
          <button
            type="button"
            tabIndex={-1}
            className="min-h-(--tactil-min) rounded-md border border-borde bg-fondo px-4 font-semibold text-texto"
            onClick={() => editor.view.dom.dispatchEvent(new CustomEvent('abrir-propiedades'))}
          >
            {tipo === 'imagen' ? 'Subir imagen' : 'Agregar imágenes'}
          </button>
        </div>
      ) : (
        <Documento contenido={documento} componentes={{ Imagen: ImagenAdmin }} />
      )}
      {errores.length > 0 && <p className="mt-2 text-sm font-semibold text-error">Error: {errores.join('. ')}</p>}
    </NodeViewWrapper>
  );
}
