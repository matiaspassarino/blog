// Consultas públicas de artículos (contracts/db.md, "Consultas públicas").
// Una sola petición por consulta, con relaciones embebidas (sin N+1).
import type { Contenido, Imagen } from '@blog/bloques';
import type { ClienteBlog } from '../cliente';
import { traducirError } from '../errores';
import type { TipoEntidad } from '../tipos-dominio';

export type AutorPublico = { nombre: string; biografia: string | null; avatar: Imagen | null };
export type ReferenciaTaxonomia = { nombre: string; slug: string };

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

/** Respaldo de RF-006: sin campos SEO propios se usan el título y el extracto. */
function aSeo(fila: {
  titulo: string;
  extracto: string | null;
  titulo_seo: string | null;
  descripcion_seo: string | null;
}) {
  return { titulo: fila.titulo_seo ?? fila.titulo, descripcion: fila.descripcion_seo ?? fila.extracto };
}

/** Artículo publicado por slug, o null si no existe o no es visible (RLS: solo publicados). */
export async function obtenerArticuloPublicado(c: ClienteBlog, slug: string): Promise<ArticuloPublico | null> {
  const { data, error } = await c.from('articulos').select(COLUMNAS_PUBLICAS).eq('slug', slug).maybeSingle();
  if (error) throw traducirError(error);
  if (!data) return null;

  const { titulo_seo: _tituloSeo, descripcion_seo: _descripcionSeo, ...resto } = data;
  return {
    ...resto,
    imagen_destacada: data.imagen_destacada as Imagen | null,
    contenido: data.contenido as Contenido,
    publicado_en: data.publicado_en as string,
    autor: data.autor as AutorPublico | null,
    // articulos_etiquetas llega en H3: T051 agrega el embebido real.
    etiquetas: [],
    seo: aSeo(data),
  };
}

/** Slug actual de una entidad a partir de un slug anterior, o null (RF-012, RSEO-003). */
export async function resolverRedireccion(c: ClienteBlog, tipo: TipoEntidad, slug: string): Promise<string | null> {
  const { data, error } = await c.rpc('resolver_redireccion', { tipo, slug });
  if (error) throw traducirError(error);
  return data ?? null;
}
