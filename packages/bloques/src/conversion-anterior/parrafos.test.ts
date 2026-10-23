// T015 (spec 005, RF-009, RF-012, CE-002; research D4; contracts/documento.md): partir un párrafo guardado en
// tramos y volver a unirlo sin perder ni un salto de línea.
// FASE ROJA: `./parrafos` no existe. API supuesta (contracts/documento.md):
//   partirParrafos(texto: string): { texto: string; separador: string }[]
//     el separador es la secuencia exacta de saltos que sigue al tramo anterior ("" en el primero); se parte por
//     dos o más saltos de línea seguidos (como `split(/\n{2,}/)` de hoy en Parrafo.tsx).
//   unirParrafos(tramos): string
import { describe, expect, it } from 'vitest';
import { partirParrafos, unirParrafos } from './parrafos';
import { CORPUS_CONTENIDOS, CORPUS_TEXTOS } from '../pruebas/corpus-contenido';

describe('partirParrafos: tramos y separador exacto (RF-012)', () => {
  it('RF-012: un texto sin líneas en blanco da un solo tramo, con separador vacío', () => {
    expect(partirParrafos('Una sola línea')).toEqual([{ texto: 'Una sola línea', separador: '' }]);
  });

  it('RF-012: los saltos simples no parten: siguen dentro del tramo', () => {
    expect(partirParrafos('Uno\ndos\ntres')).toEqual([{ texto: 'Uno\ndos\ntres', separador: '' }]);
  });

  it('RF-012: A\\n\\nB da dos tramos con separador "\\n\\n"', () => {
    expect(partirParrafos('A\n\nB')).toEqual([
      { texto: 'A', separador: '' },
      { texto: 'B', separador: '\n\n' },
    ]);
  });

  it('RF-012: A\\n\\n\\nB conserva el separador exacto de tres saltos', () => {
    expect(partirParrafos('A\n\n\nB')).toEqual([
      { texto: 'A', separador: '' },
      { texto: 'B', separador: '\n\n\n' },
    ]);
  });

  it('RF-012: cada separador es el suyo, no el del primero', () => {
    expect(partirParrafos('A\n\nB\n\n\n\nC')).toEqual([
      { texto: 'A', separador: '' },
      { texto: 'B', separador: '\n\n' },
      { texto: 'C', separador: '\n\n\n\n' },
    ]);
  });

  it('RF-012: A\\n\\n deja un último tramo vacío', () => {
    expect(partirParrafos('A\n\n')).toEqual([
      { texto: 'A', separador: '' },
      { texto: '', separador: '\n\n' },
    ]);
  });

  it('RF-012: un tramo de solo espacios se conserva tal cual', () => {
    expect(partirParrafos('A\n\n  \n\nB')).toEqual([
      { texto: 'A', separador: '' },
      { texto: '  ', separador: '\n\n' },
      { texto: 'B', separador: '\n\n' },
    ]);
  });

  it('RF-012: el texto vacío da un solo tramo vacío', () => {
    expect(partirParrafos('')).toEqual([{ texto: '', separador: '' }]);
  });

  it('RF-012: el primer tramo siempre tiene separador vacío', () => {
    for (const texto of CORPUS_TEXTOS) expect(partirParrafos(texto)[0]?.separador, JSON.stringify(texto)).toBe('');
  });

  it('RF-012: ningún tramo contiene dos saltos seguidos y todo separador tiene al menos dos', () => {
    for (const texto of CORPUS_TEXTOS) {
      for (const [i, tramo] of partirParrafos(texto).entries()) {
        expect(tramo.texto).not.toMatch(/\n{2,}/);
        if (i > 0) expect(tramo.separador).toMatch(/^\n{2,}$/);
      }
    }
  });
});

describe('unirParrafos(partirParrafos(x)) === x (CE-002)', () => {
  it.each(CORPUS_TEXTOS.map((texto) => [JSON.stringify(texto), texto] as const))(
    'CE-002: ida y vuelta del texto %s del corpus',
    (_nombre, texto) => {
      expect(unirParrafos(partirParrafos(texto))).toBe(texto);
    },
  );

  it.each([
    ['A\n\nB'],
    ['A\n\n\nB'],
    ['A\n\n'],
    ['A\n\n  \n\nB'],
    ['\n\n\n\n'],
    ['A\n\n\n\n\n\n\nB'],
  ])('CE-002: ida y vuelta de %j', (texto) => {
    expect(unirParrafos(partirParrafos(texto))).toBe(texto);
  });

  it('CE-002: ida y vuelta de los párrafos del corpus de contenidos', () => {
    const parrafos = CORPUS_CONTENIDOS.flatMap(({ contenido }) =>
      contenido.flatMap((bloque) => (bloque.tipo === 'parrafo' ? [bloque.texto] : [])),
    );
    expect(parrafos.length).toBeGreaterThan(10);

    for (const texto of parrafos) expect(unirParrafos(partirParrafos(texto))).toBe(texto);
  });

  it('CE-002: ida y vuelta de 500 textos al azar hechos de letras, espacios y saltos', () => {
    let estado = 12345;
    const azar = () => {
      estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
      return estado / 4294967296;
    };
    const piezas = ['a', 'b', ' ', '\n', '\n', '\n\n', '  ', '**', 'ñ'];

    for (let i = 0; i < 500; i++) {
      const texto = Array.from({ length: Math.floor(azar() * 16) }, () => piezas[Math.floor(azar() * piezas.length)]).join('');

      expect(unirParrafos(partirParrafos(texto)), JSON.stringify(texto)).toBe(texto);
    }
  });
});
