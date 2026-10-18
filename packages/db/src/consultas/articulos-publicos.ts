// Consultas públicas de artículos (contracts/db.md, "Consultas públicas").
// Una sola petición por consulta, con relaciones embebidas (sin N+1).
import type { Contenido, Imagen } from '@blog/bloques';
import type { ClienteBlog } from '../cliente';
import { traducirError } from '../errores';
import type { TipoEntidad } from '../tipos-dominio';
import { aAutor, aContenido, aImagen, aSeo, type AutorPublico, type ReferenciaTaxonomia } from './mapeo';

export type { AutorPublico, ReferenciaTaxonomia };

export type ArticuloPublico = {
  id: string;
  titulo: string;
  slug: string;
  extracto: string | null;
  imagen_destacada: Imagen | null;
  contenido: Contenido;
  publicado_en: string;
  actualizado_en: string;
  categoria: ReferenciaTaxonomia | null;
  etiquetas: ReferenciaTaxonomia[];
  autor: AutorPublico | null;
  seo: { titulo: string; descripcion: string | null };
};

const COLUMNAS_PUBLICAS = `
  id, titulo, slug, extracto, titulo_seo, descripcion_seo, imagen_destacada, contenido,
  publicado_en, actualizado_en,
  categoria:categorias(nombre, slug),
  autor:autores_publicos!autor_id(nombre, biografia, avatar)
`;

/**
 * Artículo publicado por slug, o null. El filtro de publicado es explícito además
 * de la RLS: con una sesión del equipo no devuelve borradores (validación A3-M3).
 */
export async function obtenerArticuloPublicado(c: ClienteBlog, slug: string): Promise<ArticuloPublico | null> {
  const { data, error } = await c
    .from('articulos')
    .select(COLUMNAS_PUBLICAS)
    .eq('slug', slug)
    .eq('estado', 'publicado')
    .lte('publicado_en', new Date().toISOString())
    .maybeSingle();
  if (error) throw traducirError(error);
  if (!data) return null;

  const { titulo_seo: _tituloSeo, descripcion_seo: _descripcionSeo, ...resto } = data;
  return {
    ...resto,
    imagen_destacada: aImagen(data.imagen_destacada),
    contenido: aContenido(data.contenido),
    // No es null: lo garantizan el filtro de publicado y el check articulos_publicado_con_fecha.
    publicado_en: data.publicado_en as string,
    autor: aAutor(data.autor),
    // articulos_etiquetas llega en H3: T051 agrega el embebido real.
    etiquetas: [],
    seo: aSeo(data),
  };
}

/** Slug actual de una entidad a partir de un slug anterior, o null (RF-012, RSEO-003). */
export async function resolverRedireccion(c: ClienteBlog, tipo: TipoEntidad, slug: string): Promise<string | null> {
  const { data, error } = await c.rpc('resolver_redireccion', { tipo, slug });
  if (error) throw traducirError(error);
  // El tipo generado dice string, pero la función devuelve null si no hay redirección.
  return data ?? null;
}
