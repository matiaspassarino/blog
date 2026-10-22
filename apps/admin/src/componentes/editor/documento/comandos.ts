// Comandos del documento que no son de la librería (contracts/componentes.md). Cada uno es una sola transacción:
// un Deshacer la revierte. El nodo se busca por `bloqueId` al aplicar, no por la selección.
import type { Bloque, TipoBloque } from '@blog/bloques';
import type { Editor } from '@tiptap/core';
import { Fragment, type Node as NodoPm } from '@tiptap/pm/model';
import { NodeSelection, Selection, SelectionRange, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { Mappable } from '@tiptap/pm/transform';
import type { CambiosDeBloque } from '../bloques/tipos';
import { claveModo } from './claves';
import { documentoABloques, type NodoDocumento } from './conversion';

export type ElementoDelDocumento = { nodo: NodoPm; pos: number; posicion: number };

/** El elemento de primer nivel con ese `bloqueId` (el primero: los tramos de un párrafo comparten id). */
export function buscarElemento(editor: Editor, bloqueId: string): ElementoDelDocumento | null {
  let encontrado: ElementoDelDocumento | null = null;
  editor.state.doc.forEach((nodo, pos, indice) => {
    if (!encontrado && nodo.attrs.bloqueId === bloqueId) encontrado = { nodo, pos, posicion: indice + 1 };
  });
  return encontrado;
}

/** El bloque que representa un elemento de primer nivel (sin id no se puede convertir). */
export function bloqueDeElemento(nodo: NodoPm): Bloque | undefined {
  return documentoABloques({ type: 'doc', content: [nodo.toJSON() as NodoDocumento] })[0];
}

/** Mezcla `cambios` en el bloque del elemento y vuelve a escribir sus atributos. Devuelve `false` si no lo encuentra. */
export function actualizarBloque(editor: Editor, bloqueId: string, cambios: CambiosDeBloque): boolean {
  const elemento = buscarElemento(editor, bloqueId);
  const actual = elemento && bloqueDeElemento(elemento.nodo);
  if (!elemento || !actual) return false;
  const nuevo = { ...actual, ...(typeof cambios === 'function' ? cambios(actual) : cambios), id: actual.id } as Bloque;
  const { nodo, pos } = elemento;
  const { schema } = editor.state;
  const tr = editor.state.tr;

  switch (nuevo.tipo) {
    case 'imagen':
    case 'galeria':
    case 'cta':
    case 'video':
      tr.setNodeMarkup(pos, undefined, { ...nodo.attrs, bloque: nuevo });
      break;
    case 'titulo':
      tr.setNodeMarkup(pos, undefined, { ...nodo.attrs, level: nuevo.nivel });
      break;
    case 'cita':
      tr.setNodeMarkup(pos, undefined, { ...nodo.attrs, autor: nuevo.autor ?? '', fuente: nuevo.fuente ?? '' });
      break;
    case 'codigo':
      tr.setNodeMarkup(pos, undefined, { ...nodo.attrs, lenguaje: nuevo.lenguaje ?? '' });
      break;
    case 'lista': {
      const tipo = schema.nodes[nuevo.ordenada ? 'orderedList' : 'bulletList'];
      if (tipo) tr.setNodeMarkup(pos, tipo, nodo.attrs);
      break;
    }
    default:
      return false;
  }
  editor.view.dispatch(tr);
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Modo elementos: comandos sobre uno o varios elementos de primer nivel seleccionados enteros (contracts/atajos.md)

/** Varios elementos contiguos seleccionados enteros (con uno solo se usa `NodeSelection`). */
export class SeleccionDeElementos extends Selection {
  constructor(doc: NodoPm, desde: number, hasta: number) {
    const $desde = doc.resolve(desde);
    const $hasta = doc.resolve(hasta);
    super($desde, $hasta, [new SelectionRange($desde, $hasta)]);
  }

  override visible = false;

  map(doc: NodoPm, mapping: Mappable): Selection {
    const desde = mapping.map(this.from, 1);
    const hasta = mapping.map(this.to, -1);
    return desde < hasta ? new SeleccionDeElementos(doc, desde, hasta) : Selection.near(doc.resolve(desde));
  }

  content() {
    return this.$from.doc.slice(this.from, this.to, true);
  }

  eq(otra: Selection) {
    return otra instanceof SeleccionDeElementos && otra.from === this.from && otra.to === this.to;
  }

  toJSON() {
    return { type: 'elementos', desde: this.from, hasta: this.to };
  }
}

export type TipoDeTexto = 'parrafo' | 'titulo' | 'cita' | 'lista' | 'codigo';
type Comando = (estado: EditorState, despachar?: (tr: Transaction) => void) => boolean;

/** Selección de los elementos entre `desde` y `hasta` (posiciones de primer nivel), en modo elementos. */
function seleccionarRango(tr: Transaction, desde: number, hasta: number): Transaction {
  const unico = tr.doc.resolve(desde).nodeAfter;
  const seleccion =
    unico && desde + unico.nodeSize === hasta
      ? NodeSelection.create(tr.doc, desde)
      : new SeleccionDeElementos(tr.doc, desde, hasta);
  return tr.setSelection(seleccion).setMeta(claveModo, true).scrollIntoView();
}

/** Las posiciones que abarcan los elementos seleccionados, o `null` fuera del modo elementos. */
export function rangoDeElementos(estado: EditorState): { desde: number; hasta: number } | null {
  if (!claveModo.getState(estado)) return null;
  const { selection } = estado;
  const entero =
    selection instanceof SeleccionDeElementos || (selection instanceof NodeSelection && selection.$from.depth === 0);
  return entero ? { desde: selection.from, hasta: selection.to } : null;
}

/** Entra al modo elementos con los elementos `desdeIndice..hastaIndice` (desde 0). */
export const seleccionarElementos =
  (desdeIndice: number, hastaIndice: number): Comando =>
  (estado, despachar) => {
    const { doc } = estado;
    if (desdeIndice < 0 || hastaIndice < desdeIndice || hastaIndice >= doc.childCount) return false;
    let desde = 0;
    let hasta = 0;
    doc.forEach((nodo, pos, indice) => {
      if (indice === desdeIndice) desde = pos;
      if (indice === hastaIndice) hasta = pos + nodo.nodeSize;
    });
    despachar?.(seleccionarRango(estado.tr, desde, hasta));
    return true;
  };

/** El elemento contiguo en esa dirección, si hay. */
const vecinoDe = (estado: EditorState, rango: { desde: number; hasta: number }, direccion: -1 | 1) =>
  direccion === 1 ? estado.doc.resolve(rango.hasta).nodeAfter : estado.doc.resolve(rango.desde).nodeBefore;

/** `Shift+↑` y `Shift+↓`: suma el elemento contiguo a la selección. */
export const ampliarSeleccion =
  (direccion: -1 | 1): Comando =>
  (estado, despachar) => {
    const rango = rangoDeElementos(estado);
    const vecino = rango && vecinoDe(estado, rango, direccion);
    if (!rango || !vecino) return false;
    const desde = direccion === 1 ? rango.desde : rango.desde - vecino.nodeSize;
    const hasta = direccion === 1 ? rango.hasta + vecino.nodeSize : rango.hasta;
    despachar?.(seleccionarRango(estado.tr, desde, hasta));
    return true;
  };

/** `Alt+↑` y `Alt+↓`: el conjunto sube o baja un lugar, en una sola transacción. */
export const moverRango =
  (direccion: -1 | 1): Comando =>
  (estado, despachar) => {
    const rango = rangoDeElementos(estado);
    const vecino = rango && vecinoDe(estado, rango, direccion);
    if (!rango || !vecino) return false;
    if (despachar) {
      const contenido = estado.doc.slice(rango.desde, rango.hasta).content;
      const tr = estado.tr.delete(rango.desde, rango.hasta);
      const destino = direccion === 1 ? rango.desde + vecino.nodeSize : rango.desde - vecino.nodeSize;
      tr.insert(destino, contenido);
      despachar(seleccionarRango(tr, destino, destino + (rango.hasta - rango.desde)));
    }
    return true;
  };

/** Una copia sin identidad: el `bloqueId` se completa al serializar (y `continuacion` no se hereda). */
function copiar(nodo: NodoPm): NodoPm {
  const atributos: Record<string, unknown> = { ...nodo.attrs, bloqueId: '' };
  if ('continuacion' in atributos) atributos.continuacion = '';
  return nodo.type.create(atributos, nodo.content, nodo.marks);
}

/** `Mod+D`: copia el conjunto justo debajo y deja la selección en las copias. */
export const duplicarRango = (): Comando => (estado, despachar) => {
  const rango = rangoDeElementos(estado);
  if (!rango) return false;
  if (despachar) {
    const copias: NodoPm[] = [];
    estado.doc.slice(rango.desde, rango.hasta).content.forEach((nodo) => copias.push(copiar(nodo)));
    const tr = estado.tr.insert(rango.hasta, copias);
    despachar(seleccionarRango(tr, rango.hasta, rango.hasta + (rango.hasta - rango.desde)));
  }
  return true;
};

/** `Supr`/`Retroceso`: quita el conjunto, sale del modo y deja el cursor en el elemento contiguo. */
export const quitarRango = (): Comando => (estado, despachar) => {
  const rango = rangoDeElementos(estado);
  if (!rango) return false;
  if (despachar) {
    const tr = estado.tr.delete(rango.desde, rango.hasta);
    if (tr.doc.childCount === 0) tr.insert(0, estado.schema.nodes.paragraph!.create({ bloqueId: '' }));
    const destino = Math.min(rango.desde, tr.doc.content.size);
    const siguiente = Selection.near(tr.doc.resolve(destino), 1);
    const contiguo = destino < tr.doc.content.size ? siguiente : Selection.near(tr.doc.resolve(destino), -1);
    despachar(tr.setSelection(contiguo).setMeta(claveModo, false).scrollIntoView());
  }
  return true;
};

const TIPOS_DE_TEXTO = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'codeBlock'];

/** Texto en línea (con sus marcas) del elemento, para pasarlo a otro tipo. */
function contenidoEnLinea(nodo: NodoPm): Fragment {
  if (nodo.type.name === 'blockquote') return nodo.firstChild?.content ?? Fragment.empty;
  if (nodo.type.name === 'bulletList' || nodo.type.name === 'orderedList') {
    return nodo.firstChild?.firstChild?.content ?? Fragment.empty;
  }
  return nodo.content;
}

const textoPlano = (contenido: Fragment) => contenido.textBetween(0, contenido.size, '');

/** El único elemento de texto seleccionado en modo elementos, o `null`. */
function elementoDeTexto(estado: EditorState): { nodo: NodoPm; pos: number } | null {
  const rango = rangoDeElementos(estado);
  const nodo = rango ? estado.doc.resolve(rango.desde).nodeAfter : null;
  if (!rango || !nodo || rango.desde + nodo.nodeSize !== rango.hasta) return null;
  return TIPOS_DE_TEXTO.includes(nodo.type.name) ? { nodo, pos: rango.desde } : null;
}

const hayMarcas = (contenido: Fragment) => {
  let marcas = false;
  contenido.forEach((hijo) => {
    if (hijo.marks.length > 0) marcas = true;
  });
  return marcas;
};

/** Lo que se perdería al convertir (RF-016): la interfaz lo muestra y pide confirmar antes de despachar. */
export function pierdeAlConvertir(
  estado: EditorState,
  tipo: TipoDeTexto,
  _opciones?: { nivel?: 2 | 3 | 4 },
): { pierde: string[] } {
  const pierde: string[] = [];
  const elemento = elementoDeTexto(estado);
  if (!elemento) return { pierde };
  const { nodo } = elemento;
  const esLista = nodo.type.name === 'bulletList' || nodo.type.name === 'orderedList';
  if (esLista && nodo.childCount > 1 && tipo !== 'lista') {
    pierde.push('los ítems de la lista (solo se conserva el primero)');
  }
  if (nodo.type.name === 'blockquote' && tipo !== 'cita') {
    if (nodo.attrs.autor) pierde.push('el autor de la cita');
    if (nodo.attrs.fuente) pierde.push('la fuente de la cita');
  }
  if ((tipo === 'titulo' || tipo === 'codigo') && hayMarcas(contenidoEnLinea(nodo))) {
    pierde.push('el formato del texto (negrita, cursiva, código y enlaces)');
  }
  return { pierde };
}

/** «Convertir en…»: cambia el tipo de UN elemento de texto conservando el texto y el identificador. */
export const convertirElemento =
  (tipo: TipoDeTexto, opciones: { nivel?: 2 | 3 | 4 } = {}): Comando =>
  (estado, despachar) => {
    const elemento = elementoDeTexto(estado);
    if (!elemento) return false;
    if (despachar) {
      const { nodo, pos } = elemento;
      const { nodes, text } = { nodes: estado.schema.nodes, text: (t: string) => estado.schema.text(t) };
      const enLinea = contenidoEnLinea(nodo);
      const plano = textoPlano(enLinea);
      const soloTexto = plano ? Fragment.from(text(plano)) : Fragment.empty;
      const bloqueId = nodo.attrs.bloqueId ?? '';
      const interno = nodes.paragraph!.create({}, enLinea);
      const nuevo = {
        parrafo: () => nodes.paragraph!.create({ bloqueId, continuacion: '' }, enLinea),
        titulo: () => nodes.heading!.create({ bloqueId, level: opciones.nivel ?? 2 }, soloTexto),
        cita: () =>
          nodes.blockquote!.create(
            { bloqueId, autor: nodo.attrs.autor ?? '', fuente: nodo.attrs.fuente ?? '' },
            interno,
          ),
        lista: () => nodes.bulletList!.create({ bloqueId }, nodes.listItem!.create(null, interno)),
        codigo: () => nodes.codeBlock!.create({ bloqueId, lenguaje: '' }, soloTexto),
      }[tipo]();
      const tr = estado.tr.replaceWith(pos, pos + nodo.nodeSize, nuevo);
      despachar(seleccionarRango(tr, pos, pos + nuevo.nodeSize));
    }
    return true;
  };

// ---------------------------------------------------------------------------------------------------------------
// Elemento activo: el de primer nivel donde está el cursor o que está seleccionado entero

const TIPO_DE_NODO: Record<string, TipoBloque> = {
  paragraph: 'parrafo',
  heading: 'titulo',
  blockquote: 'cita',
  bulletList: 'lista',
  orderedList: 'lista',
  codeBlock: 'codigo',
  horizontalRule: 'separador',
  imagenBloque: 'imagen',
  galeriaBloque: 'galeria',
  ctaBloque: 'cta',
  videoBloque: 'video',
};

/** El tipo de bloque que representa un elemento de primer nivel. */
export const tipoDeElemento = (nodo: NodoPm): TipoBloque | undefined => TIPO_DE_NODO[nodo.type.name];

export type ElementoActivoDelEstado = { posicion: number; total: number; tipo: TipoBloque; pos: number; nodo: NodoPm };

/** El elemento de primer nivel del cursor (o el primero de los seleccionados). El párrafo vacío final no cuenta en el total. */
export function elementoActivo(estado: EditorState): ElementoActivoDelEstado | null {
  const { selection, doc } = estado;
  const entero = selection instanceof NodeSelection || selection instanceof SeleccionDeElementos;
  const indice = entero
    ? doc.resolve(selection.from).index(0)
    : selection.$from.depth > 0
      ? selection.$from.index(0)
      : -1;
  if (indice < 0 || indice >= doc.childCount) return null;
  const nodo = doc.child(indice);
  const tipo = TIPO_DE_NODO[nodo.type.name];
  if (!tipo) return null;
  const ultimo = doc.lastChild;
  const sobrante = doc.childCount > 1 && ultimo?.type.name === 'paragraph' && ultimo.content.size === 0 ? 1 : 0;
  let pos = 0;
  for (let i = 0; i < indice; i++) pos += doc.child(i).nodeSize;
  return { posicion: indice + 1, total: doc.childCount - sobrante, tipo, pos, nodo };
}

/** Entra al modo elementos con el elemento activo (como `Esc`); si ya está en el modo, no hace nada. */
export const seleccionarElementoActivo = (): Comando => (estado, despachar) => {
  if (rangoDeElementos(estado)) return true;
  const activo = elementoActivo(estado);
  if (!activo) return false;
  despachar?.(seleccionarRango(estado.tr, activo.pos, activo.pos + activo.nodo.nodeSize));
  return true;
};

/**
 * Arrastre del asa: mueve los elementos `desde..hasta` (índices, desde 0) a la ranura `ranura` (0 = antes del primero,
 * n = después del último, contada sobre el documento de partida). Es una sola transacción.
 */
export const moverElementosA =
  (desde: number, hasta: number, ranura: number): Comando =>
  (estado, despachar) => {
    const { doc } = estado;
    const cantidad = hasta - desde + 1;
    if (desde < 0 || hasta < desde || hasta >= doc.childCount || ranura < 0 || ranura > doc.childCount) return false;
    if (ranura >= desde && ranura <= hasta + 1) return false; // no cambia de lugar
    if (despachar) {
      const inicios: number[] = [];
      let pos = 0;
      doc.forEach((nodo) => {
        inicios.push(pos);
        pos += nodo.nodeSize;
      });
      const fin = hasta + 1 < doc.childCount ? inicios[hasta + 1]! : doc.content.size;
      const contenido = doc.slice(inicios[desde]!, fin).content;
      const tr = estado.tr.delete(inicios[desde]!, fin);
      // En el documento sin los elementos movidos, la ranura queda `cantidad` lugares antes si estaba después.
      const nueva = ranura > hasta ? ranura - cantidad : ranura;
      let destino = 0;
      for (let i = 0; i < nueva; i++) destino += tr.doc.child(i).nodeSize;
      tr.insert(destino, contenido);
      despachar(seleccionarRango(tr, destino, destino + (fin - inicios[desde]!)));
    }
    return true;
  };

/** Sale del modo elementos: el cursor queda dentro del elemento (o en el texto contiguo, si es un elemento especial). */
export const salirDelModo = (): Comando => (estado, despachar) => {
  const rango = rangoDeElementos(estado);
  if (!rango) return false;
  if (despachar) {
    const { doc } = estado;
    const primero = doc.resolve(rango.desde).nodeAfter;
    const destino =
      !primero || primero.isAtom
        ? Selection.near(doc.resolve(rango.hasta), 1)
        : Selection.near(doc.resolve(rango.desde + 1));
    despachar(estado.tr.setSelection(destino).setMeta(claveModo, false));
  }
  return true;
};

/**
 * El navegador puede mover el cursor un instante antes de que ProseMirror lo sepa (un clic y enseguida un botón):
 * antes de actuar sobre «el elemento del cursor» se lee la selección del DOM.
 */
export function sincronizarConElDom(editor: Editor) {
  const dom = window.getSelection();
  if (!dom?.anchorNode || !editor.view.dom.contains(dom.anchorNode)) return;
  try {
    const pos = editor.view.posAtDOM(dom.anchorNode, dom.anchorOffset);
    const { selection, doc } = editor.state;
    if (selection instanceof NodeSelection || selection instanceof SeleccionDeElementos) return;
    if (pos !== selection.anchor) editor.view.dispatch(editor.state.tr.setSelection(Selection.near(doc.resolve(pos))));
  } catch {
    // posición fuera del documento: se conserva la selección del estado
  }
}
