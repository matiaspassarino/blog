// Comandos del documento que no son de la librería (contracts/componentes.md). Cada uno es una sola transacción:
// un Deshacer la revierte. El nodo se busca por `bloqueId` al aplicar, no por la selección.
import type { Bloque } from '@blog/bloques';
import type { Editor } from '@tiptap/core';
import type { Node as NodoPm } from '@tiptap/pm/model';
import type { CambiosDeBloque } from '../bloques/tipos';
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
