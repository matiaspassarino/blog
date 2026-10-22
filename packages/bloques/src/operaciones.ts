// Operaciones puras sobre la lista de bloques del editor (spec 003, research D12). Todas devuelven un
// arreglo nuevo y no mutan la entrada; un índice inexistente deja el contenido igual (una copia).
import type { Bloque, Contenido } from './esquema';
import type { TipoBloque } from './tipos-bloque';
import { crearBloque } from './utilidades';

const dentroDeRango = (contenido: Contenido, indice: number) =>
  Number.isInteger(indice) && indice >= 0 && indice < contenido.length;

/** Inserta un bloque nuevo del tipo pedido (con sus valores iniciales); al final si no se da posición. */
export function agregarBloque(contenido: Contenido, tipo: TipoBloque, posicion?: number): Contenido {
  const lugar = Math.min(Math.max(posicion ?? contenido.length, 0), contenido.length);
  const copia = [...contenido];
  copia.splice(lugar, 0, crearBloque(tipo));
  return copia;
}

/** Mueve el bloque a `destino`; si cae fuera de rango se recorta al extremo. */
export function moverBloque(contenido: Contenido, indice: number, destino: number): Contenido {
  const copia = [...contenido];
  if (!dentroDeRango(contenido, indice)) return copia;
  const [bloque] = copia.splice(indice, 1);
  if (bloque) copia.splice(Math.min(Math.max(destino, 0), copia.length), 0, bloque);
  return copia;
}

/** Inserta, justo debajo del original, una copia independiente con un `id` nuevo. */
export function duplicarBloque(contenido: Contenido, indice: number): Contenido {
  const copia = [...contenido];
  const original = contenido[indice];
  if (!original) return copia;
  copia.splice(indice + 1, 0, { ...structuredClone(original), id: crypto.randomUUID() });
  return copia;
}

export function quitarBloque(contenido: Contenido, indice: number): Contenido {
  return contenido.filter((_bloque, i) => i !== indice);
}

/** Mezcla `cambios` en el bloque; el `id` y el `tipo` se conservan siempre. */
export function actualizarBloque(contenido: Contenido, indice: number, cambios: Partial<Bloque>): Contenido {
  return contenido.map((bloque, i) =>
    i === indice ? ({ ...bloque, ...cambios, id: bloque.id, tipo: bloque.tipo } as Bloque) : bloque,
  );
}
