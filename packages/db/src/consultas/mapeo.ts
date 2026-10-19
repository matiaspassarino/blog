// Mapeo de filas de la base a tipos de dominio: el único lugar con casts.
// Se justifican por research D8: el contenido se valida con Zod al escribir y la
// base tiene un check liviano; no se revalida en cada lectura.
import type { Contenido, Imagen } from '@blog/bloques';
import type { Json } from '../tipos';
import type { TipoEntidad } from '../tipos-dominio';
import type { AutorPublico, ReferenciaTaxonomia, ResumenArticulo } from './tipos-publicos';

type FilaSeo = { titulo: string; extracto: string | null; titulo_seo: string | null; descripcion_seo: string | null };
type AutorEmbebido = {
  id: string | null;
  slug: string | null;
  nombre: string | null;
  biografia: string | null;
  avatar: Json | null;
} | null;

/** Respaldo de RF-006: sin campos SEO propios se usan el título y el extracto. */
export function aSeo(fila: FilaSeo) {
  return { titulo: fila.titulo_seo ?? fila.titulo, descripcion: fila.descripcion_seo ?? fila.extracto };
}

export const aImagen = (valor: Json | null) => valor as Imagen | null;
export const aContenido = (valor: Json) => valor as Contenido;
export const aAutor = (valor: AutorEmbebido) => valor as AutorPublico | null;
/** Un publicado siempre tiene fecha: lo garantizan el filtro de estado y el check articulos_publicado_con_fecha. */
export const aFechaPublicacion = (valor: string | null) => valor as string;

type FilaResumen = {
  id: string;
  titulo: string;
  slug: string;
  extracto: string | null;
  imagen_destacada: Json | null;
  publicado_en: string | null;
  categoria: ReferenciaTaxonomia | null;
};

export function aResumen(fila: FilaResumen): ResumenArticulo {
  return {
    id: fila.id,
    titulo: fila.titulo,
    slug: fila.slug,
    extracto: fila.extracto,
    imagen_destacada: aImagen(fila.imagen_destacada),
    publicado_en: aFechaPublicacion(fila.publicado_en),
    categoria: fila.categoria,
  };
}

type FilaSitemap = { tipo: TipoEntidad; slug: string; actualizado_en: string };

/** El RPC entradas_sitemap devuelve un arreglo jsonb con esa forma (ver su migración). */
export function aEntradasSitemap(valor: Json) {
  return (valor as FilaSitemap[]).map((fila) => ({
    tipo: fila.tipo,
    slug: fila.slug,
    actualizadoEn: fila.actualizado_en,
  }));
}

/** Etiquetas embebidas en orden estable por nombre (validación C5-M3). */
export function aEtiquetas(filas: { etiqueta: ReferenciaTaxonomia | null }[]): ReferenciaTaxonomia[] {
  return filas
    .flatMap(({ etiqueta }) => (etiqueta ? [etiqueta] : []))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
