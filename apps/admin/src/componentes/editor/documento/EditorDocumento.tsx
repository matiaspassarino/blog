'use client';

// El lienzo del artículo: un documento continuo que se escribe como en un procesador de texto (spec 005). La
// librería vive en este módulo, que se carga bajo demanda (`CargadorDeEditorDocumento`). Cada transacción que
// cambia el documento sube por `alCambiar` en forma canónica (`normalizarDocumento`, research D24).
import {
  cuadricula,
  normalizarDocumento,
  type Documento,
  type Elemento,
  type ErrorElemento,
  type TablaEstructural,
} from '@blog/bloques';
import type { Editor } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { CellSelection, findTable, selectedRect } from '@tiptap/pm/tables';
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { ConfirmarAccion } from '../../ConfirmarAccion';
import {
  anuncioCeldasCombinadas,
  anuncioCeldasSeparadas,
  anuncioColumnaAgregada,
  anuncioColumnaQuitada,
  anuncioConvertido,
  anuncioEntrarTabla,
  anuncioFilaAgregada,
  anuncioFilaEncabezado,
  anuncioFilaQuitada,
  anuncioModoElementos,
  anuncioSeleccionCeldas,
} from '../anuncios';
import { useContextoEditor } from '../ContextoEditor';
import { BarraHerramientas } from './BarraHerramientas';
import { BarraTabla } from './BarraTabla';
import type { CambiosDeElemento } from '../bloques/tipos';
import type { ContextoDeAcciones } from './acciones-elemento';
import { AsaDeElemento } from './AsaDeElemento';
import { AyudaAtajos } from './AyudaAtajos';
import {
  actualizarElemento,
  alinearElemento,
  buscarElemento,
  elementoDeNodo,
  SeleccionDeElementos,
  type Alineacion,
} from './comandos';
import { claveErrores, claveModo, claveSubidas } from './claves';
import { crearExtensiones, type DevolucionesDelEditor, type EstadoMenu } from './extensiones';
import { erroresPorId } from './mapa-errores';
import { filtrarItems } from './menu-insercion';
import { MenuInsertar } from './MenuInsertar';
import type { AccionTabla } from './PropiedadesDelElemento';
import {
  agregarColumna,
  agregarColumnaAntes,
  agregarFila,
  agregarFilaAntes,
  combinarCeldas,
  conmutarEncabezado,
  eliminarColumna,
  eliminarFila,
  registrarReferenciaTabla,
  separarCeldas,
} from './tablas';
import type { ElementoActivo, SeleccionDelDocumento } from './tipos';

export type PropsEditorDocumento = {
  /** Lo guardado o lo adoptado: se vuelve a crear el documento (y su historial) cuando cambia `reinicio`. */
  contenido: Documento;
  reinicio: number;
  errores: ErrorElemento[];
  alCambiar: (contenido: Documento) => void;
  alSeleccionar: (seleccion: SeleccionDelDocumento, elemento: ElementoActivo | null) => void;
  /** «Propiedades» (barra), `Enter` en el modo elementos o «Subir imagen»: abrir y enfocar el panel. */
  alPropiedades: () => void;
  /** Lo que el panel y el guardado le piden al lienzo. */
  acciones: Ref<AccionesDelLienzo>;
  /** Anuncios para la región de estado persistente del editor. */
  anunciar: (mensaje: string) => void;
  /** `id` de los elementos con una subida de imagen en curso: no se pueden mover ni quitar. */
  subidasEnCurso: ReadonlySet<string>;
  /** La hoja de propiedades está abierta; `Esc` la cierra al final del orden de `Esc`. */
  hojaAbierta: boolean;
  alCerrarHoja: () => void;
  /** Mientras se carga la versión vigente: el editor no admite cambios. */
  bloqueado: boolean;
};

export type AccionesDelLienzo = {
  /** Mezcla campos en el elemento con ese `id` (se busca al aplicar, no por la selección). */
  actualizarElemento: (id: string, cambios: CambiosDeElemento) => void;
  /** Alinea el párrafo o el título con ese `id` (RF-020). */
  alinearElemento: (id: string, alineacion: Alineacion) => void;
  /** Selecciona el elemento entero y lo deja a la vista. */
  seleccionarElemento: (id: string) => void;
  /** Devuelve el foco al lienzo conservando la selección. */
  enfocar: () => void;
  /** Reemplaza el documento por lo que devolvió el servidor, en el mismo historial y con el cursor donde estaba. */
  adoptarContenido: (contenido: Documento) => void;
  /** Ejecuta una acción de tabla sobre la referencia actual (RF-028). */
  ejecutarAccionTabla?: (accion: AccionTabla) => boolean;
};

