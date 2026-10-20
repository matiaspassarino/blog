// Búsqueda pública en español (contracts/db.md, RF-018 a RF-020, research D12).
// El RPC filtra los publicados, ordena por relevancia y devuelve el total en cada fila.
import type { ClienteBlog } from '../cliente';
import { traducirError } from '../errores';
import { aPagina, rangoDe, type OpcionesPagina, type Pagina } from '../paginacion';
import { aResumen } from './mapeo';
import type { ResumenArticulo } from './tipos-publicos';

export async function buscarArticulos(
  c: ClienteBlog,
  consulta: string,
  opciones: OpcionesPagina = {},
): Promise<Pagina<ResumenArticulo>> {
  const { pagina, porPagina, desde } = rangoDe(opciones);
  const { data, error } = await c.rpc('buscar_articulos', { consulta, limite: porPagina, desplazamiento: desde });
  if (error) throw traducirError(error);

  const items = data.map((fila) =>
    aResumen({
      ...fila,
      categoria: fila.categoria_id
        ? { id: fila.categoria_id, nombre: fila.categoria_nombre, slug: fila.categoria_slug }
        : null,
    }),
  );
  return aPagina(items, data[0]?.total ?? 0, pagina, porPagina);
}
