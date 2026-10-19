// Listados públicos paginados y entradas del sitemap (contracts/db.md, RF-017, RSEO-004).
// Cantidad constante de peticiones: hasta 2 por listado de taxonomía (para
// distinguir un slug inexistente de un listado vacío) y 1 para el sitemap.
import type { ClienteBlog } from '../cliente';
import { traducirError } from '../errores';
import { aPagina, rangoDe, type OpcionesPagina, type Pagina } from '../paginacion';
import { TABLA_TAXONOMIA, type Categoria, type Etiqueta, type TipoEntidad, type TipoTaxonomia } from '../tipos-dominio';
import { aEntradasSitemap, aResumen } from './mapeo';
import type { ResumenArticulo } from './tipos-publicos';

export type EntradaSitemap = { tipo: TipoEntidad; slug: string; actualizadoEn: string };

const COLUMNAS_RESUMEN =
  'id, titulo, slug, extracto, imagen_destacada, publicado_en, categoria:categorias(id, nombre, slug)';
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

export async function listarArticulosPublicados(
  c: ClienteBlog,
  opciones: OpcionesPagina = {},
): Promise<Pagina<ResumenArticulo>> {
  return paginaDeArticulos(c, opciones, {});
}

/** La taxonomía por slug, o null si no existe (para distinguirla de un listado vacío). */
async function taxonomiaPorSlug(c: ClienteBlog, tipo: TipoTaxonomia, slug: string) {
  const { data, error } = await c.from(TABLA_TAXONOMIA[tipo]).select('*').eq('slug', slug).maybeSingle();
  if (error) throw traducirError(error);
  return data;
}

export async function listarPorCategoria(
  c: ClienteBlog,
  slug: string,
  opciones: OpcionesPagina = {},
): Promise<{ categoria: Categoria; articulos: Pagina<ResumenArticulo> } | null> {
  const categoria = await taxonomiaPorSlug(c, 'categoria', slug);
  if (!categoria) return null;
  return { categoria, articulos: await paginaDeArticulos(c, opciones, { categoriaId: categoria.id }) };
}

export async function listarPorEtiqueta(
  c: ClienteBlog,
  slug: string,
  opciones: OpcionesPagina = {},
): Promise<{ etiqueta: Etiqueta; articulos: Pagina<ResumenArticulo> } | null> {
  const etiqueta = await taxonomiaPorSlug(c, 'etiqueta', slug);
  if (!etiqueta) return null;
  return { etiqueta, articulos: await paginaDeArticulos(c, opciones, { etiquetaId: etiqueta.id }) };
}

/**
 * Hasta `cantidad` publicados para el final de un artículo (spec 002, RF-005, research D18):
 * primero los de su categoría y, si faltan, los más recientes. A lo sumo 2 peticiones.
 */
export async function listarRelacionados(
  c: ClienteBlog,
  articulo: { id: string; categoriaId: string | null },
  cantidad = 3,
): Promise<ResumenArticulo[]> {
  const publicadosSin = (excluir: string[], limite: number) =>
    c
      .from('articulos')
      .select(COLUMNAS_RESUMEN)
      .eq('estado', 'publicado')
      .not('id', 'in', `(${excluir.join(',')})`)
      .order('publicado_en', { ascending: false })
      .order('id', { ascending: false })
      .limit(limite);

  const elegidos: ResumenArticulo[] = [];
  if (articulo.categoriaId) {
    const { data, error } = await publicadosSin([articulo.id], cantidad).eq('categoria_id', articulo.categoriaId);
    if (error) throw traducirError(error);
    elegidos.push(...data.map(aResumen));
  }
  if (elegidos.length < cantidad) {
    const excluir = [articulo.id, ...elegidos.map((a) => a.id)];
    const { data, error } = await publicadosSin(excluir, cantidad - elegidos.length);
    if (error) throw traducirError(error);
    elegidos.push(...data.map(aResumen));
  }
  return elegidos;
}

/**
 * Artículos publicados y solo las taxonomías con algún artículo publicado
 * (RSEO-004). Un único jsonb vía RPC: PostgREST corta las filas en max_rows
 * (1000) y el sitemap tiene que ser completo (validación A5-B1).
 */
export async function listarParaSitemap(c: ClienteBlog): Promise<EntradaSitemap[]> {
  const { data, error } = await c.rpc('entradas_sitemap');
  if (error) throw traducirError(error);
  return aEntradasSitemap(data);
}