const ALTO_DEL_MENU_PX = 320;

/** El documento como lo abre el editor: el esquema exige al menos un elemento, así que uno vacío lleva un párrafo. */
const paraElEditor = (documento: Documento) =>
  documento.content.length > 0 ? documento : { type: 'doc', content: [{ type: 'paragraph' }] };

/** Mensajes de error de cada elemento, por `id`. */
function mensajesPorElemento(editor: Editor, errores: ErrorElemento[]): Map<string, string[]> {
  const porId = erroresPorId(normalizarDocumento(editor.getJSON()), errores);
  return new Map([...porId].map(([id, lista]) => [id, lista.map((error) => error.mensaje)]));
}

/**
 * El elemento de primer nivel donde está el cursor, si tiene propiedades (título, cita, lista, código, elementos
 * especiales), o los que están seleccionados enteros. Un párrafo con el cursor adentro no cuenta: no tiene propiedades.
 */
function leerSeleccion(
  editor: Editor,
  origen: ElementoActivo['origen'],
): [SeleccionDelDocumento, ElementoActivo | null] {
  const { selection, doc } = editor.state;
  const modo = Boolean(claveModo.getState(editor.state));
  if (selection instanceof SeleccionDeElementos) {
    const elementos: Elemento[] = [];
    doc.nodesBetween(selection.from, selection.to, (nodo) => {
      const elemento = elementoDeNodo(nodo);
      if (elemento) elementos.push(elemento);
      return false;
    });
    const desde = doc.resolve(selection.from).index(0);
    const hasta = doc.resolve(selection.to).index(0);
    return [{ tipo: 'elementos', desde, hasta, elementos, modo }, null];
  }
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
  const id = String(nodo.attrs.id ?? '');
  const elemento = id ? elementoDeNodo(nodo) : undefined;
  if (!elemento) return [{ tipo: 'texto' }, null];
  const posicion = selection.$from.index(0) + 1;
  // Los errores llegan con el índice del documento guardado (sin los párrafos vacíos): los ids de los campos también.
  const indice = normalizarDocumento(doc.toJSON()).content.findIndex((otro) => otro.attrs.id === id);
  return [
    { tipo: 'elementos', desde: posicion - 1, hasta: posicion, elementos: [elemento], modo },
    { id, posicion, indice, origen },
  ];
}

