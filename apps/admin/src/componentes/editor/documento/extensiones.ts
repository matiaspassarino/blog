// Esquema del documento y extensiones del editor (research D22, D23 y D31 C12 de la spec 005). El esquema de
// ProseMirror es exactamente la lista permitida del documento guardado (contracts/documento.md): lo que el sitio no
// sabe dibujar no existe en el editor, y los atributos de la librería que no se guardan se quitan.
import {
  Extension,
  InputRule,
  Node,
  mergeAttributes,
  textblockTypeInputRule,
  wrappingInputRule,
  type AnyExtension,
  type Editor,
} from '@tiptap/core';
import { Fragment, Slice, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { CodeBlock } from '@tiptap/extension-code-block';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { OrderedList } from '@tiptap/extension-list';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { TextAlign } from '@tiptap/extension-text-align';
import { NodeSelection, Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { goToNextCell, isInTable } from '@tiptap/pm/tables';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  CLASE_ENLACE,
  CLASES_CITA,
  CLASES_CITA_TEXTO,
  CLASES_CODIGO,
  CLASES_LISTA,
  CLASES_LISTA_NUMERADA,
  CLASES_LISTA_VINETAS,
  CLASES_PARRAFO,
  CLASES_RESALTADO,
  CLASES_SUBRAYADO,
  CLASES_SEPARADOR,
  CLASES_TITULO,
  CLASES_TITULO_POR_NIVEL,
  conAlineacion,
} from '@blog/bloques/render';
import { Placeholder } from '@tiptap/extensions';
import { ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Suggestion from '@tiptap/suggestion';
import { atajosDeIndices, detectarAtajo, nombreDeAtajo, puedeAbrirMenu } from './atajos';
import { deshacerORehacer, registrarAccion } from './acciones-elemento';
import { agregarFila, registrarReferenciaTabla } from './tablas';
import { asegurarIds } from './ids';
import { filtrarItems, type ItemDeInsercion } from './menu-insercion';
import { claveErrores, claveModo, claveSubidas } from './claves';
import {
  ampliarSeleccion,
  duplicarRango,
  moverRango,
  quitarRango,
  rangoDeElementos,
  salirDelModo,
  SeleccionDeElementos,
} from './comandos';
import { proteger, type DevolucionesDeProteccion } from './proteger';
import { NodoBloque } from './nodos/NodoBloque';
import {
  LIMITES_ELEMENTO,
  MAXIMO_ELEMENTOS_DOCUMENTO,
  contarCaracteresTexto,
  RastreadorDeAvisosLimite,
} from './limites';
import { partirTexto, restringirTextoPorTipo, limpiarIdsDeNodos, procesarTablaPegada } from './pegado';
import { anuncioPegadoConSobrante, anuncioPrimeraCelda } from '../anuncios';

declare module '@tiptap/core' {
  interface Storage {
    atributosDelDocumento: { abrirPanel: false | 'foco' | 'pestana'; anunciar: (mensaje: string) => void };
  }
}

const TIPOS_CON_ID = [
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'codeBlock',
  'horizontalRule',
  'table',
  'imagen',
  'galeria',
  'cta',
  'video',
];

/** Un atributo propio: sin valor es `null` (la normalización lo quita) y no sale en el HTML del portapapeles. */
const propio = { default: null, rendered: false } as const;

/** `https://…` o una ruta interna (`/…`, no `//…`): lo único que el sitio acepta como enlace. */
export const esEnlacePermitido = (url: string) => /^https:\/\/[^\s/]+\.\S+$/.test(url) || /^\/(?!\/)\S*$/.test(url);

/** Atributos propios: la identidad de cada elemento y los campos que el panel edita (no viajan por el portapapeles). */
const atributosDelDocumento = (devoluciones: DevolucionesDelEditor) =>
  Extension.create({
    name: 'atributosDelDocumento',
    addStorage() {
      return {
        /** Lo pone «Insertar» al crear un elemento especial: la próxima selección abre el panel y le da el foco. */
        abrirPanel: false,
        /** Anuncios para la región de estado (los pone el componente). */
        anunciar: devoluciones.anunciar,
      };
    },
    addGlobalAttributes() {
      return [
        { types: TIPOS_CON_ID, attributes: { id: { ...propio, keepOnSplit: false } } },
        { types: ['blockquote'], attributes: { autor: propio, fuente: propio } },
        { types: ['codeBlock'], attributes: { lenguaje: propio } },
        { types: ['table'], attributes: { descripcion: propio } },
      ];
    },
  });

/** Enlace con solo `href`: `target`, `rel` y `class` los pone el sitio al dibujar (D31 C12). */
const Enlace = Link.extend({
  addAttributes() {
    return { href: { default: null } };
  },
  addInputRules() {
    return [
      new InputRule({
        find: /(?:^|\s)\[([^\]]+)\]\(([^)]+)\)$/,
        handler: ({ state, range, match }) => {
          const [, texto, href] = match;
          if (!texto || !href || !esEnlacePermitido(href)) return null;
          const { tr } = state;
          const offsetInicio = match[0].indexOf('[');
          const inicio = range.from + offsetInicio;
          const fin = range.to;
          tr.replaceWith(inicio, fin, state.schema.text(texto, [state.schema.marks.link.create({ href })]));
        },
      }),
    ];
  },
});

