'use client';

// El lienzo del artículo: un documento continuo que se escribe como en un procesador de texto (spec 005). La
// librería vive en este módulo, que se carga bajo demanda (`CargadorDeEditorDocumento`). Cada transacción que
// cambia el documento se convierte a la lista de bloques con `documentoABloques` y sube por `alCambiar`.
import type { Contenido, ErrorBloque } from '@blog/bloques';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { anuncioConvertido } from '../anuncios';
import { BarraHerramientas } from './BarraHerramientas';
import { bloquesADocumento, documentoABloques } from './conversion';
import type { CambiosDeBloque } from '../bloques/tipos';
import { actualizarBloque, bloqueDeElemento, buscarElemento } from './comandos';
import { claveErrores } from './claves';
import { crearExtensiones, type DevolucionesDelEditor, type EstadoMenu } from './extensiones';
import { erroresPorBloqueId } from './mapa-errores';
import { filtrarItems } from './menu-insercion';
import { MenuInsertar } from './MenuInsertar';
import type { ElementoActivo, SeleccionDelDocumento } from './tipos';

export type PropsEditorDocumento = {
  /** Lo guardado o lo adoptado: se vuelve a crear el documento (y su historial) cuando cambia `reinicio`. */
  contenido: Contenido;
  reinicio: number;
  errores: ErrorBloque[];
  alCambiar: (contenido: Contenido) => void;
  alSeleccionar: (seleccion: SeleccionDelDocumento, elemento: ElementoActivo | null) => void;
  /** «Propiedades» (barra), `Enter` en el modo elementos o «Subir imagen»: abrir y enfocar el panel. */
  alPropiedades: () => void;
  /** Lo que el panel y el guardado le piden al lienzo. */
  acciones: Ref<AccionesDelLienzo>;
  /** Anuncios para la región de estado persistente del editor. */
  anunciar: (mensaje: string) => void;
  /** Mientras se carga la versión vigente: el editor no admite cambios. */
  bloqueado: boolean;
};

export type AccionesDelLienzo = {
  /** Mezcla campos en el elemento con ese `bloqueId` (se busca al aplicar, no por la selección). */
  actualizarBloque: (bloqueId: string, cambios: CambiosDeBloque) => void;
  /** Selecciona el elemento entero y lo deja a la vista. */
  seleccionarBloque: (bloqueId: string) => void;
  /** Devuelve el foco al lienzo conservando la selección. */
  enfocar: () => void;
};

const ALTO_DEL_MENU_PX = 320;

/** Mensajes de error de cada elemento, por `bloqueId`. */
function mensajesPorBloque(editor: Editor, errores: ErrorBloque[]): Map<string, string[]> {
  try {
    const porId = erroresPorBloqueId(documentoABloques(editor.getJSON()), errores);
    return new Map([...porId].map(([id, lista]) => [id, lista.map((error) => error.mensaje)]));
  } catch {
    return new Map(); // sin ids todavía: no hay nada que marcar
  }
}

/**
 * El elemento de primer nivel donde está el cursor, si tiene propiedades (título, cita, lista, código, elementos
 * especiales), o el que está seleccionado entero. Un párrafo con el cursor adentro no cuenta: no tiene propiedades.
 */
function leerSeleccion(
  editor: Editor,
  origen: ElementoActivo['origen'],
): [SeleccionDelDocumento, ElementoActivo | null] {
  const { selection, doc } = editor.state;
  const entero = selection instanceof NodeSelection && selection.$from.depth === 0;
  if (
    !entero &&
    (selection.$from.depth === 0 ||
      (!selection.$from.sameParent(selection.$to) && selection.$from.index(0) !== selection.$to.index(0)))
  ) {
    return [{ tipo: 'texto' }, null];
  }
  const nodo = entero ? selection.node : selection.$from.node(1);
  if (!entero && nodo.type.name === 'paragraph') return [{ tipo: 'texto' }, null];
  const bloqueId = String(nodo.attrs.bloqueId ?? '');
  try {
    const bloque = bloqueId ? bloqueDeElemento(nodo) : undefined;
    if (!bloque) return [{ tipo: 'texto' }, null];
    const posicion = selection.$from.index(0) + 1;
    const indice = documentoABloques(doc.toJSON()).findIndex((otro) => otro.id === bloqueId);
    return [
      { tipo: 'elementos', desde: posicion - 1, hasta: posicion, bloques: [bloque] },
      { bloqueId, posicion, indice, origen },
    ];
  } catch {
    return [{ tipo: 'texto' }, null];
  }
}

