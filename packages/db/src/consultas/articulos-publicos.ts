// Consultas públicas de artículos (contracts/db.md, "Consultas públicas").
// Una sola petición por consulta, con relaciones embebidas (sin N+1).
import type { ClienteBlog } from '../cliente';
import { traducirError } from '../errores';
import type { TipoEntidad } from '../tipos-dominio';
import { aAutor, aContenido, aEtiquetas, aFechaPublicacion, aImagen, aSeo } from './mapeo';
import type { ArticuloPublico } from './tipos-publicos';

export type { ArticuloPublico, AutorPublico, ReferenciaTaxonomia } from './tipos-publicos';

const COLUMNAS_PUBLICAS = `
  id, titulo, slug, extracto, titulo_seo, descripcion_seo, imagen_destacada, contenido,
  publicado_en, actualizado_en,
  categoria:categorias(id, nombre, slug),
  etiquetas:articulos_etiquetas(etiqueta:etiquetas(id, nombre, slug)),
  autor:autores_publicos!autor_id(id, slug, nombre, biografia, avatar)
`;

/**
 * Artículo publicado por slug, o null. El estado se filtra de forma explícita
 * además de la RLS, así que con una sesión del equipo no devuelve borradores
 * (validación A3-M3). La fecha no se compara con el reloj de la app (C4-M4):
 * para anon la decide la RLS con `now()` de la base, y un publicado con fecha
 * futura solo puede crearlo el sistema (contracts/db.md, service_role).
 */
export async function obtenerArticuloPublicado(c: ClienteBlog, slug: string): Promise<ArticuloPublico | null> {
  const { data, error } = await c
    .from('articulos')
    .select(COLUMNAS_PUBLICAS)
    .eq('slug', slug)
    .eq('estado', 'publicado')
    .maybeSingle();
  if (error) throw traducirError(error);
  if (!data) return null;

  const { titulo_seo: _tituloSeo, descripcion_seo: _descripcionSeo, etiquetas, ...resto } = data;
  return {
    ...resto,
    imagen_destacada: aImagen(data.imagen_destacada),
    contenido: aContenido(data.contenido),
    publicado_en: aFechaPublicacion(data.publicado_en),
    autor: aAutor(data.autor),
    etiquetas: aEtiquetas(etiquetas),
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
