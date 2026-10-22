// T074 (spec 003, H4, RF-016, RF-017): filtros de la lista de artículos leídos de la dirección. Lógica pura.
// FASE ROJA: `./filtros` no existe aún (T076).
//
// Firmas supuestas, exportadas desde `lib/filtros.ts` (el tipo `FiltrosPanel` es el de `@blog/db`):
//   leerFiltros(searchParams: Record<string, string | string[] | undefined>): FiltrosPanel
//     - `estado`: uno de borrador | programado | publicado | archivado.
//     - `categoria` y `autor`: uuid.
//     - `q`: texto recortado (trim), de 1 a 100 caracteres; vacío tras recortar o de más de 100 se ignora.
//     - `pagina`: entero >= 1; sin valor o inválido, 1 (siempre está presente en el resultado).
//     - Un valor inválido se IGNORA (la clave no aparece), nunca lanza.
//     - Un parámetro repetido (arreglo) toma el primer elemento (sin buscar uno válido en los siguientes).
//   aSearchParams(filtros: FiltrosPanel): URLSearchParams
//     - Omite los vacíos / indefinidos y `pagina` 1; es la inversa de `leerFiltros`.
import type { FiltrosPanel } from '@blog/db';
import { describe, expect, it } from 'vitest';
import { aSearchParams, leerFiltros } from './filtros';

const UUID_A = '5d1c8f0e-3a52-4b8e-9f1f-0a6f1c2b7d90';
const UUID_B = '00000000-0000-4000-a000-000000000002';

describe('leerFiltros', () => {
  it('RF-016: sin parámetros devuelve solo la página 1', () => {
    expect(leerFiltros({})).toEqual({ pagina: 1 });
  });

  it('RF-016: lee todos los filtros válidos', () => {
    const filtros = leerFiltros({
      estado: 'programado',
      categoria: UUID_A,
      autor: UUID_B,
      q: 'diseño',
      pagina: '3',
    });
    expect(filtros).toEqual({ estado: 'programado', categoria: UUID_A, autor: UUID_B, q: 'diseño', pagina: 3 });
  });

  it.each(['borrador', 'programado', 'publicado', 'archivado'])('RF-016: acepta el estado "%s"', (estado) => {
    expect(leerFiltros({ estado }).estado).toBe(estado);
  });

  it('RF-016: ignora un estado que no existe', () => {
    expect(leerFiltros({ estado: 'eliminado' })).toEqual({ pagina: 1 });
    expect(leerFiltros({ estado: 'PUBLICADO' })).toEqual({ pagina: 1 });
    expect(leerFiltros({ estado: '' })).toEqual({ pagina: 1 });
  });

  it('RF-016: ignora una categoría o un autor que no son uuid', () => {
    expect(leerFiltros({ categoria: 'diseno', autor: '123' })).toEqual({ pagina: 1 });
    expect(leerFiltros({ categoria: '', autor: '' })).toEqual({ pagina: 1 });
  });

  it('RF-016: un filtro inválido no anula a los válidos', () => {
    expect(leerFiltros({ estado: 'nada', categoria: UUID_A })).toEqual({ categoria: UUID_A, pagina: 1 });
  });

  it('RF-017: recorta los espacios del texto de búsqueda', () => {
    expect(leerFiltros({ q: '  diseño  ' }).q).toBe('diseño');
  });

  it('RF-017: ignora un texto vacío o de solo espacios', () => {
    expect(leerFiltros({ q: '' })).toEqual({ pagina: 1 });
    expect(leerFiltros({ q: '   ' })).toEqual({ pagina: 1 });
  });

  it('RF-017: acepta un texto de exactamente 100 caracteres', () => {
    const q = 'a'.repeat(100);
    expect(leerFiltros({ q }).q).toBe(q);
  });

  it('RF-017: ignora un texto de más de 100 caracteres', () => {
    expect(leerFiltros({ q: 'a'.repeat(101) })).toEqual({ pagina: 1 });
  });

  it.each([
    ['2', 2],
    ['10', 10],
    ['1', 1],
  ])('RF-016: la página "%s" es %i', (pagina, esperada) => {
    expect(leerFiltros({ pagina }).pagina).toBe(esperada);
  });

  it.each(['0', '-1', '1.5', 'abc', '', '2abc', ' '])('RF-016: la página inválida "%s" vuelve a 1', (pagina) => {
    expect(leerFiltros({ pagina }).pagina).toBe(1);
  });

  it('un parámetro repetido toma el primero', () => {
    const filtros = leerFiltros({ estado: ['publicado', 'borrador'], q: ['uno', 'dos'], pagina: ['4', '2'] });
    expect(filtros).toEqual({ estado: 'publicado', q: 'uno', pagina: 4 });
  });

  it('un parámetro repetido cuyo primer valor es inválido se ignora', () => {
    expect(leerFiltros({ estado: ['nada', 'publicado'] })).toEqual({ pagina: 1 });
  });

  it('un arreglo vacío o un parámetro indefinido se ignoran', () => {
    expect(leerFiltros({ estado: [], q: undefined, autor: undefined })).toEqual({ pagina: 1 });
  });

  it('nunca lanza con valores hostiles', () => {
    expect(() =>
      leerFiltros({ estado: '<script>', categoria: "' or 1=1 --", autor: '%00', q: '\u0000', pagina: '9'.repeat(400) }),
    ).not.toThrow();
  });

  it('ignora los parámetros desconocidos', () => {
    expect(leerFiltros({ orden: 'titulo', x: '1' })).toEqual({ pagina: 1 });
  });
});