/** Lista numerada sin `start` ni `type`: el sitio siempre numera desde 1. */
const ListaNumerada = OrderedList.extend({
  addAttributes() {
    return {};
  },
});

/**
 * Sin atajo ni reglas de escritura (research D28): los atajos habituales del tachado y del resaltado chocan con
 * Firefox y los de la alineación con el navegador y con AltGr. Se aplican desde la barra.
 */
const sinAtajos = { addKeyboardShortcuts: () => ({}), addInputRules: () => [], addPasteRules: () => [] };

/** El tachado viene en `starter-kit`: se le quitan el atajo y la regla `~~x~~`. */
const Base = StarterKit.extend({
  addExtensions() {
    return (this.parent?.() ?? []).map((extension) =>
      extension.name === 'strike' ? extension.extend(sinAtajos) : extension,
    );
  },
});

/** Un solo color, el del sitio (sin `color`). */
const Resaltado = Highlight.extend({
  ...sinAtajos,
  parseHTML() {
    return [
      { tag: 'mark' },
      {
        tag: 'span',
        getAttrs: (element) => {
          const bg = (element as HTMLElement).style?.backgroundColor;
          return bg ? {} : false;
        },
      },
    ];
  },
}).configure({
  multicolor: false,
  HTMLAttributes: { class: CLASES_RESALTADO },
});

/** Solo párrafos y títulos; la izquierda es la ausencia del atributo (`null`), nunca `"left"`. */
const Alineacion = TextAlign.extend({ addKeyboardShortcuts: () => ({}) }).configure({
  types: ['paragraph', 'heading'],
  alignments: ['left', 'center', 'right', 'justify'],
  defaultAlignment: null,
});

/** Superíndice y subíndice se excluyen entre sí; sus teclas dependen del sistema (contracts/atajos.md). */
const Superindice = Superscript.extend({
  excludes: 'subscript',
  addKeyboardShortcuts() {
    const teclas = atajosDeIndices();
    return teclas ? { [teclas.superindice]: () => this.editor.commands.toggleSuperscript() } : {};
  },
});
const Subindice = Subscript.extend({
  excludes: 'superscript',
  addKeyboardShortcuts() {
    const teclas = atajosDeIndices();
    return teclas ? { [teclas.subindice]: () => this.editor.commands.toggleSubscript() } : {};
  },
});

/** Bloque de código sin el `language` de la librería: el lenguaje es el atributo propio `lenguaje`. */
const BloqueDeCodigo = CodeBlock.extend({
  addAttributes() {
    return {};
  },
  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^```$/,
        type: this.type,
      }),
      textblockTypeInputRule({
        find: /^```([a-z0-9+#-]+)?[\s\n]$/,
        type: this.type,
        getAttributes: (match) => ({ lenguaje: match[1] || null }),
      }),
    ];
  },
});

/** Cita de un solo párrafo, con autor y fuente en el panel. Enter al final sale de la cita. */
const Cita = Node.create({
  name: 'blockquote',
  group: 'block',
  content: 'paragraph',
  defining: true,
  parseHTML: () => [{ tag: 'blockquote' }],
  renderHTML: ({ HTMLAttributes }) => ['blockquote', mergeAttributes(HTMLAttributes), 0],
  addInputRules() {
    return [wrappingInputRule({ find: /^\s*>\s$/, type: this.type })];
  },
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.node(1).type.name !== 'blockquote') return false;
        const despues = $from.after(1);
        if ($from.parentOffset < $from.parent.content.size) return true; // a mitad de la cita no se parte
        return editor
          .chain()
          .insertContentAt(despues, { type: 'paragraph' })
          .setTextSelection(despues + 1)
          .run();
      },
    };
  },
});

/** Ítem de lista de un solo párrafo (sin listas anidadas). */
const ItemDeLista = Node.create({
  name: 'listItem',
  content: 'paragraph',
  defining: true,
  parseHTML: () => [{ tag: 'li' }],
  renderHTML: ({ HTMLAttributes }) => ['li', mergeAttributes(HTMLAttributes), 0],
  addKeyboardShortcuts() {
    return { Enter: ({ editor }) => editor.commands.splitListItem(this.name) };
  },
});

/** Tablas sin colwidth y con celdas de párrafos (research D29, D31 C12 y U15). */
const Tabla = Table.configure({
  resizable: false,
  allowTableNodeSelection: true,
});

