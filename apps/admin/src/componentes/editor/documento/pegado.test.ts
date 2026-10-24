// T145 (spec 005, Fase 14, Historia 4; RF-015; research D28):
// pruebas unitarias de pegado y división de párrafos que superan el límite de caracteres:
// - partir un párrafo que supera 5000 caracteres cortando en fin de oración o de palabra, nunca a mitad de palabra
// - conteo exacto de texto sin marcas
// - títulos, citas, ítems, celdas y código no crean otros elementos
// - copiar y pegar elementos nunca duplica ids
// - tablas pegadas dentro de los límites (combinaciones válidas se conservan, inválidas se separan con aviso)
// - tablas pegadas que superan 10 columnas o 50 filas se pegan como texto plano con aviso
//
// FASE ROJA: este test se escribe antes de implementar `pegado.ts` (T148).
import { describe, expect, it } from 'vitest';
import {
  limpiarIdsDeNodos,
  partirTexto,
  procesarTablaPegada,
  restringirTextoPorTipo,
} from './pegado';

describe('partirTexto: divide párrafos que superan 5000 caracteres (RF-015, D28)', () => {
  it('un texto de hasta 5000 caracteres no se divide', () => {
    const corto = 'Hola mundo, este es un párrafo normal.';
    const partes = partirTexto(corto);
    expect(partes).toEqual([corto]);
  });

  it('un texto de exactamente 5000 caracteres no se divide', () => {
    const exacto = 'a'.repeat(5000);
    const partes = partirTexto(exacto);
    expect(partes).toEqual([exacto]);
  });

  it('corta en fin de oración (". ") cuando es posible', () => {
    const oracion1 = 'Primera oración ' + 'de relleno '.repeat(450) + 'con punto final.';
    const oracion2 = 'Segunda oración que debe quedar en el siguiente párrafo.';
    const textoCompleto = `${oracion1} ${oracion2}`;

    const partes = partirTexto(textoCompleto, 5000);
    expect(partes.length).toBeGreaterThanOrEqual(2);
    // Cada parte no supera los 5000 caracteres
    for (const parte of partes) {
      expect(parte.length).toBeLessThanOrEqual(5000);
    }
    // La primera parte termina en punto
    expect(partes[0]?.trim().endsWith('.')).toBe(true);
    // No se pierde texto de oracion2
    expect(partes[1]).toContain('Segunda oración');
  });

  it('corta en fin de palabra (espacio) si no hay fin de oración cercano, nunca a mitad de palabra', () => {
    // 6000 caracteres formados por palabras de 8 letras separadas por espacio sin puntos
    const palabras = Array.from({ length: 650 }, (_, i) => `palabra${i}`);
    const textoSinPuntos = palabras.join(' ');

    const partes = partirTexto(textoSinPuntos, 5000);
    expect(partes.length).toBe(2);
    for (const parte of partes) {
      expect(parte.length).toBeLessThanOrEqual(5000);
      // Ninguna parte termina ni empieza a mitad de una palabra
      const palabrasDeParte = parte.split(/\s+/);
      for (const p of palabrasDeParte) {
        expect(p).toMatch(/^palabra\d+$/);
      }
    }
    // Todas las palabras están presentes sin faltar ninguna
    const reconstruido = partes.join(' ');
    expect(reconstruido).toBe(textoSinPuntos);
  });

  it('un párrafo de 12 000 caracteres se divide en 3 párrafos sin perder texto', () => {
    const parrafoLargo = Array.from({ length: 1150 }, (_, i) => `termino${i}`).join(' ');
    expect(parrafoLargo.length).toBeGreaterThan(10000);

    const partes = partirTexto(parrafoLargo, 5000);
    expect(partes.length).toBe(3);
    for (const parte of partes) {
      expect(parte.length).toBeLessThanOrEqual(5000);
    }
    const palabrasOriginales = parrafoLargo.split(' ');
    const palabrasPartidas = partes.flatMap((p) => p.split(' '));
    expect(palabrasPartidas).toEqual(palabrasOriginales);
  });
});

describe('restringirTextoPorTipo: en títulos, citas, ítems, celdas y código el sobrante no crea otros elementos', () => {
  it('un título recorta al máximo de 150 caracteres sin crear párrafos', () => {
    const largo = 'T'.repeat(250);
    const resultado = restringirTextoPorTipo('heading', largo);
    expect(resultado.texto.length).toBe(150);
    expect(resultado.sobranteEnParrafos).toBe(false);
  });

  it('una cita recorta al máximo de 1000 caracteres sin crear párrafos', () => {
    const largo = 'C'.repeat(1200);
    const resultado = restringirTextoPorTipo('blockquote', largo);
    expect(resultado.texto.length).toBe(1000);
    expect(resultado.sobranteEnParrafos).toBe(false);
  });

  it('un ítem de lista recorta al máximo de 500 caracteres sin crear párrafos', () => {
    const largo = 'L'.repeat(800);
    const resultado = restringirTextoPorTipo('listItem', largo);
    expect(resultado.texto.length).toBe(500);
    expect(resultado.sobranteEnParrafos).toBe(false);
  });

  it('una celda recorta al máximo de 1000 caracteres sin crear párrafos', () => {
    const largo = 'Celda '.repeat(300);
    const resultado = restringirTextoPorTipo('tableCell', largo);
    expect(resultado.texto.length).toBe(1000);
    expect(resultado.sobranteEnParrafos).toBe(false);
  });

  it('un bloque de código recorta al máximo de 20 000 caracteres sin crear párrafos', () => {
    const largo = 'const x = 1;\n'.repeat(2000); // 26 000 caracteres
    const resultado = restringirTextoPorTipo('codeBlock', largo);
    expect(resultado.texto.length).toBe(20000);
    expect(resultado.sobranteEnParrafos).toBe(false);
  });

  it('un párrafo permite sobrante que pasa a nuevos párrafos', () => {
    const largo = 'P '.repeat(3000); // 6000 caracteres
    const resultado = restringirTextoPorTipo('paragraph', largo);
    expect(resultado.sobranteEnParrafos).toBe(true);
    expect(resultado.parrafos?.length).toBeGreaterThan(1);
  });
});