describe('aSearchParams', () => {
  it('RF-016: sin filtros devuelve parámetros vacíos', () => {
    expect(aSearchParams({}).toString()).toBe('');
    expect(aSearchParams({ pagina: 1 }).toString()).toBe('');
  });

  it('RF-016: incluye cada filtro presente', () => {
    const params = aSearchParams({ estado: 'archivado', categoria: UUID_A, autor: UUID_B, q: 'café', pagina: 2 });
    expect(Object.fromEntries(params)).toEqual({
      estado: 'archivado',
      categoria: UUID_A,
      autor: UUID_B,
      q: 'café',
      pagina: '2',
    });
  });

  it('RF-016: omite los vacíos, los indefinidos y la página 1', () => {
    const params = aSearchParams({ estado: undefined, categoria: '', q: '', pagina: 1 });
    expect(params.toString()).toBe('');
  });

  it('RF-017: codifica el texto de búsqueda para la dirección', () => {
    const params = aSearchParams({ q: 'a&b=c ñ' });
    expect(params.toString()).not.toContain('&b=');
    expect(params.get('q')).toBe('a&b=c ñ');
  });

  it('devuelve una instancia de URLSearchParams', () => {
    expect(aSearchParams({ estado: 'borrador' })).toBeInstanceOf(URLSearchParams);
  });
});

describe('aSearchParams es la inversa de leerFiltros', () => {
  const casos: FiltrosPanel[] = [
    { pagina: 1 },
    { estado: 'publicado', pagina: 1 },
    { estado: 'programado', categoria: UUID_A, pagina: 1 },
    { autor: UUID_B, q: 'tipografía y color', pagina: 5 },
    { estado: 'borrador', categoria: UUID_A, autor: UUID_B, q: 'ñandú & café = 100%', pagina: 12 },
  ];

  it.each(casos)('RF-016: ida y vuelta de %o', (filtros) => {
    expect(leerFiltros(Object.fromEntries(aSearchParams(filtros)))).toEqual(filtros);
  });

  it('RF-016: la vuelta de una dirección canónica la reproduce', () => {
    const original = new URLSearchParams({ estado: 'archivado', q: 'oferta', pagina: '2' });
    const filtros = leerFiltros(Object.fromEntries(original));
    expect(Object.fromEntries(aSearchParams(filtros))).toEqual(Object.fromEntries(original));
  });
});
