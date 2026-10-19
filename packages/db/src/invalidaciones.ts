// Aviso de cambio público y lo que invalida en el sitio (specs/002-sitio-publico/contracts/cache.md;
// research D1–D4). Una sola fuente para el contrato, el tipo y la validación. Reemplaza a
// rutasAfectadas: con tags no hace falta enumerar páginas.
import { z } from 'zod';
import { ErrorDominio } from './errores';
import { TAG_ARTICULOS, tagArticulo, tagAutor, tagCategoria, tagEtiqueta } from './tags';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

/** No estricto: la base puede agregar campos sin romper el sitio. */
export const esquemaCambioPublico = z.object({
  tipo: z.enum(['articulo', 'categoria', 'etiqueta', 'autor']),
  id: z.uuid(),
  slugs: z.array(slug).min(1).max(50),
  // Se aceptan y no se usan: con tags, la categoría y las etiquetas ya están en las páginas (D1).
  categorias: z.array(z.string()).optional(),
  etiquetas: z.array(z.string()).optional(),
  // La base manda now() como jsonb (con offset, por ejemplo +00:00).
  ocurrido_en: z.iso.datetime({ offset: true }),
});

export type CambioPublico = z.infer<typeof esquemaCambioPublico>;

/** Valida el JSON ya parseado del aviso; si no cumple el contrato, ErrorDominio('validacion'). */
export function leerCambioPublico(json: unknown): CambioPublico {
  const resultado = esquemaCambioPublico.safeParse(json);
  if (!resultado.success) {
    throw new ErrorDominio('validacion', 'El aviso de cambio no cumple el contrato', { cause: resultado.error });
  }
  return resultado.data;
}

const TAG_DE = { articulo: tagArticulo, categoria: tagCategoria, etiqueta: tagEtiqueta, autor: tagAutor };
const PREFIJO_DE = { articulo: '/blog/', categoria: '/blog/categoria/', etiqueta: '/blog/etiqueta/' };

/**
 * Tags y rutas a invalidar, sin repetidos y en orden estable. Las rutas son las de los slugs
 * (el actual deja de ser 404; el anterior pasa a 301). El slug de autor es inmutable: sin rutas.
 */
export function invalidacionesDe(cambio: CambioPublico): { tags: string[]; rutas: string[] } {
  const tags = [TAG_ARTICULOS, TAG_DE[cambio.tipo](cambio.id)];
  if (cambio.tipo === 'autor') return { tags, rutas: [] };
  const prefijo = PREFIJO_DE[cambio.tipo];
  return { tags, rutas: [...new Set(cambio.slugs)].map((s) => `${prefijo}${s}`) };
}
