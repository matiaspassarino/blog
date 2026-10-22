// Ayudas compartidas por comandos.test.ts y proteger.test.ts (spec 005, T062 y T063): un esquema mínimo de
// ProseMirror con la misma forma que el del editor (contracts/documento.md) y constructores de documentos.
// No es código de producción: solo lo importan las pruebas.
//
// SUPUESTO (T065): `claveModo` se exporta desde `./claves` (hoy vive privada en extensiones.ts). Es la clave del
// plugin del modo elementos: su estado es un booleano y los comandos que entran o salen del modo lo fijan con
// `tr.setMeta(claveModo, true | false)`. Aquí se instala un plugin mínimo con esa clave para poder probar los
// comandos sin React ni DOM.
import { history } from '@tiptap/pm/history';
import { Schema, type Node as NodoPm } from '@tiptap/pm/model';
import { EditorState, Plugin } from '@tiptap/pm/state';
import { claveModo } from './claves';

export const esquema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    text: { group: 'inline' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      marks: 'bold',
      attrs: { bloqueId: { default: '' }, continuacion: { default: '' } },
      toDOM: () => ['p', 0],
    },
    heading: {
      group: 'block',
      content: 'inline*',
      marks: '',
      attrs: { bloqueId: { default: '' }, level: { default: 2 } },
      toDOM: (nodo) => [`h${nodo.attrs.level}`, 0],
    },
    blockquote: {
      group: 'block',
      content: 'paragraph',
      attrs: { bloqueId: { default: '' }, autor: { default: '' }, fuente: { default: '' } },
      toDOM: () => ['blockquote', 0],
    },
    bulletList: { group: 'block', content: 'listItem+', attrs: { bloqueId: { default: '' } }, toDOM: () => ['ul', 0] },
    orderedList: { group: 'block', content: 'listItem+', attrs: { bloqueId: { default: '' } }, toDOM: () => ['ol', 0] },
    listItem: { content: 'paragraph', toDOM: () => ['li', 0] },
    codeBlock: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      attrs: { bloqueId: { default: '' }, lenguaje: { default: '' } },
      toDOM: () => ['pre', ['code', 0]],
    },
    horizontalRule: { group: 'block', attrs: { bloqueId: { default: '' } }, toDOM: () => ['hr'] },
    imagenBloque: {
      group: 'block',
      atom: true,
      selectable: true,
      attrs: { bloqueId: { default: '' }, bloque: { default: null } },
      toDOM: () => ['div', { 'data-elemento': 'imagenBloque' }],
    },
    galeriaBloque: {
      group: 'block',
      atom: true,
      selectable: true,
      attrs: { bloqueId: { default: '' }, bloque: { default: null } },
      toDOM: () => ['div', { 'data-elemento': 'galeriaBloque' }],
    },
  },
  marks: { bold: { toDOM: () => ['strong', 0] } },
});

type Hijos = string | NodoPm | (string | NodoPm)[];
const contenido = (hijos: Hijos | undefined): NodoPm[] =>
  [hijos ?? []]
    .flat()
    .map((h) => (typeof h === 'string' ? (h ? esquema.text(h) : []) : h))
    .flat() as NodoPm[];

export const parrafo = (bloqueId: string, texto: Hijos = '') =>
  esquema.nodes.paragraph!.create({ bloqueId }, contenido(texto));
export const parrafoConNegrita = (bloqueId: string, texto: string) =>
  esquema.nodes.paragraph!.create({ bloqueId }, esquema.text(texto, [esquema.marks.bold!.create()]));
export const titulo = (bloqueId: string, texto: string, level = 2) =>
  esquema.nodes.heading!.create({ bloqueId, level }, contenido(texto));
export const cita = (bloqueId: string, texto: string, autor = '', fuente = '') =>
  esquema.nodes.blockquote!.create({ bloqueId, autor, fuente }, parrafo('', texto));
export const lista = (bloqueId: string, items: string[], ordenada = false) =>
  esquema.nodes[ordenada ? 'orderedList' : 'bulletList']!.create(
    { bloqueId },
    items.map((item) => esquema.nodes.listItem!.create(null, parrafo('', item))),
  );
export const codigo = (bloqueId: string, texto: string) =>
  esquema.nodes.codeBlock!.create({ bloqueId }, contenido(texto));
export const separador = (bloqueId: string) => esquema.nodes.horizontalRule!.create({ bloqueId });
export const imagen = (bloqueId: string, ruta: string) =>
  esquema.nodes.imagenBloque!.create({
    bloqueId,
    bloque: {
      id: bloqueId,
      tipo: 'imagen',
      imagen: { ruta, ancho: 4, alto: 3, alt: 'Imagen de prueba', decorativa: false },
    },
  });
export const galeria = (bloqueId: string, rutas: string[]) =>
  esquema.nodes.galeriaBloque!.create({
    bloqueId,
    bloque: {
      id: bloqueId,
      tipo: 'galeria',
      columnas: 2,
      imagenes: rutas.map((ruta) => ({ ruta, ancho: 4, alto: 3, alt: 'Imagen de prueba', decorativa: false })),
    },
  });

/** Plugin mínimo con la clave del modo elementos (ver el supuesto de arriba). */
const pluginDeModo = () =>
  new Plugin({
    key: claveModo,
    state: { init: () => false, apply: (tr, anterior) => tr.getMeta(claveModo) ?? anterior },
  });

/** Estado con el modo elementos instalado y el historial (para comprobar que un Deshacer revierte una acción). */
export const estadoDe = (...elementos: NodoPm[]) =>
  EditorState.create({ doc: esquema.node('doc', null, elementos), plugins: [pluginDeModo(), history()] });

/** Posición (antes del nodo) del elemento de primer nivel `indice` (desde 0). */
export function posDe(estado: EditorState, indice: number) {
  let pos = 0;
  for (let i = 0; i < indice; i++) pos += estado.doc.child(i).nodeSize;
  return pos;
}

/** Ids de los elementos de primer nivel, en orden (`''` para los que todavía no tienen). */
export const idsDe = (estado: EditorState) =>
  Array.from({ length: estado.doc.childCount }, (_, i) => String(estado.doc.child(i).attrs.bloqueId ?? ''));
