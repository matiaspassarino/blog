// Política de caché de cada tipo de página (specs/002-sitio-publico/contracts/cache.md y
// research D2). Fuente única: ninguna página escribe tags a mano.
import {
  TAG_ARTICULOS,
  tagArticulo,
  tagAutor,
  tagCategoria,
  tagEtiqueta,
  type ArticuloPublico,
  type ResumenArticulo,
} from '@blog/db';
import type { CacheOptions } from 'astro';

const UN_ANIO = 31_536_000;
const SWR = 60;

/** Tags del artículo, su categoría, sus etiquetas, su autor y sus relacionados (H4-E6). */
export function cacheArticulo(articulo: ArticuloPublico, relacionados: ResumenArticulo[]): CacheOptions {
  const tags = new Set<string>([tagArticulo(articulo.id)]);
  if (articulo.categoria) tags.add(tagCategoria(articulo.categoria.id));
  articulo.etiquetas.forEach((etiqueta) => tags.add(tagEtiqueta(etiqueta.id)));
  if (articulo.autor) tags.add(tagAutor(articulo.autor.id));
  relacionados.forEach((r) => tags.add(tagArticulo(r.id)));
  return { maxAge: UN_ANIO, swr: SWR, tags: [...tags] };
}

export type EntidadListado = { tipo: 'categoria' | 'etiqueta' | 'autor'; id: string };

const TAG_DE_ENTIDAD = { categoria: tagCategoria, etiqueta: tagEtiqueta, autor: tagAutor };

/** Listados, portada, sitemap y feed: la colección, más la entidad que presentan. */
export function cacheListado(entidad?: EntidadListado): CacheOptions {
  const tags = [TAG_ARTICULOS];
  if (entidad) tags.push(TAG_DE_ENTIDAD[entidad.tipo](entidad.id));
  return { maxAge: UN_ANIO, swr: SWR, tags };
}

/** 404 por slug inexistente: vence solo (tag de ruta automático). */
export function cacheNoEncontrado(): CacheOptions {
  return { maxAge: 3600, swr: SWR };
}

/** 301 por slug anterior. */
export function cacheRedireccion(): CacheOptions {
  return { maxAge: UN_ANIO, swr: 0 };
}