export default function EditorDocumento({
  contenido,
  errores,
  alCambiar,
  alSeleccionar,
  alPropiedades,
  acciones,
  anunciar,
  bloqueado,
}: PropsEditorDocumento) {
  const idMenu = useId();
  const [menu, setMenu] = useState<EstadoMenu | null>(null);
  const [activo, setActivo] = useState(0);
  const ultimo = useRef({ menu, activo, alCambiar, alSeleccionar, alPropiedades, anunciar });
  const [seleccion, setSeleccion] = useState<SeleccionDelDocumento>({ tipo: 'texto' });

  useEffect(() => {
    ultimo.current = { menu, activo, alCambiar, alSeleccionar, alPropiedades, anunciar };
  });

  // Las devoluciones de la librería son estables y leen siempre lo último desde `ultimo`.
  const [devoluciones] = useState<DevolucionesDelEditor>(() => ({
    anunciar: (mensaje) => ultimo.current.anunciar(mensaje),
    menuAbierto: () => ultimo.current.menu !== null,
    alPropiedades: () => ultimo.current.alPropiedades(),
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
      // Si un elemento especial está seleccionado, el panel sigue mostrando sus datos al día.
      publicarSeleccion(actual, 'puntero');
    },
    onSelectionUpdate: ({ editor: actual }) => {
      const pendiente = actual.storage.atributosDelDocumento.abrirPanel;
      const origen = pendiente === 'foco' ? 'insertar' : pendiente === 'pestana' ? 'insertar-texto' : 'puntero';
      const [nueva, elemento] = leerSeleccion(actual, origen);
      // El pedido de «Insertar» se consume con la primera selección que ya es el elemento nuevo.
      if (elemento && pendiente) actual.storage.atributosDelDocumento.abrirPanel = false;
      setSeleccion(nueva);
      ultimo.current.alSeleccionar(nueva, elemento);
    },
  });

  function publicarSeleccion(actual: Editor, origen: ElementoActivo['origen']) {
    const [nueva, elemento] = leerSeleccion(actual, origen);
    setSeleccion(nueva);
    ultimo.current.alSeleccionar(nueva, elemento);
  }

  useImperativeHandle(
    acciones,
    () => ({
      actualizarBloque: (bloqueId, cambios) => {
        if (editor) actualizarBloque(editor, bloqueId, cambios);
      },
      seleccionarBloque: (bloqueId) => {
        const elemento = editor && buscarElemento(editor, bloqueId);
        if (!editor || !elemento) return;
        editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, elemento.pos)));
        (editor.view.nodeDOM(elemento.pos) as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
      },
      enfocar: () => {
        editor?.commands.focus();
      },
    }),
    [editor],
  );

  // «Subir imagen» de la isla vacía y los atajos piden abrir el panel.
  useEffect(() => {
    const lienzo = editor?.view.dom;
    if (!lienzo) return;
    const abrir = () => ultimo.current.alPropiedades();
    lienzo.addEventListener('abrir-propiedades', abrir);
    return () => lienzo.removeEventListener('abrir-propiedades', abrir);
  }, [editor]);

  // Los errores de validación marcan los elementos por `bloqueId` (el índice del bloque no es la posición).
  useEffect(() => {
    if (!editor) return;
    const mapa = mensajesPorBloque(editor, errores);
    editor.view.dispatch(editor.state.tr.setMeta(claveErrores, mapa).setMeta('addToHistory', false));
  }, [editor, errores]);

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
      <BarraHerramientas
        editor={editor}
        deshabilitada={bloqueado}
        seleccion={seleccion}
        alPropiedades={alPropiedades}
      />
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