const CeldaEncabezado = TableHeader.extend({
  content: 'paragraph+',
  addAttributes() {
    return {
      colspan: {
        default: 1,
        parseHTML: (element) => {
          const valor = parseInt(element.getAttribute('colspan') || '1', 10);
          return valor > 0 ? valor : 1;
        },
        renderHTML: (attributes) => (attributes.colspan > 1 ? { colspan: attributes.colspan } : {}),
      },
      rowspan: {
        default: 1,
        parseHTML: (element) => {
          const valor = parseInt(element.getAttribute('rowspan') || '1', 10);
          return valor > 0 ? valor : 1;
        },
        renderHTML: (attributes) => (attributes.rowspan > 1 ? { rowspan: attributes.rowspan } : {}),
      },
    };
  },
});

const Celda = TableCell.extend({
  content: 'paragraph+',
  addAttributes() {
    return {
      colspan: {
        default: 1,
        parseHTML: (element) => {
          const valor = parseInt(element.getAttribute('colspan') || '1', 10);
          return valor > 0 ? valor : 1;
        },
        renderHTML: (attributes) => (attributes.colspan > 1 ? { colspan: attributes.colspan } : {}),
      },
      rowspan: {
        default: 1,
        parseHTML: (element) => {
          const valor = parseInt(element.getAttribute('rowspan') || '1', 10);
          return valor > 0 ? valor : 1;
        },
        renderHTML: (attributes) => (attributes.rowspan > 1 ? { rowspan: attributes.rowspan } : {}),
      },
    };
  },
});

const reglasDeTabla = (devoluciones: DevolucionesDelEditor) => {
  return Extension.create({
    name: 'reglasDeTabla',
    priority: 150,
    addKeyboardShortcuts() {
      return {
        'Shift-Tab': ({ editor }) => {
          if (!isInTable(editor.state)) return false;
          const puedeRetroceder = goToNextCell(-1)(editor.state, undefined);
          if (!puedeRetroceder) {
            devoluciones.anunciar(anuncioPrimeraCelda());
            return true;
          }
          return false;
        },
        Tab: ({ editor }) => {
          if (!isInTable(editor.state)) return false;
          const puedeAvanzar = goToNextCell(1)(editor.state, undefined);
          if (!puedeAvanzar) {
            const anchoValido =
              typeof window === 'undefined' ? true : window.matchMedia('(min-width: 48rem)').matches;
            if (!anchoValido) {
              return true;
            }
            let aviso = '';
            const pudo = agregarFila(editor, { alAvisar: (msg) => (aviso = msg) });
            if (!pudo) {
              if (aviso) devoluciones.anunciar(aviso);
              return true;
            }
            goToNextCell(1)(editor.state, editor.view.dispatch);
            return true;
          }
          return false;
        },
      };
    },
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        new Plugin({
          key: new PluginKey('reglasDeTabla'),
          view() {
            return {
              update: () => {
                if (editor) registrarReferenciaTabla(editor);
              },
            };
          },
        }),
      ];
    },
  });
};

/** Los títulos no llevan saltos simples, las citas y los ítems no los ofrecen y el código no lleva marcas. */
const ReglasDeTexto = Extension.create({
  name: 'reglasDeTexto',
  priority: 1000,
  addKeyboardShortcuts() {
    const enCodigo = () => this.editor.state.selection.$from.parent.type.name === 'codeBlock';
    const sinSalto = () => {
      const { $from } = this.editor.state.selection;
      return [...Array($from.depth + 1).keys()].some((n) =>
        ['heading', 'blockquote', 'listItem'].includes($from.node(n).type.name),
      );
    };
    const sinMarcas = enCodigo;
    return {
      'Shift-Enter': sinSalto,
      'Mod-Enter': sinSalto,
      'Mod-b': sinMarcas,
      'Mod-i': sinMarcas,
      'Mod-u': sinMarcas,
      'Mod-e': sinMarcas,
      'Mod-k': () => {
        if (!sinMarcas()) this.editor.view.dom.dispatchEvent(new CustomEvent('abrir-enlace'));
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('titulosSinSaltos'),
        appendTransaction: (_transacciones, _antes, despues) => {
          if (!_transacciones.some((tr) => tr.docChanged)) return null;
          const tr = despues.tr;
          despues.doc.descendants((nodo, pos) => {
            if (nodo.type.name !== 'heading') return;
            nodo.descendants((hijo, relativa) => {
              const inicio = pos + 1 + relativa;
              if (hijo.type.name === 'hardBreak')
                tr.delete(tr.mapping.map(inicio), tr.mapping.map(inicio + hijo.nodeSize));
            });
          });
          return tr.docChanged ? tr.setMeta('addToHistory', false) : null;
        },
      }),
    ];
  },
});

