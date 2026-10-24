import type { core } from 'zod';
import { esquemaDocumento } from './esquema';

/**
 * Un error del documento: `indice` es la posición del elemento en `content` (−1 para lo que no es de un elemento,
 * como la imagen destacada), `id` su `attrs.id` y `campo` un nombre estable con los nombres de la spec 001.
 */
export type ErrorElemento = { indice: number; id: string; campo: string; mensaje: string };

const LISTAS = new Set(['bulletList', 'orderedList']);

/** Nombre estable del campo a partir de la ruta del problema dentro del elemento. */
function campoDe(tipo: unknown, ruta: PropertyKey[], codigo: core.$ZodIssue['code']): string {
  const [primero, segundo, ...resto] = ruta.map(String);
  if (primero === undefined) return codigo === 'invalid_union' ? 'tipo' : '';
  if (primero === 'type') return 'tipo';
  if (primero === 'attrs') {
    const campo = [segundo, ...resto].filter((parte) => parte !== undefined);
    if (campo[0] === 'level') campo[0] = 'nivel';
    return campo.join('.');
  }
  if (primero === 'content') {
    if (LISTAS.has(String(tipo))) return segundo === undefined ? 'items' : `items.${segundo}`;
    if (tipo === 'table') return 'tabla';
    return tipo === 'codeBlock' ? 'codigo' : 'texto';
  }
  return primero;
}

/**
 * Valida el documento sin lanzar ([] es válido). Con `publicar`, exige además contenido: lo mismo que
 * `privado.documento_tiene_contenido` en la base.
 */
export function validarDocumento(entrada: unknown, { publicar = false }: { publicar?: boolean } = {}): ErrorElemento[] {
  const resultado = esquemaDocumento.safeParse(entrada);
  const contenido: unknown[] = Array.isArray((entrada as { content?: unknown } | null)?.content)
    ? (entrada as { content: unknown[] }).content
    : [];
  const errores: ErrorElemento[] = (resultado.error?.issues ?? []).map((problema) => {
    const [raiz, indice, ...resto] = problema.path;
    if (raiz !== 'content' || typeof indice !== 'number') {
      return { indice: -1, id: '', campo: problema.path.map(String).join('.'), mensaje: problema.message };
    }
    const elemento = contenido[indice] as { type?: unknown; attrs?: { id?: unknown } } | null;
    const id = typeof elemento?.attrs?.id === 'string' ? elemento.attrs.id : '';
    return { indice, id, campo: campoDe(elemento?.type, resto, problema.code), mensaje: problema.message };
  });
  if (publicar && resultado.success && resultado.data.content.length === 0) {
    errores.push({ indice: -1, id: '', campo: 'contenido', mensaje: 'Agrega contenido antes de publicar' });
  }
  if (publicar) {
    contenido.forEach((elemento, indice) => {
      const el = elemento as { type?: unknown; attrs?: { id?: unknown }; content?: unknown[] } | null;
      if (el?.type === 'table') {
        const id = typeof el.attrs?.id === 'string' ? el.attrs.id : '';
        const filas = (el.content ?? []) as Array<{
          content?: Array<{ content?: Array<{ content?: Array<{ text?: string }> }> }>;
        }>;
        const tieneTexto = filas.some((fila) =>
          (fila.content ?? []).some((celda) =>
            (celda.content ?? []).some((parrafo) =>
              (parrafo.content ?? []).some((nodo) => typeof nodo.text === 'string' && nodo.text.trim().length > 0),
            ),
          ),
        );
        if (!tieneTexto) {
          errores.push({
            indice,
            id,
            campo: 'tabla',
            mensaje: 'La tabla no tiene contenido',
          });
        }
      }
    });
  }
  return errores;
}
