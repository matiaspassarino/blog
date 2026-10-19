// Carga de las páginas de categoría y etiqueta (H2-E2, H2-E3): una sola implementación para
// las dos. Las páginas solo deciden la taxonomía.
import { listarPorCategoria, listarPorEtiqueta, resolverRedireccion, type TipoTaxonomia } from '@blog/db';
import { cacheListado } from './cache';
import { datos } from './datos';
import { resolverListado } from './listados';

const CARGAR = {
  categoria: async (slug: string, pagina: number) => {
    const r = await listarPorCategoria(datos, slug, { pagina });
    return r && { entidad: r.categoria, articulos: r.articulos };
  },
  etiqueta: async (slug: string, pagina: number) => {
    const r = await listarPorEtiqueta(datos, slug, { pagina });
    return r && { entidad: r.etiqueta, articulos: r.articulos };
  },
};

export async function resolverTaxonomia(tipo: TipoTaxonomia, slug: string, param: string | undefined) {
  const prefijo = `/blog/${tipo}/`;
  const rutaBase = `${prefijo}${slug}`;
  const resultado = await resolverListado({
    param,
    rutaBase,
    cargar: (pagina) => CARGAR[tipo](slug, pagina),
    redireccion: () => resolverRedireccion(datos, tipo, slug),
    prefijo,
  });
  if (resultado.tipo === 'respuesta') return resultado;
  return {
    ...resultado,
    tipoTaxonomia: tipo,
    rutaBase,
    cache: cacheListado({ tipo, id: resultado.valor.entidad.id }),
  };
}

export type ListadoTaxonomia = Extract<Awaited<ReturnType<typeof resolverTaxonomia>>, { tipo: 'listado' }>;
