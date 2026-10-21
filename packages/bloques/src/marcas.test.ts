// T015 (spec 003): marcas Markdown inline del editor (D9 de la 001, D12, H2-E2).
// Firma supuesta (T031): `aplicarMarca(texto, { inicio, fin }, marca)` devuelve
// `{ texto, seleccion: { inicio, fin } }` (índices de caracteres; `fin` exclusivo), exportada desde
// './marcas'. Para `enlace` se usa la URL marcadora `url` (`[sel](url)`); la selección devuelta
// apunta a esa palabra `url` para que se reemplace al escribir.
import { describe, expect, it } from 'vitest';
import { aplicarMarca } from './marcas';

describe('aplicarMarca con selección', () => {
  it.each([
    ['negrita', 'Hola mundo lindo', { inicio: 5, fin: 10 }, 'Hola **mundo** lindo'],
    ['cursiva', 'Hola mundo lindo', { inicio: 5, fin: 10 }, 'Hola _mundo_ lindo'],
    ['codigo', 'Hola mundo lindo', { inicio: 5, fin: 10 }, 'Hola `mundo` lindo'],
    ['enlace', 'Hola mundo lindo', { inicio: 5, fin: 10 }, 'Hola [mundo](url) lindo'],
  ] as const)('H2-E2: %s envuelve la selección', (marca, entrada, seleccion, esperado) => {
    expect(aplicarMarca(entrada, seleccion, marca).texto).toBe(esperado);
  });

  it('H2-E2: negrita, cursiva y código dejan seleccionado el texto envuelto (sin los marcadores)', () => {
    for (const marca of ['negrita', 'cursiva', 'codigo'] as const) {
      const { texto, seleccion } = aplicarMarca('Hola mundo lindo', { inicio: 5, fin: 10 }, marca);

      expect(texto.slice(seleccion.inicio, seleccion.fin), marca).toBe('mundo');
    }
  });

  it('H2-E2: enlace deja seleccionada la URL marcadora para escribirla enseguida', () => {
    const { texto, seleccion } = aplicarMarca('Hola mundo lindo', { inicio: 5, fin: 10 }, 'enlace');

    expect(texto.slice(seleccion.inicio, seleccion.fin)).toBe('url');
  });

  it('H2-E2: envuelve la selección completa y la que está al final del texto', () => {
    expect(aplicarMarca('todo', { inicio: 0, fin: 4 }, 'negrita').texto).toBe('**todo**');
    expect(aplicarMarca('final', { inicio: 2, fin: 5 }, 'cursiva').texto).toBe('fi_nal_');
  });
});

describe('aplicarMarca sin selección', () => {
  it.each([
    ['negrita', '****'],
    ['cursiva', '__'],
    ['codigo', '``'],
    ['enlace', '[](url)'],
  ] as const)('H2-E2: %s inserta los marcadores vacíos en el cursor', (marca, vacio) => {
    const { texto } = aplicarMarca('ab', { inicio: 1, fin: 1 }, marca);

    expect(texto).toBe(`a${vacio}b`);
  });

  it('H2-E2: deja el cursor entre los marcadores (negrita, cursiva y código)', () => {
    const casos = [
      ['negrita', 2],
      ['cursiva', 1],
      ['codigo', 1],
    ] as const;
    for (const [marca, ancho] of casos) {
      const { texto, seleccion } = aplicarMarca('ab', { inicio: 1, fin: 1 }, marca);

      expect(seleccion, marca).toEqual({ inicio: 1 + ancho, fin: 1 + ancho });
      expect(texto.length, marca).toBe(2 + 2 * ancho);
    }
  });

  it('H2-E2: en un texto vacío inserta los marcadores', () => {
    expect(aplicarMarca('', { inicio: 0, fin: 0 }, 'negrita').texto).toBe('****');
  });
});

describe('aplicarMarca: pureza', () => {
  it('no muta la selección de entrada', () => {
    const seleccion = { inicio: 5, fin: 10 };
    const copia = { ...seleccion };

    aplicarMarca('Hola mundo lindo', seleccion, 'negrita');

    expect(seleccion).toEqual(copia);
  });

  it('devuelve un objeto nuevo en cada llamada', () => {
    const a = aplicarMarca('uno', { inicio: 0, fin: 3 }, 'codigo');
    const b = aplicarMarca('uno', { inicio: 0, fin: 3 }, 'codigo');

    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.seleccion).not.toBe(b.seleccion);
  });
});
