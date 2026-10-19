// Resolución única "entidad → 301 → 404" (specs/002-sitio-publico/contracts/rutas.md).
// La usan el artículo y las páginas de taxonomía. Los errores de datos se propagan
// (research D13): nunca se convierten en un 404 falso.

export type Resolucion<T> =
  { tipo: 'entidad'; valor: T } | { tipo: 'redireccion'; destino: string } | { tipo: 'no_encontrado' };

type Opciones<T> = {
  /** Busca la entidad publicada por su slug actual. */
  buscar: () => Promise<T | null>;
  /** Slug vigente a partir de un slug anterior (resolverRedireccion de @blog/db). */
  redireccion: () => Promise<string | null>;
  /** Prefijo de la URL vigente, por ejemplo '/blog/' o '/blog/categoria/'. */
  prefijo: string;
};

export async function resolverEntidad<T>({ buscar, redireccion, prefijo }: Opciones<T>): Promise<Resolucion<T>> {
  const valor = await buscar();
  if (valor) return { tipo: 'entidad', valor };
  const slugNuevo = await redireccion();
  return slugNuevo ? { tipo: 'redireccion', destino: `${prefijo}${slugNuevo}` } : { tipo: 'no_encontrado' };
}