export default function EditorDocumento({
  contenido,
  errores,
  alCambiar,
  alSeleccionar,
  alPropiedades,
  acciones,
  anunciar,
  subidasEnCurso,
  hojaAbierta,
  alCerrarHoja,
  bloqueado,
}: PropsEditorDocumento) {
  const { imagenGuardada } = useContextoEditor();
  const idMenu = useId();
  const [menu, setMenu] = useState<EstadoMenu | null>(null);
  const [activo, setActivo] = useState(0);
  const ultimo = useRef({
    menu,
    activo,
    alCambiar,
    alSeleccionar,
    alPropiedades,
    anunciar,
    subidasEnCurso,
    imagenGuardada,
    hojaAbierta,
    alCerrarHoja,
  });
  const salioDelModo = useRef(false);
  const [dialogo, setDialogo] = useState<
    | { tipo: 'quitar'; cantidad: number; reintentar: () => void }
    | { tipo: 'convertir'; pierde: string[]; aplicar: () => void }
    | { tipo: 'atajos' }
    | null
  >(null);
  const contenedor = useRef<HTMLDivElement>(null);
  // Cuándo se anunció por última vez una acción (mover, duplicar…): el conteo del modo elementos no la pisa.
  const ultimaAccion = useRef(0);
  const temporizadorDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idElementoFoco = useRef<string | null>(null);

  const anunciarAccion = (mensaje: string) => {
    ultimaAccion.current = Date.now();
    // Insertar, mover y duplicar llevan debounce de 400 ms y solo se emiten si el foco no cambió a otro elemento (contracts/atajos.md).
    const conDebounce = /^(Se insertó|Elemento movido|Elemento duplicado)/.test(mensaje);
    if (conDebounce) {
      if (temporizadorDebounce.current) clearTimeout(temporizadorDebounce.current);
      const elementoAlProgramar = idElementoFoco.current;
      temporizadorDebounce.current = setTimeout(() => {
        if (!elementoAlProgramar || elementoAlProgramar === idElementoFoco.current) {
          ultimo.current.anunciar(mensaje);
        }
      }, 400);
      return;
    }

    if (temporizadorDebounce.current) {
      clearTimeout(temporizadorDebounce.current);
      temporizadorDebounce.current = null;
    }
    ultimo.current.anunciar(mensaje);
  };
  const [seleccion, setSeleccion] = useState<SeleccionDelDocumento>({ tipo: 'texto' });
  const estabaEnTabla = useRef(false);

  useEffect(() => {
    return () => {
      if (temporizadorDebounce.current) clearTimeout(temporizadorDebounce.current);
    };
  }, []);

  useEffect(() => {
    ultimo.current = {
      menu,
      activo,
      alCambiar,
      alSeleccionar,
      alPropiedades,
      anunciar,
      subidasEnCurso,
      imagenGuardada,
      hojaAbierta,
      alCerrarHoja,
    };
  });

  // Las devoluciones de la librería son estables y leen siempre lo último desde `ultimo`.
  const [devoluciones] = useState<DevolucionesDelEditor>(() => ({
    anunciar: (mensaje) => anunciarAccion(mensaje),
    menuAbierto: () => ultimo.current.menu !== null,
    salioDelModo: () => {
      salioDelModo.current = true;
    },
    cerrarHojaPendiente: () => {
      if (!salioDelModo.current || !ultimo.current.hojaAbierta) return false;
      salioDelModo.current = false;
      ultimo.current.alCerrarHoja();
      return true;
    },
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
    proteccion: {
      subidasEnCurso: () => ultimo.current.subidasEnCurso,
      imagenGuardada: (ruta) => ultimo.current.imagenGuardada(ruta),
      anunciar: (mensaje) => anunciarAccion(mensaje),
      pedirConfirmacion: (cantidad, reintentar) => setDialogo({ tipo: 'quitar', cantidad, reintentar }),
    },
  }));
  const [extensiones] = useState(() => crearExtensiones(devoluciones));
  // Lo que ofrecen el menú de acciones y el asa (las mismas funciones que usan los atajos).
  const [contextoDeAcciones] = useState<ContextoDeAcciones>(() => ({
    anunciar: (mensaje) => anunciarAccion(mensaje),
    subidasEnCurso: () => ultimo.current.subidasEnCurso,
    alPropiedades: () => ultimo.current.alPropiedades(),
    abrirAtajos: () => setDialogo({ tipo: 'atajos' }),
    pedirConversion: (pierde, aplicar) => setDialogo({ tipo: 'convertir', pierde, aplicar }),
  }));

  const editor = useEditor({
    immediatelyRender: false,
    // La barra se actualiza sola (useEditorState): volver a dibujar el lienzo en cada transacción le pisa el cursor.
    shouldRerenderOnTransaction: false,
    extensions: extensiones,
    content: paraElEditor(contenido),
    editable: !bloqueado,
    editorProps: {
      attributes: {
        'aria-label': 'Contenido del artículo',
        'aria-multiline': 'true',
        class: 'lienzo-documento min-h-64 outline-none',
      },
    },
    onUpdate: ({ editor: actual }) => {
      ultimo.current.alCambiar(normalizarDocumento(actual.getJSON()));
      // Si un elemento especial está seleccionado, el panel sigue mostrando sus datos al día.
      publicarSeleccion(actual, 'puntero');
    },
    onSelectionUpdate: ({ editor: actual }) => {
      const pendiente = actual.storage.atributosDelDocumento.abrirPanel;
      const origen = pendiente === 'foco' ? 'insertar' : pendiente === 'pestana' ? 'insertar-texto' : 'puntero';
      const [nueva, elemento] = leerSeleccion(actual, origen);
      const { selection, doc } = actual.state;
      const nodoTop =
        selection instanceof NodeSelection
          ? selection.node
          : selection.$from.depth >= 1
            ? selection.$from.node(1)
            : null;
      idElementoFoco.current = (nodoTop?.attrs?.id as string) ?? elemento?.id ?? null;
      // El pedido de «Insertar» se consume con la primera selección que ya es el elemento nuevo.
      if (elemento && pendiente) actual.storage.atributosDelDocumento.abrirPanel = false;
      setSeleccion(nueva);
      ultimo.current.alSeleccionar(nueva, elemento);

      const esTablaSeleccionada = selection instanceof NodeSelection && selection.node.type.name === 'table';
      const table = findTable(doc.resolve(selection.from));
      const enTabla = Boolean(table || esTablaSeleccionada);

      if (enTabla && !estabaEnTabla.current) {
        anunciarAccion(anuncioEntrarTabla());
      }
      estabaEnTabla.current = enTabla;

      if (selection instanceof CellSelection) {
        const rect = selectedRect(actual.state);
        const filas = rect.bottom - rect.top;
        const columnas = rect.right - rect.left;
        if (filas > 1 || columnas > 1) {
          anunciarAccion(anuncioSeleccionCeldas(filas, columnas));
        }
      }

      if (table && !(selection instanceof NodeSelection)) {
        registrarReferenciaTabla(actual);
      }
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
      actualizarElemento: (id, cambios) => {
        if (editor) actualizarElemento(editor, id, cambios);
      },
      alinearElemento: (id, alineacion) => {
        if (editor) alinearElemento(editor, id, alineacion);
      },
      seleccionarElemento: (id) => {
        const elemento = editor && buscarElemento(editor, id);
        if (!editor || !elemento) return;
        editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, elemento.pos)));
        (editor.view.nodeDOM(elemento.pos) as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
      },
      enfocar: () => {
        editor?.commands.focus();
      },
      adoptarContenido: (nuevo) => {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        // Sin `emitUpdate`: el reductor ya tiene lo del servidor. `setTextSelection` acota al nuevo largo.
        editor.chain().setContent(paraElEditor(nuevo), { emitUpdate: false }).setTextSelection({ from, to }).run();
      },
      ejecutarAccionTabla: (accion) => {
        if (!editor) return false;
        let pudo = false;
        let anuncio: string | undefined;
        switch (accion) {
          case 'fila_arriba':
          case 'fila_abajo': {
            pudo = accion === 'fila_arriba' ? agregarFilaAntes(editor) : agregarFila(editor);
            if (pudo) {
              const table = findTable(editor.state.doc.resolve(editor.state.selection.from));
              const filas = table ? cuadricula(table.node.toJSON() as TablaEstructural).filas : 0;
              anuncio = anuncioFilaAgregada(filas);
            }
            break;
          }
          case 'columna_izquierda':
          case 'columna_derecha': {
            pudo = accion === 'columna_izquierda' ? agregarColumnaAntes(editor) : agregarColumna(editor);
            if (pudo) {
              const table = findTable(editor.state.doc.resolve(editor.state.selection.from));
              const columnas = table ? cuadricula(table.node.toJSON() as TablaEstructural).columnas : 0;
              anuncio = anuncioColumnaAgregada(columnas);
            }
            break;
          }
          case 'quitar_fila': {
            pudo = eliminarFila(editor);
            if (pudo) {
              const table = findTable(editor.state.doc.resolve(editor.state.selection.from));
              const filas = table ? cuadricula(table.node.toJSON() as TablaEstructural).filas : 0;
              anuncio = anuncioFilaQuitada(filas);
            }
            break;
          }
          case 'quitar_columna': {
            pudo = eliminarColumna(editor);
            if (pudo) {
              const table = findTable(editor.state.doc.resolve(editor.state.selection.from));
              const columnas = table ? cuadricula(table.node.toJSON() as TablaEstructural).columnas : 0;
              anuncio = anuncioColumnaQuitada(columnas);
            }
            break;
          }
          case 'combinar': {
            pudo = combinarCeldas(editor);
            if (pudo) anuncio = anuncioCeldasCombinadas();
            break;
          }
          case 'separar': {
            pudo = separarCeldas(editor);
            if (pudo) anuncio = anuncioCeldasSeparadas();
            break;
          }
          case 'encabezado': {
            pudo = conmutarEncabezado(editor);
            if (pudo) {
              const table = findTable(editor.state.doc.resolve(editor.state.selection.from));
              const primeraFila = table?.node.childCount ? table.node.child(0) : null;
              const tieneEncabezado = Boolean(
                primeraFila?.childCount && primeraFila.child(0).type.name === 'tableHeader',
              );
              anuncio = anuncioFilaEncabezado(tieneEncabezado);
            }
            break;
          }
        }
        if (pudo && anuncio) {
          anunciarAccion(anuncio);
        }
        return pudo;
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

  // Los errores de validación marcan los elementos por `id` (el índice del error no es la posición en el lienzo).
  useEffect(() => {
    if (!editor) return;
    const mapa = mensajesPorElemento(editor, errores);
    editor.view.dispatch(editor.state.tr.setMeta(claveErrores, mapa).setMeta('addToHistory', false));
  }, [editor, errores]);

  // Las islas muestran el progreso de las subidas en curso.
  useEffect(() => {
    editor?.view.dispatch(editor.state.tr.setMeta(claveSubidas, subidasEnCurso).setMeta('addToHistory', false));
  }, [editor, subidasEnCurso]);

  useEffect(() => {
    editor?.setEditable(!bloqueado);
    editor?.view.dom.setAttribute('aria-readonly', String(bloqueado));
  }, [editor, bloqueado]);

  // El conteo del modo elementos se anuncia al entrar y al terminar de ampliar (no en cada paso) y se borra al salir.
  const cantidadEnModo = seleccion.tipo === 'elementos' && seleccion.modo ? seleccion.hasta - seleccion.desde : 0;
  const huboModo = useRef(false);
  useEffect(() => {
    if (cantidadEnModo === 0) {
      // Al montar (por ejemplo, tras «Reemplazar con la vigente») no se borra lo que se acaba de anunciar.
      if (!huboModo.current) return;
      huboModo.current = false;
      // Al salir del modo se borra el conteo, salvo que una acción (quitar, por ejemplo) acabe de anunciar algo.
      if (Date.now() - ultimaAccion.current > 400) ultimo.current.anunciar('');
      return;
    }
    huboModo.current = true;
    const programado = Date.now();
    const espera = setTimeout(() => {
      if (ultimaAccion.current < programado) ultimo.current.anunciar(anuncioModoElementos(cantidadEnModo));
    }, 500);
    return () => clearTimeout(espera);
  }, [cantidadEnModo]);

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
        contextoDeAcciones={contextoDeAcciones}
      />
      <BarraTabla editor={editor} deshabilitada={bloqueado} alPropiedades={alPropiedades} anunciar={anunciarAccion} />
      <div ref={contenedor} className="relative">
        <EditorContent editor={editor} className="mx-auto w-full max-w-lectura" />
        {editor && !bloqueado && (
          <AsaDeElemento editor={editor} contexto={contextoDeAcciones} contenedor={contenedor} />
        )}
      </div>
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
      {dialogo?.tipo === 'quitar' && (
        <ConfirmarAccion
          abierto
          titulo={dialogo.cantidad === 1 ? '¿Quitar este elemento?' : `¿Quitar ${dialogo.cantidad} elementos?`}
          descripcion="Incluye una imagen que ya está guardada en el artículo. Puedes deshacerlo con Ctrl+Z hasta que guardes."
          etiquetaConfirmar={dialogo.cantidad === 1 ? 'Quitar elemento' : `Quitar ${dialogo.cantidad} elementos`}
          variante="peligro"
          onConfirmar={() => dialogo.reintentar()}
          alCambiarAbierto={(abierto) => !abierto && setDialogo(null)}
          alCerrar={() => editor?.commands.focus()}
        />
      )}
      {dialogo?.tipo === 'convertir' && (
        <ConfirmarAccion
          abierto
          titulo="¿Convertir el elemento?"
          descripcion={`Al convertirlo se pierde ${dialogo.pierde.join(' y ')}.`}
          etiquetaConfirmar="Convertir"
          variante="primaria"
          onConfirmar={() => dialogo.aplicar()}
          alCambiarAbierto={(abierto) => !abierto && setDialogo(null)}
          alCerrar={() => editor?.commands.focus()}
        />
      )}
      {dialogo?.tipo === 'atajos' && (
        <AyudaAtajos
          alCerrar={() => {
            setDialogo(null);
            document.querySelector<HTMLElement>('[data-barra="acciones"]')?.focus();
          }}
        />
      )}
    </div>
  );
}