/** Clases de tipografía del sitio para cada elemento de primer nivel: el lienzo se ve como el artículo publicado. */
function clasesDe(nodo: { type: { name: string }; attrs: Record<string, unknown> }): string | undefined {
  switch (nodo.type.name) {
    case 'paragraph':
      return conAlineacion(CLASES_PARRAFO, nodo.attrs.textAlign as string | undefined);
    case 'heading':
      return conAlineacion(
        `${CLASES_TITULO} ${CLASES_TITULO_POR_NIVEL[nodo.attrs.level as 2 | 3 | 4] ?? ''}`,
        nodo.attrs.textAlign as string | undefined,
      );
    case 'blockquote':
      return `${CLASES_CITA} ${CLASES_CITA_TEXTO}`;
    case 'bulletList':
      return `${CLASES_LISTA} ${CLASES_LISTA_VINETAS}`;
    case 'orderedList':
      return `${CLASES_LISTA} ${CLASES_LISTA_NUMERADA}`;
    case 'codeBlock':
      return `mt-bloque ${CLASES_CODIGO}`;
    case 'horizontalRule':
      return CLASES_SEPARADOR;
    default:
      return undefined;
  }
}

const Tipografia = Extension.create({
  name: 'tipografia',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('tipografia'),
        props: {
          decorations: ({ doc }) => {
            const decoraciones: Decoration[] = [];
            doc.forEach((nodo, desplazamiento) => {
              const clase = clasesDe(nodo);
              if (clase)
                decoraciones.push(Decoration.node(desplazamiento, desplazamiento + nodo.nodeSize, { class: clase }));
            });
            return DecorationSet.create(doc, decoraciones);
          },
        },
      }),
    ];
  },
});

/** Asigna el `id` de los elementos nuevos una sola vez y deduplica los repetidos (research D6 y D21). */
const AsignarIds = Extension.create({
  name: 'asignarIds',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('asignarIds'),
        appendTransaction: (transacciones, _antes, despues) => {
          if (!transacciones.some((tr) => tr.docChanged)) return null;
          const elementos = despues.doc.content.content;
          const actual = {
            type: 'doc',
            content: elementos.map((nodo) => ({ type: nodo.type.name, attrs: nodo.attrs })),
          };
          const asegurado = asegurarIds(actual);
          const tr = despues.tr;
          let pos = 0;
          elementos.forEach((nodo, i) => {
            const atributos = asegurado.content?.[i]?.attrs;
            if (atributos && atributos.id !== nodo.attrs.id) {
              tr.setNodeMarkup(pos, undefined, { ...nodo.attrs, ...atributos });
            }
            // Solo los elementos de primer nivel tienen identidad y alineación: un párrafo que pasa a una cita o a
            // una lista (`wrapIn`, `toggleBulletList`) o que llega pegado adentro deja su `id` y su `textAlign`, que
            // la lista permitida no admite ahí.
            nodo.descendants((hijo, relativa) => {
              if (hijo.attrs.id != null || hijo.attrs.textAlign != null) {
                tr.setNodeMarkup(pos + 1 + relativa, undefined, { ...hijo.attrs, id: null, textAlign: null });
              }
            });
            pos += nodo.nodeSize;
          });
          if (!tr.docChanged) return null;
          // Marcar los atributos puede deshacer una selección de elementos enteros: se vuelve a poner igual.
          const { selection } = despues;
          if (selection instanceof SeleccionDeElementos) {
            tr.setSelection(new SeleccionDeElementos(tr.doc, selection.from, selection.to));
          } else if (selection instanceof NodeSelection && selection.$from.depth === 0) {
            tr.setSelection(NodeSelection.create(tr.doc, selection.from));
          }
          return tr.setMeta('addToHistory', false).setMeta(claveModo, claveModo.getState(despues) ?? false);
        },
      }),
    ];
  },
});

/** Errores de validación por `id`: marcan el elemento en el lienzo, con texto, no solo con color. */

const MarcasDeError = Extension.create({
  name: 'marcasDeError',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: claveSubidas,
        state: {
          init: () => new Set<string>() as ReadonlySet<string>,
          apply: (tr, anterior) => tr.getMeta(claveSubidas) ?? anterior,
        },
      }),
      new Plugin({
        key: claveErrores,
        state: {
          init: () => new Map<string, string[]>(),
          apply: (tr, anterior) => tr.getMeta(claveErrores) ?? anterior,
        },
        props: {
          decorations(estado) {
            const errores = claveErrores.getState(estado);
            if (!errores || errores.size === 0) return DecorationSet.empty;
            const decoraciones: Decoration[] = [];
            estado.doc.forEach((nodo, desplazamiento) => {
              const mensajes = errores.get(String(nodo.attrs.id));
              if (!mensajes) return;
              const idMensaje = `error-${String(nodo.attrs.id)}`;
              decoraciones.push(
                Decoration.node(
                  desplazamiento,
                  desplazamiento + nodo.nodeSize,
                  {
                    class: 'rounded-md outline-2 outline-offset-4 outline-error',
                    'data-con-error': 'si',
                    // Las islas muestran su propio mensaje; los elementos de texto lo llevan debajo.
                    ...(nodo.isAtom ? {} : { 'aria-describedby': idMensaje }),
                  },
                  { errores: mensajes },
                ),
              );
              if (nodo.isAtom) return;
              const texto = `Error: ${mensajes.join('. ')}`;
              decoraciones.push(
                Decoration.widget(desplazamiento + nodo.nodeSize, () => mensajeDeError(idMensaje, texto), {
                  key: `${idMensaje}:${texto}`,
                  side: -1,
                  ignoreSelection: true,
                }),
              );
            });
            return DecorationSet.create(estado.doc, decoraciones);
          },
        },
      }),
    ];
  },
});

