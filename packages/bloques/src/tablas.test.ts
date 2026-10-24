// T132 (spec 005, Fase 13, Historia 7; RF-025, RF-028; contracts/documento.md "Tablas"; research D29 y D31 C13):
// pruebas de la cuadrícula de tablas, regularidad, esRectangulo y límites.
//
// FASE ROJA: este archivo se escribe antes de implementar `packages/bloques/src/tablas.ts` (T138).
import { describe, expect, it } from 'vitest';
import {
  cuadricula,
  esRectangulo,
  LIMITES_TABLA,
  type CeldaEstructural,
  type FilaEstructural,
  type TablaEstructural,
} from './tablas';

const celda = (
  tipo: 'tableCell' | 'tableHeader' = 'tableCell',
  attrs?: { colspan?: number; rowspan?: number },
  texto?: string,
): CeldaEstructural => ({
  type: tipo,
  ...(attrs ? { attrs } : {}),
  content: texto ? [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }] : [{ type: 'paragraph' }],
});

const fila = (...celdas: CeldaEstructural[]): FilaEstructural => ({
  type: 'tableRow',
  content: celdas,
});

const tabla = (
  filas: FilaEstructural[],
  attrs: { id?: string; descripcion?: string } = { id: '00000000-0000-4000-9000-000000000001' },
): TablaEstructural => ({
  type: 'table',
  attrs,
  content: filas,
});

describe('LIMITES_TABLA', () => {
  it('define los límites normativos del contrato', () => {
    expect(LIMITES_TABLA.MIN_FILAS).toBe(1);
    expect(LIMITES_TABLA.MAX_FILAS).toBe(50);
    expect(LIMITES_TABLA.MIN_COLUMNAS).toBe(1);
    expect(LIMITES_TABLA.MAX_COLUMNAS).toBe(10);
    expect(LIMITES_TABLA.MAX_CARACTERES_CELDA).toBe(1000);
    expect(LIMITES_TABLA.MAX_CARACTERES_DESCRIPCION).toBe(150);
  });
});

