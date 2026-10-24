// T047 (spec 005, H2 esc. 5; research D6 "Errores por id, no por posición"; contracts/componentes.md "limites.ts y
// mapa-errores.ts"). Adaptado al documento en T098 (ampliación; contracts/documento.md "Errores"): el documento
// guardado es el del editor y cada `ErrorElemento` ya trae el `id` de su elemento, así que no hace falta convertir
// a bloques para ubicarlo. El editor marca el elemento por `id`.
//
// Firmas propuestas (T110), exportadas desde './mapa-errores' (funciones puras):
//   erroresPorId(documento: Documento, errores: ErrorElemento[]): Map<string, ErrorElemento[]>
//     - La clave es `error.id` y el valor, los errores de ese elemento en el orden recibido.
//     - Se ignoran los errores del documento o de la imagen destacada (`indice < 0`) y los que apuntan a un id que ya
//       no está en el documento (obsoletos).
//   primerErrorDelDocumento(documento: Documento, errores: ErrorElemento[]): { id: string; error: ErrorElemento } | null
//     - El error del elemento que aparece primero en el documento (por su posición, no por `indice`); si un elemento
//       tiene varios, el primero recibido. `null` si ningún error apunta a un elemento del documento.
import type { Documento, ErrorElemento } from '@blog/bloques';
import { describe, expect, it } from 'vitest';
import { erroresPorId, primerErrorDelDocumento } from './mapa-errores';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const parrafo = (n: number, texto: string) => ({
  type: 'paragraph',
  attrs: { id: ID(n) },
  content: [{ type: 'text', text: texto }],
});
const imagen = (n: number) => ({
  type: 'imagen',
  attrs: { id: ID(n), imagen: { ruta: '', ancho: 0, alto: 0, alt: '', decorativa: false } },
});

/** 0 párrafo A · 1 imagen · 2 párrafo B · 3 separador · 4 imagen. */
const documento = {
  type: 'doc',
  content: [parrafo(1, 'A'), imagen(2), parrafo(3, 'B'), { type: 'horizontalRule', attrs: { id: ID(4) } }, imagen(5)],
} as unknown as Documento;

const error = (
  n: number,
  indice: number,
  campo = 'imagen.alt',
  mensaje = 'Falta el texto alternativo',
): ErrorElemento => ({
  indice,
  id: n < 0 ? '' : ID(n),
  campo,
  mensaje,
});

describe('erroresPorId (H2-E5): los errores se ubican por el id del elemento', () => {
  it('H2-E5: el error de la primera imagen queda bajo su id', () => {
    const mapa = erroresPorId(documento, [error(2, 1)]);

    expect([...mapa.keys()]).toEqual([ID(2)]);
    expect(mapa.get(ID(2))).toEqual([error(2, 1)]);
  });

  it('H2-E5: usa el id aunque el índice haya quedado viejo (el elemento se movió)', () => {
    const mapa = erroresPorId(documento, [error(5, 0)]);

    expect([...mapa.keys()]).toEqual([ID(5)]);
  });

  it('H2-E5: varios errores del mismo elemento se agrupan en el orden recibido', () => {
    const a = error(5, 4, 'imagen.ruta', 'Falta la imagen');
    const b = error(5, 4, 'imagen.alt');

    expect(erroresPorId(documento, [a, b]).get(ID(5))).toEqual([a, b]);
  });

  it('H2-E5: los errores de elementos distintos quedan en claves distintas', () => {
    const mapa = erroresPorId(documento, [error(2, 1), error(5, 4)]);

    expect([...mapa.keys()].sort()).toEqual([ID(2), ID(5)].sort());
  });

  it('H2-E5: un error de la imagen destacada (indice -1) no se asigna a ningún elemento', () => {
    expect(erroresPorId(documento, [error(-1, -1, 'imagen_destacada')]).size).toBe(0);
  });

  it('H2-E5: un error con un id que ya no está en el documento (obsoleto) se ignora sin fallar', () => {
    expect(erroresPorId(documento, [error(99, 0)]).size).toBe(0);
  });

  it('H2-E5: sin errores, o con el documento vacío, el mapa está vacío', () => {
    expect(erroresPorId(documento, []).size).toBe(0);
    expect(erroresPorId({ type: 'doc', content: [] } as unknown as Documento, [error(1, 0)]).size).toBe(0);
  });
});

describe('primerErrorDelDocumento (H2-E5): el primero por orden del documento', () => {
  it('H2-E5: devuelve el del elemento que aparece antes, sin importar el orden recibido ni el índice', () => {
    const tardio = error(5, 0);
    const temprano = error(2, 4);

    expect(primerErrorDelDocumento(documento, [tardio, temprano])).toEqual({ id: ID(2), error: temprano });
  });

  it('H2-E5: con varios errores en el mismo elemento, devuelve el primero recibido', () => {
    const primero = error(5, 4, 'imagen.ruta', 'Falta la imagen');
    const segundo = error(5, 4, 'imagen.alt');

    expect(primerErrorDelDocumento(documento, [primero, segundo])).toEqual({ id: ID(5), error: primero });
  });

  it('H2-E5: un error de la imagen destacada no cuenta aunque venga primero', () => {
    const destacada = error(-1, -1, 'imagen_destacada');
    const deElemento = error(5, 4);

    expect(primerErrorDelDocumento(documento, [destacada, deElemento])).toEqual({ id: ID(5), error: deElemento });
  });

  it('H2-E5: devuelve null si no hay errores o ninguno apunta a un elemento del documento', () => {
    expect(primerErrorDelDocumento(documento, [])).toBeNull();
    expect(primerErrorDelDocumento(documento, [error(-1, -1, 'imagen_destacada')])).toBeNull();
    expect(primerErrorDelDocumento(documento, [error(50, 2)])).toBeNull();
  });
});
