// Ayudas compartidas por comandos.test.ts y proteger.test.ts (spec 005, T062 y T063): constructores de documentos
// sobre el esquema REAL del editor. No es código de producción: solo lo importan las pruebas.
//
// T098 (ampliación, research D31 C7): ya no hay un esquema escrito a mano; el esquema sale de
// `getSchema(crearExtensiones(…))`, así las pruebas usan exactamente los nodos, marcas y atributos de la lista
// permitida (contracts/documento.md). Los constructores usan `id` (antes `bloqueId`) y los elementos especiales
// llevan sus campos como attrs planos: `imagen` con `attrs.imagen` y `galeria` con `attrs.imagenes` (D22).
//
// `claveModo` sale de `./claves`: el plugin del modo elementos tiene un booleano por estado y los comandos que entran
// o salen del modo lo fijan con `tr.setMeta(claveModo, true | false)`. Aquí se instala un plugin mínimo con esa clave
// para probar los comandos sin React ni DOM.
import { getSchema } from '@tiptap/core';
import { history } from '@tiptap/pm/history';
import type { Node as NodoPm, NodeType } from '@tiptap/pm/model';
import { EditorState, Plugin } from '@tiptap/pm/state';
import { claveModo } from './claves';
import { crearExtensiones, type DevolucionesDelEditor } from './extensiones';

const sinEfecto = () => undefined;
/** Devoluciones que el esquema no usa: alcanzan para armarlo sin interfaz. */
const devolucionesDePrueba = {
  salioDelModo: sinEfecto,
  cerrarHojaPendiente: () => false,
  proteccion: {},
  anunciar: sinEfecto,
  menuAbierto: () => false,
  alPropiedades: sinEfecto,
  alMenu: sinEfecto,
  alTeclearMenu: () => false,
  alConvertir: sinEfecto,
} as unknown as DevolucionesDelEditor;

/** El esquema de ProseMirror del editor. */
const esquema = getSchema(crearExtensiones(devolucionesDePrueba));

/** El tipo de nodo, o un error claro si el esquema todavía no lo tiene (fase roja). */
function tipo(nombre: string): NodeType {
  const encontrado = esquema.nodes[nombre];
  if (!encontrado) throw new Error(`El esquema del editor no tiene el nodo "${nombre}"`);
  return encontrado;
}

type Hijos = string | NodoPm | (string | NodoPm)[];
const contenido = (hijos: Hijos | undefined): NodoPm[] =>
  [hijos ?? []]
    .flat()
    .map((h) => (typeof h === 'string' ? (h ? esquema.text(h) : []) : h))
    .flat() as NodoPm[];

const imagenDePrueba = (ruta: string) => ({ ruta, ancho: 4, alto: 3, alt: 'Imagen de prueba', decorativa: false });

export const parrafo = (id: string, texto: Hijos = '') => tipo('paragraph').create({ id }, contenido(texto));
export const parrafoConNegrita = (id: string, texto: string) =>
  tipo('paragraph').create({ id }, esquema.text(texto, [esquema.marks.bold!.create()]));
export const titulo = (id: string, texto: string, level = 2) => tipo('heading').create({ id, level }, contenido(texto));

/** Fase 12 (RF-024): el nodo con `textAlign`, o un error claro si el esquema todavía no tiene el atributo (fase roja). */
function conAlineacion(nombre: 'paragraph' | 'heading', attrs: Record<string, unknown>, hijos: NodoPm[]) {
  if (!tipo(nombre).spec.attrs || !('textAlign' in (tipo(nombre).spec.attrs ?? {}))) {
    throw new Error(`El esquema del editor no tiene el atributo textAlign en "${nombre}"`);
  }
  return tipo(nombre).create(attrs, hijos);
}
export const parrafoAlineado = (id: string, texto: string, textAlign: 'center' | 'right' | 'justify') =>
  conAlineacion('paragraph', { id, textAlign }, contenido(texto));
export const tituloAlineado = (id: string, texto: string, textAlign: 'center' | 'right' | 'justify', level = 2) =>
  conAlineacion('heading', { id, level, textAlign }, contenido(texto));
/** Un autor o una fuente vacíos son la ausencia del atributo (forma canónica, D24). */
export const cita = (id: string, texto: string, autor = '', fuente = '') =>
  tipo('blockquote').create(
    { id, ...(autor ? { autor } : {}), ...(fuente ? { fuente } : {}) },
    tipo('paragraph').create(null, contenido(texto)),
  );
export const lista = (id: string, items: string[], ordenada = false) =>
  tipo(ordenada ? 'orderedList' : 'bulletList').create(
    { id },
    items.map((item) => tipo('listItem').create(null, tipo('paragraph').create(null, contenido(item)))),
  );
export const separador = (id: string) => tipo('horizontalRule').create({ id });
export const imagen = (id: string, ruta: string) => tipo('imagen').create({ id, imagen: imagenDePrueba(ruta) });
export const galeria = (id: string, rutas: string[]) =>
  tipo('galeria').create({ id, columnas: 2, imagenes: rutas.map(imagenDePrueba) });

/** Plugin mínimo con la clave del modo elementos (ver arriba). */
const pluginDeModo = () =>
  new Plugin({
    key: claveModo,
    state: { init: () => false, apply: (tr, anterior) => tr.getMeta(claveModo) ?? anterior },
  });

/** Estado con el modo elementos instalado y el historial (para comprobar que un Deshacer revierte una acción). */
export const estadoDe = (...elementos: NodoPm[]) =>
  EditorState.create({ doc: tipo('doc').create(null, elementos), plugins: [pluginDeModo(), history()] });

/** Posición (antes del nodo) del elemento de primer nivel `indice` (desde 0). */
export function posDe(estado: EditorState, indice: number) {
  let pos = 0;
  for (let i = 0; i < indice; i++) pos += estado.doc.child(i).nodeSize;
  return pos;
}

/** Ids de los elementos de primer nivel, en orden (`''` para los que todavía no tienen). */
export const idsDe = (estado: EditorState) =>
  Array.from({ length: estado.doc.childCount }, (_, i) => String(estado.doc.child(i).attrs.id ?? ''));