/** El mensaje de error bajo un elemento de texto (como el de las islas en `NodoBloque`). */
function mensajeDeError(id: string, texto: string) {
  const parrafo = document.createElement('p');
  parrafo.id = id;
  parrafo.contentEditable = 'false';
  parrafo.className = 'mt-2 text-sm font-semibold text-error';
  parrafo.textContent = texto;
  return parrafo;
}

/** Ícono de verificación de la marca de selección (no depende del color). */
function iconoDeSeleccion() {
  const icono = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icono.setAttribute('viewBox', '0 0 24 24');
  icono.setAttribute('aria-hidden', 'true');
  icono.setAttribute('focusable', 'false');
  icono.setAttribute('class', 'absolute -left-7 top-1 size-5 text-marca');
  icono.setAttribute('fill', 'none');
  icono.setAttribute('stroke', 'currentColor');
  icono.setAttribute('stroke-width', '3');
  icono.setAttribute('stroke-linecap', 'round');
  icono.setAttribute('stroke-linejoin', 'round');
  const trazo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  trazo.setAttribute('d', 'M5 12l5 5 9-10');
  icono.appendChild(trazo);
  return icono;
}

/**
 * Modo elementos (contracts/atajos.md): `Esc` selecciona el elemento entero, `Shift+↑/↓` suma contiguos, `Alt+↑/↓`
 * mueve, `Mod+D` duplica, `Supr`/`Retroceso` quita y `Enter` abre las propiedades. Cada elemento seleccionado lleva
 * una marca que no depende del color: borde a la izquierda, un ícono de verificación y `data-seleccionado`.
 */
