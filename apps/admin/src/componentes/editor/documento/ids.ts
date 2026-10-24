// Identidad estable de los elementos del documento (research D6, D21 y D30 de la spec 005): cada elemento de primer
// nivel lleva un `id` que se asigna una sola vez y se deduplica.
import type { JSONContent } from '@tiptap/core';

const vacio = (valor: unknown) => valor === undefined || valor === null || valor === '';

/** Devuelve un documento nuevo donde ningún elemento de primer nivel tiene el `id` vacío o repetido. */
export function asegurarIds(doc: JSONContent): JSONContent {
  if (!doc.content) return doc;
  const usados = new Set<string>();
  const content = doc.content.map((nodo) => {
    const actual = nodo.attrs?.id;
    if (!vacio(actual) && !usados.has(String(actual))) {
      usados.add(String(actual));
      return nodo;
    }
    const id = crypto.randomUUID();
    usados.add(id);
    return { ...nodo, attrs: { ...nodo.attrs, id } };
  });
  return { ...doc, content };
}
