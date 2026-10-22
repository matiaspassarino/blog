// T047 (spec 005, H2 esc. 5; research D6 "Errores por id, no por posición"; contracts/componentes.md "limites.ts y
// mapa-errores.ts"): traducir `ErrorBloque.indice` (índice del BLOQUE de la lista convertida) al `bloqueId` del nodo.
// El índice del bloque no es la posición del elemento en el documento: los párrafos vacíos sin continuación no
// generan bloque y los párrafos con `continuacion` se unen al anterior.
// FASE ROJA: `./mapa-errores` no existe. API supuesta (funciones puras, exports con nombre):
//   erroresPorBloqueId(contenido: Contenido, errores: ErrorBloque[]): Map<string, ErrorBloque[]>
//     - `contenido` es la lista de bloques ya convertida (`documentoABloques(doc)`); la clave es `bloque.id` y el valor
//       los errores de ese bloque en el orden recibido, con su `indice` sin cambios.
//     - Se ignoran los errores con `indice < 0` (imagen destacada) y los que apuntan fuera de la lista (obsoletos).
//   primerErrorDelDocumento(contenido: Contenido, errores: ErrorBloque[]): { bloqueId: string; error: ErrorBloque } | null
//     - El error del bloque que aparece primero en el documento (el de menor `indice` válido); si un bloque tiene
//       varios, el primero de la lista recibida para ese bloque. `null` si ningún error apunta a un bloque.
import type { ErrorBloque } from '@blog/bloques';
import { describe, expect, it } from 'vitest';
import { documentoABloques, type NodoDocumento } from './conversion';
import { erroresPorBloqueId, primerErrorDelDocumento } from './mapa-errores';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const parrafoNodo = (n: number, texto: string, continuacion = ''): NodoDocumento => ({
  type: 'paragraph',
  attrs: { bloqueId: ID(n), continuacion },
  ...(texto ? { content: [{ type: 'text', text: texto }] } : {}),
});
const imagenNodo = (n: number): NodoDocumento => ({
  type: 'imagenBloque',
  attrs: {
    bloqueId: ID(n),
    bloque: { id: ID(n), tipo: 'imagen', imagen: { ruta: '', ancho: 0, alto: 0, alt: '', decorativa: false } },
  },
});

/**
 * Elementos del documento: 0 párrafo "A" (bloque 0) · 1 párrafo vacío (sin bloque) · 2 imagen (bloque 1) · 3 párrafo "B"
 * (bloque 2) · 4 continuación de B (mismo bloque 2) · 5 separador (bloque 3) · 6 imagen (bloque 4).
 */
const documento: NodoDocumento = {
  type: 'doc',
  content: [
    parrafoNodo(1, 'A'),
    parrafoNodo(2, ''),
    imagenNodo(3),
    parrafoNodo(4, 'B'),
    parrafoNodo(4, 'C', '\n\n'),
    { type: 'horizontalRule', attrs: { bloqueId: ID(5) } },
    imagenNodo(6),
  ],
};
const contenido = documentoABloques(documento);

const error = (indice: number, campo = 'imagen.alt', mensaje = 'Falta el texto alternativo'): ErrorBloque => ({
  indice,
  campo,
  mensaje,
});

describe('erroresPorBloqueId (H2-E5): el índice del bloque no es la posición del elemento', () => {
  it('la lista convertida omite el párrafo vacío y une la continuación (premisa de los casos siguientes)', () => {
    expect(contenido.map((b) => b.id)).toEqual([ID(1), ID(3), ID(4), ID(5), ID(6)]);
  });

  it('H2-E5: el error del bloque 1 apunta a la primera imagen, aunque ocupa la posición 3 del documento', () => {
    const mapa = erroresPorBloqueId(contenido, [error(1)]);
    expect([...mapa.keys()]).toEqual([ID(3)]);
    expect(mapa.get(ID(3))).toEqual([error(1)]);
  });

  it('H2-E5: el error del bloque 4 apunta a la imagen del final (posición 7 del documento)', () => {
    const mapa = erroresPorBloqueId(contenido, [error(4)]);
    expect([...mapa.keys()]).toEqual([ID(6)]);
  });

  it('H2-E5: un párrafo con continuación cuenta como un solo bloque: el bloque 2 es el párrafo B/C', () => {
    const mapa = erroresPorBloqueId(contenido, [error(2, 'texto', 'Texto demasiado largo')]);
    expect([...mapa.keys()]).toEqual([ID(4)]);
  });

  it('H2-E5: varios errores del mismo bloque se agrupan en el orden recibido', () => {
    const a = error(4, 'imagen.ruta', 'Falta la imagen');
    const b = error(4, 'imagen.alt');
    expect(erroresPorBloqueId(contenido, [a, b]).get(ID(6))).toEqual([a, b]);
  });

  it('H2-E5: los errores de bloques distintos quedan en claves distintas', () => {
    const mapa = erroresPorBloqueId(contenido, [error(1), error(4)]);
    expect([...mapa.keys()].sort()).toEqual([ID(3), ID(6)].sort());
  });

  it('H2-E5: un error de la imagen destacada (indice -1) no se asigna a ningún nodo', () => {
    const mapa = erroresPorBloqueId(contenido, [error(-1, 'imagen_destacada', 'Falta el texto alternativo')]);
    expect(mapa.size).toBe(0);
  });

  it('H2-E5: un índice fuera de la lista (error obsoleto) se ignora sin fallar', () => {
    expect(erroresPorBloqueId(contenido, [error(99)]).size).toBe(0);
  });

  it('H2-E5: sin errores, el mapa está vacío', () => {
    expect(erroresPorBloqueId(contenido, []).size).toBe(0);
  });

  it('H2-E5: con el contenido vacío, ningún error se asigna', () => {
    expect(erroresPorBloqueId([], [error(0)]).size).toBe(0);
  });
});

describe('primerErrorDelDocumento (H2-E5): el primero por orden del documento', () => {
  it('H2-E5: devuelve el error del bloque que aparece antes, sin importar el orden de la lista recibida', () => {
    const tardio = error(4);
    const temprano = error(1);
    expect(primerErrorDelDocumento(contenido, [tardio, temprano])).toEqual({ bloqueId: ID(3), error: temprano });
  });

  it('H2-E5: con varios errores en el mismo bloque, devuelve el primero recibido de ese bloque', () => {
    const primero = error(4, 'imagen.ruta', 'Falta la imagen');
    const segundo = error(4, 'imagen.alt');
    expect(primerErrorDelDocumento(contenido, [primero, segundo])).toEqual({ bloqueId: ID(6), error: primero });
  });

  it('H2-E5: un error de la imagen destacada no cuenta aunque venga primero', () => {
    const destacada = error(-1, 'imagen_destacada');
    const deBloque = error(4);
    expect(primerErrorDelDocumento(contenido, [destacada, deBloque])).toEqual({ bloqueId: ID(6), error: deBloque });
  });

  it('H2-E5: devuelve null si no hay errores o ninguno apunta a un bloque', () => {
    expect(primerErrorDelDocumento(contenido, [])).toBeNull();
    expect(primerErrorDelDocumento(contenido, [error(-1, 'imagen_destacada')])).toBeNull();
    expect(primerErrorDelDocumento(contenido, [error(50)])).toBeNull();
  });
});