function modoElementos(devoluciones: DevolucionesDelEditor) {
  const sobreRango =
    (comando: (estado: EditorState, despachar?: (tr: Transaction) => void) => boolean, accion?: string) =>
    ({ editor }: { editor: Editor }) => {
      const aplicado = comando(editor.state, (tr) => editor.view.dispatch(tr));
      if (aplicado && accion) registrarAccion(editor, accion);
      if (aplicado) editor.commands.focus();
      return aplicado;
    };
  return Extension.create({
    name: 'modoElementos',
    priority: 900,
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: claveModo,
          state: {
            init: () => false,
            apply: (tr, anterior) => tr.getMeta(claveModo) ?? (tr.selectionSet ? false : anterior),
          },
          props: {
            // Con elementos enteros seleccionados y el foco afuera (en el panel), al volver con un clic ProseMirror
            // repone esa selección en el DOM y el clic no mueve el cursor: se lo pone acá, donde se hizo clic.
            handleClick: (vista, pos) => {
              const { selection, doc } = vista.state;
              const entera = selection instanceof SeleccionDeElementos || selection instanceof NodeSelection;
              if (!entera || (pos >= selection.from && pos <= selection.to)) return false;
              if (!doc.resolve(pos).parent.isTextblock) return false;
              vista.dispatch(vista.state.tr.setSelection(TextSelection.create(doc, pos)));
              return true;
            },
            decorations: (estado) => {
              const rango = rangoDeElementos(estado);
              if (!rango) return DecorationSet.empty;
              const decoraciones: Decoration[] = [];
              estado.doc.nodesBetween(rango.desde, rango.hasta, (nodo, pos, padre) => {
                if (padre !== estado.doc) return false;
                decoraciones.push(
                  Decoration.node(pos, pos + nodo.nodeSize, {
                    'data-seleccionado': 'true',
                    class: 'relative -ml-4 border-l-2 border-marca pl-3',
                  }),
                );
                if (!nodo.isAtom)
                  decoraciones.push(Decoration.widget(pos + 1, iconoDeSeleccion, { side: -1, key: `marca-${pos}` }));
                return false;
              });
              return DecorationSet.create(estado.doc, decoraciones);
            },
          },
        }),
      ];
    },
    addKeyboardShortcuts() {
      return {
        Escape: ({ editor }) => {
          if (devoluciones.menuAbierto()) return false;
          const { doc, selection, tr } = editor.state;
          if (claveModo.getState(editor.state)) {
            // Esc dentro del modo: vuelve al texto.
            salirDelModo()(editor.state, (tr) => editor.view.dispatch(tr));
            devoluciones.salioDelModo();
            return true;
          }
          // Con la hoja abierta, el `Esc` que sigue a salir del modo la cierra (último en el orden de `Esc`).
          if (devoluciones.cerrarHojaPendiente()) return true;
          // El navegador puede haber movido el cursor un instante antes de que ProseMirror lo sepa (un clic seguido de
          // `Esc`): se lee la selección del DOM y no la del estado.
          const dom = window.getSelection();
          const posDelDom = dom?.anchorNode ? editor.view.posAtDOM(dom.anchorNode, dom.anchorOffset) : selection.from;
          const $from = selection instanceof NodeSelection ? selection.$from : doc.resolve(posDelDom);
          if ($from.depth === 0 && !(selection instanceof NodeSelection)) return false;
          const pos = selection instanceof NodeSelection ? selection.from : $from.before(1);
          editor.view.dispatch(tr.setSelection(NodeSelection.create(doc, pos)).setMeta(claveModo, true));
          return true;
        },
        Enter: ({ editor }) => {
          if (claveModo.getState(editor.state)) {
            devoluciones.alPropiedades();
            return true;
          }
          if (editor.state.doc.childCount >= MAXIMO_ELEMENTOS_DOCUMENTO) {
            const { $from } = editor.state.selection;
            if ($from.depth === 1) {
              devoluciones.anunciar(`Se alcanzó el máximo de ${MAXIMO_ELEMENTOS_DOCUMENTO} elementos`);
              return true;
            }
          }
          return false;
        },
        'Alt-ArrowUp': sobreRango(moverRango(-1), 'mover elemento'),
        'Alt-ArrowDown': sobreRango(moverRango(1), 'mover elemento'),
        'Mod-d': sobreRango(duplicarRango(), 'duplicar elemento'),
        Delete: sobreRango(quitarRango(), 'quitar elemento'),
        Backspace: sobreRango(quitarRango(), 'quitar elemento'),
        'Mod-z': ({ editor }) => deshacerORehacer(editor, false, devoluciones.anunciar),
        'Mod-Shift-z': ({ editor }) => deshacerORehacer(editor, true, devoluciones.anunciar),
        'Mod-y': ({ editor }) => deshacerORehacer(editor, true, devoluciones.anunciar),
        'Shift-ArrowUp': sobreRango(ampliarSeleccion(-1)),
        'Shift-ArrowDown': sobreRango(ampliarSeleccion(1)),
      };
    },
  });
}

/** Los campos de cada elemento especial: se editan en el panel y se guardan como `attrs` planos (D22). */
const CAMPOS_ESPECIALES = {
  imagen: ['imagen', 'leyenda'],
  galeria: ['imagenes', 'columnas'],
  cta: ['titulo', 'texto', 'etiquetaBoton', 'url', 'variante'],
  video: ['proveedor', 'idVideo', 'titulo'],
} as const;

function nodoEspecial(name: keyof typeof CAMPOS_ESPECIALES) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: false,
    addAttributes() {
      return Object.fromEntries(CAMPOS_ESPECIALES[name].map((campo) => [campo, propio]));
    },
    parseHTML: () => [],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-elemento': name })],
    addNodeView() {
      return ReactNodeViewRenderer(NodoBloque, { attrs: { 'data-elemento': name } });
    },
  });
}

export type EstadoMenu = {
  consulta: string;
  /** Posición del cursor en pantalla, para ubicar el menú. */
  rect: DOMRect | null;
  elegir: (item: ItemDeInsercion) => void;
};

export type DevolucionesDelEditor = {
  /** Salió del modo elementos con `Esc`: el próximo `Esc` puede cerrar la hoja de propiedades. */
  salioDelModo: () => void;
  /** Cierra la hoja de propiedades si estaba abierta y se acababa de salir del modo; `true` si la cerró. */
  cerrarHojaPendiente: () => boolean;
  /** Lo que `proteger` necesita saber para decidir si se puede quitar o mover un elemento. */
  proteccion: DevolucionesDeProteccion;
  /** Anuncios para la región de estado persistente. */
  anunciar: (mensaje: string) => void;
  /** Si el menú «/» está abierto: `Esc` lo cierra antes de entrar al modo elementos. */
  menuAbierto: () => boolean;
  /** `Enter` en el modo elementos: abrir las propiedades del elemento. */
  alPropiedades: () => void;
  /** Abre, actualiza (con el estado nuevo) o cierra (con `null`) el menú «/». */
  alMenu: (estado: EstadoMenu | null) => void;
  /** Teclas con el menú «/» abierto: devuelve `true` si las atendió. */
  alTeclearMenu: (evento: KeyboardEvent) => boolean;
  /** Anuncia una conversión por atajo de escritura. */
  alConvertir: (nombre: string) => void;
};

