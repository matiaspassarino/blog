// Los errores de validación llegan por índice del bloque en la lista guardada (`ErrorBloque.indice`), que no es la
// posición del elemento en el documento: los párrafos vacíos no generan bloque y los que tienen `continuacion` se
// unen al anterior. Se traducen al `bloqueId` con la lista ya convertida (research D6).
import type { Contenido, ErrorBloque } from '@blog/bloques';

/** Errores agrupados por el `id` del bloque; ignora la imagen destacada (`indice < 0`) y los índices fuera de la lista. */
export function erroresPorBloqueId(contenido: Contenido, errores: ErrorBloque[]): Map<string, ErrorBloque[]> {
  const mapa = new Map<string, ErrorBloque[]>();
  for (const error of errores) {
    const bloque = error.indice >= 0 ? contenido[error.indice] : undefined;
    if (bloque) mapa.set(bloque.id, [...(mapa.get(bloque.id) ?? []), error]);
  }
  return mapa;
}

/** El error del bloque que aparece antes en el documento; de un mismo bloque, el primero recibido. */
export function primerErrorDelDocumento(
  contenido: Contenido,
  errores: ErrorBloque[],
): { bloqueId: string; error: ErrorBloque } | null {
  const validos = errores.filter((error) => error.indice >= 0 && contenido[error.indice] !== undefined);
  const primero = validos.reduce<ErrorBloque | undefined>(
    (menor, error) => (menor === undefined || error.indice < menor.indice ? error : menor),
    undefined,
  );
  const bloque = primero ? contenido[primero.indice] : undefined;
  return primero && bloque ? { bloqueId: bloque.id, error: primero } : null;
}
