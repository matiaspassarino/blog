// Identidad estable de los elementos del documento (research D6 y D21 de la spec 005): cada elemento de primer nivel
// lleva el `id` del bloque que representa. Se asigna una sola vez y se deduplica; así `documentoABloques` es pura.
import type { NodoDocumento } from './conversion';

const vacio = (valor: unknown) => valor === undefined || valor === null || valor === '';

/**
 * Devuelve un documento nuevo donde ningún elemento de primer nivel tiene el `bloqueId` vacío o repetido.
 * Los párrafos con `continuacion` comparten, a propósito, el id del párrafo anterior; todo lo demás es único.
 * Un elemento que recibe id nuevo es un elemento nuevo: no conserva `continuacion`.
 */
export function asegurarIds(doc: NodoDocumento): NodoDocumento {
  if (!doc.content) return doc;
  const usados = new Set<string>();
  let anterior: string | undefined;

  const content = doc.content.map((nodo) => {
    const actual = nodo.attrs?.bloqueId;
    const conContinuacion = nodo.type === 'paragraph' && !vacio(nodo.attrs?.continuacion);
    const esPar = conContinuacion && typeof actual === 'string' && actual === anterior;

    if (!vacio(actual) && (esPar || !usados.has(String(actual)))) {
      usados.add(String(actual));
      anterior = String(actual);
      return nodo;
    }

    const id = crypto.randomUUID();
    usados.add(id);
    anterior = id;
    const { continuacion, ...resto } = nodo.attrs ?? {};
    const atributos = nodo.type === 'paragraph' && !vacio(continuacion) ? { ...resto, continuacion: '' } : resto;
    return { ...nodo, attrs: { ...atributos, bloqueId: id } };
  });

  return { ...doc, content };
}
