// Flujo único de los listados paginados (contracts/rutas.md): /blog, categoría, etiqueta y
// autor. Combina resolverPagina (301 de /pagina/1, 404 de formatos inválidos y fuera de
// rango) con resolverEntidad (301 por slug anterior, 404). Ninguna página lo repite.
import type { Pagina, ResumenArticulo } from '@blog/db';
import type { CacheOptions } from 'astro';
import { cacheNoEncontrado, cacheRedireccion } from './cache';
import { fueraDeRango, resolverPagina } from './paginacion';
import { respuestaNoEncontrado, resolverEntidad } from './resolver';

type ConArticulos = { articulos: Pagina<ResumenArticulo> };

type Opciones<T extends ConArticulos> = {
  /** Parámetro de `[...pagina]`: undefined o 'pagina/<n>'. */
  param: string | undefined;
  /** URL sin paginar del listado, por ejemplo '/blog/categoria/diseno'. */
  rutaBase: string;
  /** Carga el listado de la página pedida, o null si la entidad no existe. */
  cargar: (pagina: number) => Promise<T | null>;
  /** Slug vigente a partir de uno anterior (categorías y etiquetas). Sin él, no hay 301. */
  redireccion?: () => Promise<string | null>;
  /** Prefijo de la URL vigente, para la 301 por slug anterior. */
  prefijo?: string;
};

export type ResultadoListado<T> =
  { tipo: 'listado'; valor: T; pagina: number } | { tipo: 'respuesta'; respuesta: Response; cache: CacheOptions };

const redirigir = (destino: string): ResultadoListado<never> => ({
  tipo: 'respuesta',
  respuesta: new Response(null, { status: 301, headers: { Location: destino } }),
  cache: cacheRedireccion(),
});
const noEncontrado = (): ResultadoListado<never> => ({
  tipo: 'respuesta',
  respuesta: respuestaNoEncontrado(),
  cache: cacheNoEncontrado(),
});

/** " — página n" en títulos y encabezados de las páginas siguientes (RSEO-004). */
export const sufijoPagina = (pagina: number) => (pagina > 1 ? ` — página ${pagina}` : '');

/** Migas Inicio › Blog › … de las páginas del blog (visibles y BreadcrumbList). */
export const migasDelBlog = (...resto: { nombre: string; ruta: string }[]) => [
  { nombre: 'Inicio', ruta: '/' },
  { nombre: 'Blog', ruta: '/blog' },
  ...resto,
];

/** URL de una página del listado: la 1 es la URL sin paginar. */
export const rutaDePagina = (rutaBase: string, pagina: number) =>
  pagina === 1 ? rutaBase : `${rutaBase}/pagina/${pagina}`;

export async function resolverListado<T extends ConArticulos>(opciones: Opciones<T>): Promise<ResultadoListado<T>> {
  const pedida = resolverPagina(opciones.param);
  if (pedida.tipo === 'redireccion') return redirigir(opciones.rutaBase);
  if (pedida.tipo === 'no_encontrado') return noEncontrado();

  const resultado = await resolverEntidad({
    buscar: () => opciones.cargar(pedida.numero),
    redireccion: opciones.redireccion ?? (async () => null),
    prefijo: opciones.prefijo ?? '',
  });
  if (resultado.tipo === 'redireccion') return redirigir(rutaDePagina(resultado.destino, pedida.numero));
  if (resultado.tipo === 'no_encontrado' || fueraDeRango(pedida.numero, resultado.valor.articulos.totalPaginas)) {
    return noEncontrado();
  }
  return { tipo: 'listado', valor: resultado.valor, pagina: pedida.numero };
}