describe('cuadricula: regularidad y dimensiones', () => {
  it('calcula dimensiones de una tabla simple 3x3', () => {
    const t = tabla([
      fila(celda('tableHeader'), celda('tableHeader'), celda('tableHeader')),
      fila(celda(), celda(), celda()),
      fila(celda(), celda(), celda()),
    ]);
    const res = cuadricula(t);
    expect(res.esRegular).toBe(true);
    expect(res.filas).toBe(3);
    expect(res.columnas).toBe(3);
    expect(res.tieneEncabezado).toBe(true);
  });

  it('calcula dimensiones con celdas combinadas horizontales (colspan)', () => {
    const t = tabla([
      fila(celda('tableHeader', { colspan: 2 }), celda('tableHeader')),
      fila(celda(), celda(), celda()),
    ]);
    const res = cuadricula(t);
    expect(res.esRegular).toBe(true);
    expect(res.filas).toBe(2);
    expect(res.columnas).toBe(3);
  });

  it('calcula dimensiones con celdas combinadas verticales (rowspan)', () => {
    const t = tabla([fila(celda('tableCell', { rowspan: 2 }), celda(), celda()), fila(celda(), celda())]);
    const res = cuadricula(t);
    expect(res.esRegular).toBe(true);
    expect(res.filas).toBe(2);
    expect(res.columnas).toBe(3);
  });

  it('detecta irregularidad cuando una fila tiene menos columnas sin cubrir por rowspan', () => {
    const t = tabla([
      fila(celda(), celda(), celda()),
      fila(celda(), celda()), // solo 2 columnas
    ]);
    const res = cuadricula(t);
    expect(res.esRegular).toBe(false);
  });

  it('detecta irregularidad por superposición de celdas combinadas', () => {
    // La celda (0,0) tiene colspan: 2 y la segunda celda también se declara ocupando la columna 1
    const t = tabla([fila(celda('tableCell', { colspan: 2 }), celda(), celda()), fila(celda(), celda(), celda())]);
    const res = cuadricula(t);
    // 1 (colspan 2) + 1 + 1 = 4 columnas en la fila 0 frente a 3 en la fila 1
    expect(res.esRegular).toBe(false);
  });

  it('rechaza tablas que superen el máximo de 10 columnas', () => {
    const celdas = Array.from({ length: 11 }, () => celda());
    const t = tabla([fila(...celdas)]);
    const res = cuadricula(t);
    expect(res.columnas).toBe(11);
    expect(res.dentroDeLimites).toBe(false);
  });

  it('rechaza tablas que superen el máximo de 50 filas', () => {
    const filas = Array.from({ length: 51 }, () => fila(celda()));
    const t = tabla(filas);
    const res = cuadricula(t);
    expect(res.filas).toBe(51);
    expect(res.dentroDeLimites).toBe(false);
  });

  it('detecta encabezado solo si todas las celdas de la primera fila son tableHeader', () => {
    const conEncabezado = tabla([
      fila(celda('tableHeader'), celda('tableHeader')),
      fila(celda('tableCell'), celda('tableCell')),
    ]);
    expect(cuadricula(conEncabezado).tieneEncabezado).toBe(true);

    const mixto = tabla([fila(celda('tableHeader'), celda('tableCell')), fila(celda('tableCell'), celda('tableCell'))]);
    expect(cuadricula(mixto).tieneEncabezado).toBe(false);
  });

  it('detecta si tableHeader aparece fuera de la primera fila', () => {
    const invalido = tabla([
      fila(celda('tableHeader'), celda('tableHeader')),
      fila(celda('tableHeader'), celda('tableCell')), // header en fila 1
    ]);
    const res = cuadricula(invalido);
    expect(res.encabezadoValido).toBe(false);
  });

  it('detecta si una celda tableHeader tiene rowspan mayor a 1', () => {
    const invalido = tabla([
      fila(celda('tableHeader', { rowspan: 2 }), celda('tableHeader')),
      fila(celda('tableCell')),
    ]);
    const res = cuadricula(invalido);
    expect(res.encabezadoValido).toBe(false);
  });

  it('asocia los encabezados (headers H43) correspondientes a cada celda', () => {
    const t = tabla([
      fila(celda('tableHeader', { colspan: 2 }, 'Cabecera 1 y 2'), celda('tableHeader', undefined, 'Cabecera 3')),
      fila(
        celda('tableCell', undefined, 'Dato 1'),
        celda('tableCell', undefined, 'Dato 2'),
        celda('tableCell', undefined, 'Dato 3'),
      ),
    ]);
    const res = cuadricula(t);
    expect(res.esRegular).toBe(true);
    // La celda (1,0) debe asociarse al encabezado (0,0)
    expect(res.celdas[1]![0]!.encabezadosColumna).toContain('col-0');
    // La celda (1,1) también se asocia al encabezado (0,0) por su colspan
    expect(res.celdas[1]![1]!.encabezadosColumna).toContain('col-0');
    // La celda (1,2) se asocia al encabezado (0,2)
    expect(res.celdas[1]![2]!.encabezadosColumna).toContain('col-2');
  });
});

describe('esRectangulo', () => {
  it('un conjunto vacío o de una sola celda es rectángulo', () => {
    expect(esRectangulo([])).toBe(false);
    expect(esRectangulo([{ fila: 0, columna: 0 }])).toBe(true);
  });

  it('una selección continua 2x2 es un rectángulo válido', () => {
    const celdas = [
      { fila: 0, columna: 0 },
      { fila: 0, columna: 1 },
      { fila: 1, columna: 0 },
      { fila: 1, columna: 1 },
    ];
    expect(esRectangulo(celdas)).toBe(true);
  });

  it('una selección en forma de L no es un rectángulo', () => {
    const celdas = [
      { fila: 0, columna: 0 },
      { fila: 0, columna: 1 },
      { fila: 1, columna: 0 },
    ];
    expect(esRectangulo(celdas)).toBe(false);
  });

  it('celdas inconexas no forman un rectángulo', () => {
    const celdas = [
      { fila: 0, columna: 0 },
      { fila: 2, columna: 2 },
    ];
    expect(esRectangulo(celdas)).toBe(false);
  });
});
