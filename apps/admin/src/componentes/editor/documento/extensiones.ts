// Esquema del documento y extensiones del editor (research D2 y D3 de la spec 005). El documento es una lista de
// elementos de primer nivel: cada uno es un bloque del contenido guardado. Lo que el sitio no sabe leer no existe
// en el esquema (sin tachado ni subrayado; títulos sin marcas; citas e ítems de un solo párrafo).
import {
  Extension,
  Mark,
  Node,
  markInputRule,
  mergeAttributes,
  wrappingInputRule,
  type AnyExtension,
  type Editor,
} from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey, Selection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  CLASES_CITA,
  CLASES_CITA_TEXTO,
  CLASES_CODIGO,
  CLASES_LISTA,
  CLASES_LISTA_NUMERADA,
  CLASES_LISTA_VINETAS,
  CLASES_PARRAFO,
  CLASES_SEPARADOR,
  CLASES_TITULO,
  CLASES_TITULO_POR_NIVEL,
} from '@blog/bloques/render';
import { Placeholder } from '@tiptap/extensions';
import { ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Suggestion from '@tiptap/suggestion';
import { detectarAtajo, nombreDeAtajo, puedeAbrirMenu } from './atajos';
import { asegurarIds } from './ids';
import { filtrarItems, type ItemDeInsercion } from './menu-insercion';
import { claveErrores, claveModo } from './claves';
import { ampliarSeleccion, duplicarRango, moverRango, quitarRango, rangoDeElementos, salirDelModo } from './comandos';
import { proteger, type DevolucionesDeProteccion } from './proteger';
import { NodoBloque } from './nodos/NodoBloque';

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
  'imagenBloque',
  'galeriaBloque',
  'ctaBloque',
  'videoBloque',
];

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
        { types: TIPOS_CON_ID, attributes: { bloqueId: { default: '', keepOnSplit: false, rendered: false } } },
        { types: ['paragraph'], attributes: { continuacion: { default: '', keepOnSplit: false, rendered: false } } },
        {
          types: ['blockquote'],
          attributes: { autor: { default: '', rendered: false }, fuente: { default: '', rendered: false } },
        },
        { types: ['codeBlock'], attributes: { lenguaje: { default: '', rendered: false } } },
      ];
    },
  });