function menuBarra(devoluciones: DevolucionesDelEditor) {
  return Extension.create({
    name: 'menuBarra',
    addProseMirrorPlugins() {
      return [
        Suggestion<ItemDeInsercion, ItemDeInsercion>({
          editor: this.editor,
          char: '/',
          startOfLine: true,
          allow: ({ state, range }) => {
            const $desde = state.doc.resolve(range.from);
            for (let d = $desde.depth; d > 0; d--) {
              const tipo = $desde.node(d).type.name;
              if (tipo === 'tableCell' || tipo === 'tableHeader') return false;
            }
            return puedeAbrirMenu({
              antes: $desde.parent.textBetween(0, $desde.parentOffset),
              despues: $desde.parent.textBetween(range.to - $desde.start(), $desde.parent.content.size),
            });
          },
          items: ({ query }) => filtrarItems(query),
          command: ({ editor, range, props }) => {
            editor.chain().focus().deleteRange(range).run();
            props.insertar(editor);
          },
          render: () => {
            const estado = (props: {
              query: string;
              clientRect?: (() => DOMRect | null) | null;
              command: (item: ItemDeInsercion) => void;
            }) =>
              devoluciones.alMenu({ consulta: props.query, rect: props.clientRect?.() ?? null, elegir: props.command });
            return {
              onStart: estado,
              onUpdate: estado,
              onKeyDown: ({ event }) => devoluciones.alTeclearMenu(event),
              onExit: () => devoluciones.alMenu(null),
            };
          },
        }),
      ];
    },
  });
}

/** Anuncia las conversiones por atajo de escritura ("Se convirtió en título 2"); la conversión la hace la librería. */
function anunciarAtajos(devoluciones: DevolucionesDelEditor) {
  return Extension.create({
    name: 'anunciarAtajos',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('anunciarAtajos'),
          props: {
            handleTextInput: (vista, desde, hasta, texto) => {
              const { $from } = vista.state.selection;
              if ($from.depth !== 1 || $from.parent.type.name !== 'paragraph') return false;
              const antes = $from.parent.textBetween(0, $from.parentOffset);
              const atajo = detectarAtajo(antes + texto);
              if (atajo && desde === hasta) devoluciones.alConvertir(nombreDeAtajo(atajo));
              return false;
            },
          },
        }),
      ];
    },
  });
}

/**
 * Reglas de pegado (RF-015, RF-028; research D28):
 * - divide párrafos de más de 5000 caracteres sin cortar palabras y anuncia los párrafos nuevos creados;
 * - en elementos restringidos (títulos, citas, ítems, celdas y código) el sobrante se recorta sin crear párrafos;
 * - limpia los atributos `id` para que no se dupliquen identificadores;
 * - convierte tablas que excedan 10 columnas o 50 filas a texto y separa celdas inválidas;
 * - bloquea pegados que superen el límite de 200 elementos.
 */
function reglasDePegado(devoluciones: DevolucionesDelEditor) {
  return Extension.create({
    name: 'reglasDePegado',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('reglasDePegado'),
          props: {
            transformPasted(slice, view) {
              const { doc, selection, schema } = view.state;
              const targetParent = selection.$from.parent;
              const targetType = targetParent.type.name;

              // En elementos restringidos (heading, blockquote, listItem, codeBlock, tableCell, tableHeader)
              // el sobrante no crea otros elementos: se recorta al límite del tipo.
              if (targetType !== 'paragraph' && LIMITES_ELEMENTO[targetType]) {
                const textoOriginal = slice.content.textBetween(0, slice.content.size, ' ');
                const restringido = restringirTextoPorTipo(targetType, textoOriginal);
                return new Slice(Fragment.from(schema.text(restringido.texto)), 0, 0);
              }

              const fragmentos: ProseMirrorNode[] = [];
              let parrafosCreados = 0;

              for (let i = 0; i < slice.content.childCount; i++) {
                const child = slice.content.child(i);

                // Caso 1: Tabla pegada
                if (child.type.name === 'table') {
                  const resTabla = procesarTablaPegada(child.toJSON());
                  if (resTabla.esTexto) {
                    devoluciones.anunciar(resTabla.anuncio);
                    for (const p of resTabla.parrafos ?? []) {
                      fragmentos.push(schema.nodes.paragraph.create(null, p ? schema.text(p) : []));
                    }
                  } else {
                    devoluciones.anunciar(resTabla.anuncio);
                    const jsonLimpio = limpiarIdsDeNodos(resTabla.tabla ?? child.toJSON());
                    fragmentos.push(schema.nodeFromJSON(jsonLimpio));
                  }
                  continue;
                }

                // Caso 2: Párrafo o texto largo
                if (child.type.name === 'paragraph' || child.isText) {
                  const texto = child.textContent;
                  if (texto.length > 5000) {
                    const partes = partirTexto(texto, 5000);
                    parrafosCreados += partes.length;
                    for (const parte of partes) {
                      fragmentos.push(schema.nodes.paragraph.create(null, schema.text(parte)));
                    }
                    continue;
                  }
                }

                // Caso 3: Nodos normales (limpiando IDs)
                const jsonLimpio = limpiarIdsDeNodos(child.toJSON());
                fragmentos.push(schema.nodeFromJSON(jsonLimpio));
              }

              // Verificar límite de 200 elementos
              const totalDespues = doc.childCount + fragmentos.length;
              if (totalDespues > MAXIMO_ELEMENTOS_DOCUMENTO) {
                devoluciones.anunciar(`Se alcanzó el máximo de ${MAXIMO_ELEMENTOS_DOCUMENTO} elementos`);
                return Slice.empty;
              }

              if (parrafosCreados > 1) {
                devoluciones.anunciar(anuncioPegadoConSobrante(parrafosCreados));
              }

              return new Slice(Fragment.fromArray(fragmentos), slice.openStart, slice.openEnd);
            },
          },
        }),
      ];
    },
  });
}