describe('limpiarIdsDeNodos: pegar elementos nunca duplica ids', () => {
  it('elimina los atributos id de los nodos para que ProseMirror asigne nuevos ids', () => {
    const nodoConId = {
      type: 'imagen',
      attrs: {
        id: '00000000-0000-4000-9000-000000000001',
        leyenda: 'Foto de prueba',
      },
    };
    const limpio = limpiarIdsDeNodos(nodoConId);
    expect(limpio.attrs?.id).toBeUndefined();
    expect(limpio.attrs?.leyenda).toBe('Foto de prueba');
  });

  it('elimina recursivamente los ids en contenidos anidados', () => {
    const estructura = {
      type: 'table',
      attrs: { id: 'tabla-id-1' },
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { id: 'celda-id-1', colspan: 2 },
              content: [
                {
                  type: 'paragraph',
                  attrs: { id: 'parrafo-id-1' },
                  content: [{ type: 'text', text: 'Contenido' }],
                },
              ],
            },
          ],
        },
      ],
    };
    const limpia = limpiarIdsDeNodos(estructura);
    expect(limpia.attrs?.id).toBeUndefined();
    const celda = limpia.content?.[0]?.content?.[0];
    expect(celda?.attrs?.id).toBeUndefined();
    expect(celda?.attrs?.colspan).toBe(2);
    const parrafo = celda?.content?.[0];
    expect(parrafo?.attrs?.id).toBeUndefined();
  });
});

describe('procesarTablaPegada: reglas de tablas pegadas (RF-015, RF-028, D28)', () => {
  it('una tabla pegada dentro de los límites conserva sus filas, columnas y encabezado', () => {
    const tabla3x3 = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H1' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H2' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'D1' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'D2' }] }] },
          ],
        },
      ],
    };

    const res = procesarTablaPegada(tabla3x3);
    expect(res.tabla).toBeDefined();
    expect(res.esTexto).toBe(false);
    expect(res.anuncio).toBe('Se pegó una tabla de 2 filas y 2 columnas');
  });

  it('una tabla pegada con más de 10 columnas se convierte a párrafos de texto con aviso', () => {
    const filasCon12Cols = [
      {
        type: 'tableRow',
        content: Array.from({ length: 12 }, (_, i) => ({
          type: 'tableCell',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: `Celda ${i + 1}` }] }],
        })),
      },
    ];
    const tabla12Cols = { type: 'table', content: filasCon12Cols };

    const res = procesarTablaPegada(tabla12Cols);
    expect(res.esTexto).toBe(true);
    expect(res.tabla).toBeUndefined();
    expect(res.anuncio).toBe('La tabla supera el máximo de filas o columnas: se pegó como texto');
    expect(res.parrafos?.length).toBe(12);
  });

  it('una tabla pegada con más de 50 filas se convierte a párrafos de texto con aviso', () => {
    const filas55 = Array.from({ length: 55 }, (_, i) => ({
      type: 'tableRow',
      content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Fila ${i + 1}` }] }] }],
    }));
    const tabla55Filas = { type: 'table', content: filas55 };

    const res = procesarTablaPegada(tabla55Filas);
    expect(res.esTexto).toBe(true);
    expect(res.tabla).toBeUndefined();
    expect(res.anuncio).toBe('La tabla supera el máximo de filas o columnas: se pegó como texto');
    expect(res.parrafos?.length).toBe(55);
  });

  it('separa celdas combinadas si no forman un rectángulo o mezclan encabezado y cuerpo', () => {
    // Combinación irregular que mezcla encabezado con cuerpo
    const tablaInvalida = {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', attrs: { rowspan: 2 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H1' }] }] },
            { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H2' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'D2' }] }] },
          ],
        },
      ],
    };

    const res = procesarTablaPegada(tablaInvalida);
    expect(res.tabla).toBeDefined();
    expect(res.esTexto).toBe(false);
    expect(res.celdasSeparadas).toBe(true);
    expect(res.avisoSeparadas).toBe('Se separaron celdas combinadas que no forman un rectángulo');
  });
});