/** Código en línea que admite negrita, cursiva y enlace adentro, como el sitio (la marca de la librería las excluye). */
const CodigoEnLinea = Mark.create({
  name: 'code',
  excludes: '',
  code: true,
  parseHTML: () => [{ tag: 'code' }],
  renderHTML: ({ HTMLAttributes }) => ['code', mergeAttributes(HTMLAttributes), 0],
  addCommands() {
    return {};
  },
  addKeyboardShortcuts() {
    return { 'Mod-e': () => this.editor.commands.toggleMark(this.name) };
  },
  addInputRules() {
    return [markInputRule({ find: /(^|[^`])`([^`]+)`(?!`)$/, type: this.type })];
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

/** Los títulos no llevan marcas ni saltos simples y las citas y los ítems no ofrecen saltos simples. */
const ReglasDeTexto = Extension.create({
  name: 'reglasDeTexto',
  priority: 1000,
  addKeyboardShortcuts() {
    const enTitulo = () => this.editor.state.selection.$from.parent.type.name === 'heading';
    const enCodigo = () => this.editor.state.selection.$from.parent.type.name === 'codeBlock';
    const sinSalto = () => {
      const { $from } = this.editor.state.selection;
      return [...Array($from.depth + 1).keys()].some((n) =>
        ['heading', 'blockquote', 'listItem'].includes($from.node(n).type.name),
      );
    };
    const sinMarcas = () => enTitulo() || enCodigo();
    return {
      'Shift-Enter': sinSalto,
      'Mod-Enter': sinSalto,
      'Mod-b': sinMarcas,
      'Mod-i': sinMarcas,
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
        key: new PluginKey('limpiarTitulos'),
        appendTransaction: (_transacciones, _antes, despues) => {
          if (!_transacciones.some((tr) => tr.docChanged)) return null;
          const tr = despues.tr;
          despues.doc.descendants((nodo, pos) => {
            if (nodo.type.name !== 'heading') return;
            nodo.descendants((hijo, relativa) => {
              const inicio = pos + 1 + relativa;
              if (hijo.type.name === 'hardBreak')
                tr.delete(tr.mapping.map(inicio), tr.mapping.map(inicio + hijo.nodeSize));
              else if (hijo.marks.length > 0)
                tr.removeMark(tr.mapping.map(inicio), tr.mapping.map(inicio + hijo.nodeSize));
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
      return CLASES_PARRAFO;
    case 'heading':
      return `${CLASES_TITULO} ${CLASES_TITULO_POR_NIVEL[nodo.attrs.level as 2 | 3 | 4] ?? ''}`;
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

/** Asigna el `bloqueId` de los elementos nuevos una sola vez y deduplica los repetidos (research D6 y D21). */
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
            if (
              atributos &&
              (atributos.bloqueId !== nodo.attrs.bloqueId || atributos.continuacion !== nodo.attrs.continuacion)
            ) {
              tr.setNodeMarkup(pos, undefined, { ...nodo.attrs, ...atributos });
            }
            pos += nodo.nodeSize;
          });
          return tr.docChanged ? tr.setMeta('addToHistory', false) : null;
        },
      }),
    ];
  },
});

/** Errores de validación por `bloqueId`: marcan el elemento en el lienzo, con texto, no solo con color. */

const MarcasDeError = Extension.create({
  name: 'marcasDeError',
  addProseMirrorPlugins() {
    return [
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
              const mensajes = errores.get(String(nodo.attrs.bloqueId));
              if (!mensajes) return;
              decoraciones.push(
                Decoration.node(
                  desplazamiento,
                  desplazamiento + nodo.nodeSize,
                  { class: 'rounded-md outline-2 outline-offset-4 outline-error', 'data-con-error': 'si' },
                  { errores: mensajes },
                ),
              );
            });
            return DecorationSet.create(estado.doc, decoraciones);
          },
        },
      }),
    ];
  },
});

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
    (comando: (estado: EditorState, despachar?: (tr: Transaction) => void) => boolean) =>
    ({ editor }: { editor: Editor }) =>
      comando(editor.state, (tr) => editor.view.dispatch(tr));
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
            handleKeyDown: (vista, evento) => {
              const { selection } = vista.state;
              const entero = selection instanceof NodeSelection && selection.$from.depth === 0;
              if (!entero || evento.key.length !== 1 || evento.ctrlKey || evento.metaKey || evento.altKey) return false;
              // Escribir sobre un elemento seleccionado lo reemplazaría: en el modo elementos se sale al texto; con un
              // elemento especial tocado, la tecla se ignora.
              if (claveModo.getState(vista.state) || !selection.node.isAtom) {
                const { doc, tr } = vista.state;
                vista.dispatch(
                  tr.setSelection(Selection.near(doc.resolve(selection.from + 1))).setMeta(claveModo, false),
                );
                return false;
              }
              return true;
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
            return true;
          }
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
          if (!claveModo.getState(editor.state)) return false;
          devoluciones.alPropiedades();
          return true;
        },
        'Alt-ArrowUp': sobreRango(moverRango(-1)),
        'Alt-ArrowDown': sobreRango(moverRango(1)),
        'Mod-d': sobreRango(duplicarRango()),
        Delete: sobreRango(quitarRango()),
        Backspace: sobreRango(quitarRango()),
        'Shift-ArrowUp': sobreRango(ampliarSeleccion(-1)),
        'Shift-ArrowDown': sobreRango(ampliarSeleccion(1)),
      };
    },
  });
}

function nodoEspecial(name: string) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: false,
    addAttributes() {
      return { bloque: { default: null, rendered: false } };
    },
    parseHTML: () => [],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-elemento': name })],
    addNodeView() {
      return ReactNodeViewRenderer(NodoBloque);
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

/** Texto de ayuda de la línea vacía: sin teclado físico la «/» suele estar en un segundo nivel. */
const textoDeLineaVacia = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    ? 'Escribe o usa Insertar'
    : 'Escribe o pulsa / para insertar';

export function crearExtensiones(devoluciones: DevolucionesDelEditor): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      blockquote: false,
      listItem: false,
      code: false,
      strike: false,
      underline: false,
      link: { openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: esEnlacePermitido },
    }),
    Cita,
    ItemDeLista,
    CodigoEnLinea,
    atributosDelDocumento(devoluciones),
    Tipografia,
    ReglasDeTexto,
    AsignarIds,
    nodoEspecial('imagenBloque'),
    nodoEspecial('galeriaBloque'),
    nodoEspecial('ctaBloque'),
    nodoEspecial('videoBloque'),
    Placeholder.configure({
      placeholder: ({ node, editor }: { node: { type: { name: string } }; editor: Editor }) =>
        node.type.name === 'paragraph' && editor.state.doc.childCount > 0 ? textoDeLineaVacia() : '',
      showOnlyCurrent: true,
    }),
    MarcasDeError,
    modoElementos(devoluciones),
    Extension.create({ name: 'proteger', addProseMirrorPlugins: () => [proteger(devoluciones.proteccion)] }),
    menuBarra(devoluciones),
    anunciarAtajos(devoluciones),
  ];
}