/**
 * Rastreo de límites de caracteres (contracts/atajos.md y CE-006):
 * anuncia al cruzar el 90 % ("Quedan X caracteres") y el 100 % ("Se alcanzó el máximo de caracteres..."),
 * sin repetirse en cada pulsación de tecla.
 */
function rastreadorDeLimites(devoluciones: DevolucionesDelEditor) {
  const rastreador = new RastreadorDeAvisosLimite();
  return Extension.create({
    name: 'rastreadorDeLimites',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('rastreadorDeLimites'),
          appendTransaction(transactions, _oldState, newState) {
            if (!transactions.some((tr) => tr.docChanged)) return null;
            const { selection } = newState;
            const $from = selection.$from;
            let nodoTarget: ProseMirrorNode | null = null;
            let tipo = '';
            let id = '';

            for (let d = $from.depth; d > 0; d--) {
              const n = $from.node(d);
              if (n.type.name === 'tableCell' || n.type.name === 'tableHeader') {
                nodoTarget = n;
                tipo = n.type.name;
                id = `celda-${$from.before(d)}`;
                break;
              }
            }

            if (!nodoTarget && $from.depth > 0) {
              nodoTarget = $from.node(1);
              tipo = nodoTarget.type.name;
              id = String(nodoTarget.attrs.id ?? `elem-${$from.before(1)}`);
            }

            if (nodoTarget && LIMITES_ELEMENTO[tipo]) {
              const chars = contarCaracteresTexto(nodoTarget.toJSON());
              const aviso = rastreador.verificar(id, tipo, chars);
              if (aviso) {
                devoluciones.anunciar(aviso);
              }
            }

            return null;
          },
        }),
      ];
    },
  });
}

/** Texto de ayuda de la línea vacía: sin teclado físico la «/» suele estar en un segundo nivel. */
const textoDeLineaVacia = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    ? 'Escribe o usa Insertar'
    : 'Escribe o pulsa / para insertar';

export function crearExtensiones(devoluciones: DevolucionesDelEditor): AnyExtension[] {
  return [
    Base.configure({
      heading: { levels: [2, 3, 4] },
      blockquote: false,
      listItem: false,
      orderedList: false,
      codeBlock: false,
      link: false,
      // El lienzo dibuja las marcas con las mismas clases que el sitio (RF-026).
      underline: { HTMLAttributes: { class: CLASES_SUBRAYADO } },
    }),
    Enlace.configure({
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      isAllowedUri: esEnlacePermitido,
      HTMLAttributes: { class: CLASE_ENLACE, target: null, rel: null },
    }),
    Resaltado,
    Superindice,
    Subindice,
    Alineacion,
    ListaNumerada,
    BloqueDeCodigo,
    Cita,
    ItemDeLista,
    Tabla,
    TableRow,
    CeldaEncabezado,
    Celda,
    reglasDeTabla(devoluciones),
    atributosDelDocumento(devoluciones),
    Tipografia,
    ReglasDeTexto,
    AsignarIds,
    nodoEspecial('imagen'),
    nodoEspecial('galeria'),
    nodoEspecial('cta'),
    nodoEspecial('video'),
    Placeholder.configure({
      placeholder: ({ node, editor }: { node: { type: { name: string } }; editor: Editor }) =>
        node.type.name === 'paragraph' && editor.state.doc.childCount > 0 ? textoDeLineaVacia() : '',
      showOnlyCurrent: true,
    }),
    MarcasDeError,
    modoElementos(devoluciones),
    Extension.create({ name: 'proteger', addProseMirrorPlugins: () => [proteger(devoluciones.proteccion)] }),
    reglasDePegado(devoluciones),
    rastreadorDeLimites(devoluciones),
    menuBarra(devoluciones),
    anunciarAtajos(devoluciones),
  ];
}
