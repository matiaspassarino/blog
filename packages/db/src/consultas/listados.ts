// Listados públicos paginados y entradas del sitemap (contracts/db.md, RF-017, RSEO-004).
// Cantidad constante de peticiones: hasta 2 por listado de taxonomía (para
// distinguir un slug inexistente de un listado vacío) y 3 para el sitemap.
import type { ClienteBlog } from '../cliente';
import { traducirError } from '../errores';
import { aPagina, rangoDe, type OpcionesPagina, type Pagina } from '../paginacion';
import type { Database } from '../tipos';
import { aResumen } from './mapeo';
import type { ResumenArticulo } from './tipos-publicos';

export type Categoria = Database['public']['Tables']['categorias']['Row'];
export type Etiqueta = Database['public']['Tables']['etiquetas']['Row'];
export type EntradaSitemap = { tipo: 'articulo' | 'categoria' | 'etiqueta'; slug: string; actualizadoEn: string };

const COLUMNAS_RESUMEN =
  'id, titulo, slug, extracto, imagen_destacada, publicado_en, categoria:categorias(nombre, slug)';
// El embebido !inner filtra por etiqueta sin traer columnas extra al resultado útil.
const COLUMNAS_POR_ETIQUETA = `${COLUMNAS_RESUMEN}, filtro:articulos_etiquetas!inner(etiqueta_id)` as const;

type Filtro = { categoriaId?: string; etiquetaId?: string };

/** Publicados, del más reciente al más antiguo (desempate estable por id). */
async function paginaDeArticulos(
  c: ClienteBlog,
  opciones: OpcionesPagina,
  filtro: Filtro,
): Promise<Pagina<ResumenArticulo>> {
  const { pagina, porPagina, desde, hasta } = rangoDe(opciones);
  let consulta = filtro.etiquetaId
    ? c.from('articulos').select(COLUMNAS_POR_ETIQUETA, { count: 'exact' }).eq('filtro.etiqueta_id', filtro.etiquetaId)
    : c.from('articulos').select(COLUMNAS_RESUMEN, { count: 'exact' });
  consulta = consulta.eq('estado', 'publicado');
  if (filtro.categoriaId) consulta = consulta.eq('categoria_id', filtro.categoriaId);

  const { data, error, count } = await consulta
    .order('publicado_en', { ascending: false })
    .order('id', { ascending: false })
    .range(desde, hasta);
  if (error) throw traducirError(error);
  return aPagina(data.map(aResumen), count ?? 0, pagina, porPagina);
}

export async function listarArticulosPublicados(c: ClienteBlog, opciones: OpcionesPagina = {}) {
  return paginaDeArticulos(c, opciones, {});
}

export async function listarPorCategoria(
  c: ClienteBlog,
  slug: string,
  opciones: OpcionesPagina = {},
): Promise<{ categoria: Categoria; articulos: Pagina<ResumenArticulo> } | null> {
  const { data, error } = await c.from('categorias').select('*').eq('slug', slug).maybeSingle();
  if (error) throw traducirError(error);
  if (!data) return null;
  return { categoria: data, articulos: await paginaDeArticulos(c, opciones, { categoriaId: data.id }) };
}

export async function listarPorEtiqueta(
  c: ClienteBlog,
  slug: string,
  opciones: OpcionesPagina = {},
): Promise<{ etiqueta: Etiqueta; articulos: Pagina<ResumenArticulo> } | null> {
  const { data, error } = await c.from('etiquetas').select('*').eq('slug', slug).maybeSingle();
  if (error) throw traducirError(error);
  if (!data) return null;
  return { etiqueta: data, articulos: await paginaDeArticulos(c, opciones, { etiquetaId: data.id }) };
}

/** Artículos publicados y solo las taxonomías con algún artículo publicado (RSEO-004). */
export async function listarParaSitemap(c: ClienteBlog): Promise<EntradaSitemap[]> {
  const [articulos, categorias, etiquetas] = await Promise.all([
    c.from('articulos').select('slug, actualizado_en').eq('estado', 'publicado'),
    c.from('categorias').select('slug, actualizado_en, articulos!inner(id)').eq('articulos.estado', 'publicado'),
    c
      .from('etiquetas')
      .select('slug, actualizado_en, articulos_etiquetas!inner(articulos!inner(id))')
      .eq('articulos_etiquetas.articulos.estado', 'publicado'),
  ]);
  for (const resultado of [articulos, categorias, etiquetas]) {
    if (resultado.error) throw traducirError(resultado.error);
  }
  const entradas = (tipo: EntradaSitemap['tipo'], filas: { slug: string; actualizado_en: string }[] | null) =>
    (filas ?? []).map((fila) => ({ tipo, slug: fila.slug, actualizadoEn: fila.actualizado_en }));
  return [
    ...entradas('articulo', articulos.data),
    ...entradas('categoria', categorias.data),
    ...entradas('etiqueta', etiquetas.data),
  ];
}
