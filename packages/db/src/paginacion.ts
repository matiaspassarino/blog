// Paginación compartida por listados y búsqueda (contracts/db.md, Pagina<T>).

export type Pagina<T> = { items: T[]; total: number; pagina: number; porPagina: number; totalPaginas: number };
export type OpcionesPagina = { pagina?: number; porPagina?: number };

/** RF-017: 12 por página por defecto. */
const POR_PAGINA = 12;

/** Rango para `range(desde, hasta)` de PostgREST; `pagina` empieza en 1. */
export function rangoDe({ pagina = 1, porPagina = POR_PAGINA }: OpcionesPagina = {}) {
  const desde = (pagina - 1) * porPagina;
  return { pagina, porPagina, desde, hasta: desde + porPagina - 1 };
}

export function aPagina<T>(items: T[], total: number, pagina: number, porPagina: number): Pagina<T> {
  return { items, total, pagina, porPagina, totalPaginas: Math.ceil(total / porPagina) };
}
