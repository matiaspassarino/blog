'use client';

// El lienzo del artículo: un documento continuo que se escribe como en un procesador de texto (spec 005). La
// librería vive en este módulo, que se carga bajo demanda (`CargadorDeEditorDocumento`). Cada transacción que
// cambia el documento se convierte a la lista de bloques con `documentoABloques` y sube por `alCambiar`.
import type { Contenido, ErrorBloque } from '@blog/bloques';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useId, useRef, useState } from 'react';
import { anuncioConvertido } from '../anuncios';
import { BarraHerramientas } from './BarraHerramientas';
import { bloquesADocumento, documentoABloques } from './conversion';
import { crearExtensiones, type DevolucionesDelEditor, type EstadoMenu } from './extensiones';
import { filtrarItems } from './menu-insercion';
import { MenuInsertar } from './MenuInsertar';
import type { SeleccionDelDocumento } from './tipos';

export type PropsEditorDocumento = {
  /** Lo guardado o lo adoptado: se vuelve a crear el documento (y su historial) cuando cambia `reinicio`. */
  contenido: Contenido;
  reinicio: number;
  errores: ErrorBloque[];
  alCambiar: (contenido: Contenido) => void;
  alSeleccionar: (seleccion: SeleccionDelDocumento) => void;
  /** Anuncios para la región de estado persistente del editor. */
  anunciar: (mensaje: string) => void;
  /** Mientras se carga la versión vigente: el editor no admite cambios. */
  bloqueado: boolean;
};

const ALTO_DEL_MENU_PX = 320;

export default function EditorDocumento({
  contenido,
  alCambiar,
  alSeleccionar,
  anunciar,
  bloqueado,
}: PropsEditorDocumento) {
  const idMenu = useId();
  const [menu, setMenu] = useState<EstadoMenu | null>(null);
  const [activo, setActivo] = useState(0);
  const ultimo = useRef({ menu, activo, alCambiar, alSeleccionar, anunciar });

  useEffect(() => {
    ultimo.current = { menu, activo, alCambiar, alSeleccionar, anunciar };
  });

  // Las devoluciones de la librería son estables y leen siempre lo último desde `ultimo`.
  const [devoluciones] = useState<DevolucionesDelEditor>(() => ({
    alMenu: (estado) => {
      setMenu(estado);
      setActivo(0);
    },
    alTeclearMenu: (evento) => {
      const { menu: abierto, activo: indice } = ultimo.current;
      if (!abierto) return false;
      const lista = filtrarItems(abierto.consulta);
      if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
        if (lista.length > 0) setActivo((indice + (evento.key === 'ArrowDown' ? 1 : -1) + lista.length) % lista.length);
        return true;
      }
      if (evento.key === 'Enter') {
        const item = lista[indice];
        if (item) abierto.elegir(item);
        return true;
      }
      return false;
    },
    alConvertir: (nombre) => ultimo.current.anunciar(anuncioConvertido(nombre)),
  }));
  const [extensiones] = useState(() => crearExtensiones(devoluciones));

  const editor = useEditor({
    immediatelyRender: false,
    // La barra se actualiza sola (useEditorState): volver a dibujar el lienzo en cada transacción le pisa el cursor.
    shouldRerenderOnTransaction: false,
    extensions: extensiones,
    content: bloquesADocumento(contenido),
    editable: !bloqueado,
    editorProps: {
      attributes: {
        'aria-label': 'Contenido del artículo',
        'aria-multiline': 'true',
        class: 'lienzo-documento min-h-64 outline-none',
      },
    },
    onUpdate: ({ editor: actual }) => {
      try {
        ultimo.current.alCambiar(documentoABloques(actual.getJSON()));
      } catch {
        // Un elemento sin identidad todavía: el plugin de ids lo completa en la siguiente transacción.
      }
    },
    onSelectionUpdate: () => ultimo.current.alSeleccionar({ tipo: 'texto' }),
  });

  useEffect(() => {
    editor?.setEditable(!bloqueado);
    editor?.view.dom.setAttribute('aria-readonly', String(bloqueado));
  }, [editor, bloqueado]);

  // El menú «/» no mueve el foco: la opción activa se señala desde el lienzo.
  const items = menu ? filtrarItems(menu.consulta) : [];
  const opcionActiva = items[activo];
  useEffect(() => {
    const lienzo = editor?.view.dom;
    if (!lienzo || !menu) return;
    lienzo.setAttribute('aria-haspopup', 'listbox');
    lienzo.setAttribute('aria-controls', idMenu);
    if (opcionActiva) lienzo.setAttribute('aria-activedescendant', `${idMenu}-${opcionActiva.id}`);
    return () => {
      lienzo.removeAttribute('aria-haspopup');
      lienzo.removeAttribute('aria-controls');
      lienzo.removeAttribute('aria-activedescendant');
    };
  }, [editor, menu, idMenu, opcionActiva]);

  const altoDeVentana = typeof window === 'undefined' ? 0 : (window.visualViewport?.height ?? window.innerHeight);
  const arriba = menu?.rect ? menu.rect.bottom + ALTO_DEL_MENU_PX > altoDeVentana : false;

  return (
    <div className="flex flex-col gap-2">
      <BarraHerramientas editor={editor} deshabilitada={bloqueado} seleccion={{ tipo: 'texto' }} />
      <EditorContent editor={editor} className="mx-auto w-full max-w-lectura" />
      {menu?.rect && (
        <MenuInsertar
          id={idMenu}
          items={items}
          activo={activo}
          alActivar={setActivo}
          alElegir={menu.elegir}
          className="fixed"
          estilo={{
            left: Math.max(8, Math.min(menu.rect.left, window.innerWidth - 296)),
            ...(arriba ? { bottom: altoDeVentana - menu.rect.top + 4 } : { top: menu.rect.bottom + 4 }),
          }}
        />
      )}
    </div>
  );
}
