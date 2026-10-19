// Paginación de los listados (specs/002-sitio-publico/contracts/rutas.md, RF-010). Una sola
// forma válida por número de página: así no hay URLs duplicadas de la misma página.

export type ResolucionPagina = { tipo: 'pagina'; numero: number } | { tipo: 'redireccion' } | { tipo: 'no_encontrado' };

/**
 * `param` es el de `[...pagina]` (undefined o 'pagina/<n>') o el de `/blog/pagina/[n]` ('<n>').
 * La página 1 explícita redirige a la URL sin paginar (H2-E6).
 */
export function resolverPagina(param: string | undefined): ResolucionPagina {
  if (param === undefined) return { tipo: 'pagina', numero: 1 };
  const coincidencia = /^(?:pagina\/)?([1-9]\d*)$/.exec(param);
  if (!coincidencia?.[1]) return { tipo: 'no_encontrado' };
  const numero = Number(coincidencia[1]);
  return numero === 1 ? { tipo: 'redireccion' } : { tipo: 'pagina', numero };
}

/** Fuera de rango → 404 (H2-E5). Sin artículos, la página 1 igual existe (estado vacío). */
export const fueraDeRango = (pagina: number, totalPaginas: number) => pagina > Math.max(totalPaginas, 1);
