// T059 (spec 002): paginación única de los listados (contracts/rutas.md, "Reglas transversales";
// RF-010, H2-E5, H2-E6). `resolverPagina` recibe el parámetro de la ruta tal como llega:
// - `undefined`: la página 1 de `[...pagina]` (/blog, categoría, etiqueta y autor);
// - `'pagina/<n>'`: las páginas siguientes de `[...pagina]`.
// Cualquier otro formato es 404: una sola URL por página (validación C-B1).
// Devuelve qué hacer, no la URL: la página arma la URL sin paginar para la redirección.
import { describe, expect, it } from 'vitest';
import { fueraDeRango, resolverPagina } from './paginacion';

/** Forma esperada del resultado (misma convención de `tipo` que `resolverEntidad`). */
type ResultadoEsperado = { tipo: 'pagina'; numero: number } | { tipo: 'redireccion' } | { tipo: 'no_encontrado' };

const pagina = (numero: number): ResultadoEsperado => ({ tipo: 'pagina', numero });
const redireccion: ResultadoEsperado = { tipo: 'redireccion' };
const noEncontrado: ResultadoEsperado = { tipo: 'no_encontrado' };

describe('resolverPagina', () => {
  it('RF-010: sin parámetro (la URL sin paginar de [...pagina]) es la página 1', () => {
    expect(resolverPagina(undefined)).toEqual(pagina(1));
  });

  it('RF-010: "pagina/2" (formato de [...pagina]) es la página 2', () => {
    expect(resolverPagina('pagina/2')).toEqual(pagina(2));
  });

  it('RF-010: un número grande es una página válida (el rango se verifica con fueraDeRango)', () => {
    expect(resolverPagina('pagina/99')).toEqual(pagina(99));
  });

  it('validación C-B1: el número solo ("2", "1", "99") es 404, no duplica /pagina/<n>', () => {
    expect(resolverPagina('2')).toEqual(noEncontrado);
    expect(resolverPagina('1')).toEqual(noEncontrado);
    expect(resolverPagina('99')).toEqual(noEncontrado);
  });

  it('H2-E6: "pagina/1" redirige a la URL sin paginar', () => {
    expect(resolverPagina('pagina/1')).toEqual(redireccion);
  });

  describe('H2-E5: lo que no es un entero positivo responde 404', () => {
    for (const parametro of ['0', '-1', '2.5', 'abc', 'pagina/x', 'pagina/0', 'pagina/-1', 'pagina/2.5']) {
      it(`"${parametro}" → no_encontrado`, () => {
        expect(resolverPagina(parametro)).toEqual(noEncontrado);
      });
    }
  });

  describe('H2-E5: formatos que no son de paginación responden 404', () => {
    // Ceros a la izquierda, signos, notación científica y segmentos de más darían URLs duplicadas
    // de una misma página: solo hay una forma válida de escribir cada número.
    for (const parametro of ['02', '+2', '1e1', ' 2', 'pagina', 'pagina/', 'pagina/2/3', 'otra/2', '2/pagina']) {
      it(`"${parametro}" → no_encontrado`, () => {
        expect(resolverPagina(parametro)).toEqual(noEncontrado);
      });
    }
  });
});

describe('fueraDeRango', () => {
  it('RF-010: una página dentro del total no está fuera de rango', () => {
    expect(fueraDeRango(1, 2)).toBe(false);
    expect(fueraDeRango(2, 2)).toBe(false);
  });

  it('H2-E5: una página mayor que el total está fuera de rango (404)', () => {
    expect(fueraDeRango(3, 2)).toBe(true);
    expect(fueraDeRango(99, 2)).toBe(true);
  });

  it('H2-E7: sin artículos (0 páginas) la página 1 existe y muestra el estado vacío', () => {
    expect(fueraDeRango(1, 0)).toBe(false);
  });

  it('H2-E5: sin artículos, la página 2 está fuera de rango', () => {
    expect(fueraDeRango(2, 0)).toBe(true);
  });
});
