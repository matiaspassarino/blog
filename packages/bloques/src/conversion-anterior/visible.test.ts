// T112 (spec 005, Historia 5; RF-023, CE-002; research D26 y D31 C2): lo que mostraba el sitio con el formato
// anterior, sin JSX, para que el script de conversión compare lo visible antes y después de convertir.
//
// FASE ROJA: `./visible` no existe. API que se prueba (T119):
//   visibleDeBloques(contenido: Contenido): Visible
//     Sobre `analizarEnLinea`, `partirParrafos` y `anclaDe`. `Visible` es el tipo de `../elementos` (el formato de
//     `pruebas/salida-anterior.json`): un texto por elemento HTML de primer nivel que dibujaba `<Bloques>` (un
//     párrafo con líneas en blanco da un texto por tramo que no está en blanco), las anclas únicas de los títulos, las
//     imágenes (`src`, `alt`, leyenda) y los enlaces (`href` con `hrefSeguro` y texto).
//
// La *fixture* `pruebas/salida-anterior.json` la generó el renderer de bloques (T089) antes de retirarlo, y es fija:
// esta prueba es la que garantiza que el extractor puro dice lo mismo que el renderer que ya no existe.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { visibleDeDocumento, type Visible } from '../elementos';
import { CORPUS_CONTENIDOS } from '../pruebas/corpus-contenido';
import { bloquesADocumento } from './conversion';
import { visibleDeBloques } from './visible';

const FIXTURE = JSON.parse(
  readFileSync(fileURLToPath(new URL('../pruebas/salida-anterior.json', import.meta.url)), 'utf8'),
) as Record<string, Visible>;

const CASOS_DEL_CORPUS = CORPUS_CONTENIDOS.map(({ nombre, contenido }) => [nombre, contenido] as const);

describe('visibleDeBloques: lo que mostraba el renderer de bloques (D26, D31 C2)', () => {
  it('la fixture del renderer anterior tiene una entrada por cada contenido del corpus', () => {
    expect(Object.keys(FIXTURE).sort()).toEqual(CORPUS_CONTENIDOS.map(({ nombre }) => nombre).sort());
  });

  it.each(CASOS_DEL_CORPUS)('CE-002: "%s" coincide con la fixture de T089', (nombre, contenido) => {
    expect(visibleDeBloques(contenido)).toEqual(FIXTURE[nombre]);
  });

  it.each(CASOS_DEL_CORPUS)(
    'RF-023: "%s" se ve igual antes y después de convertir (la verificación de pérdida del script)',
    (_nombre, contenido) => {
      expect(visibleDeDocumento(bloquesADocumento(contenido))).toEqual(visibleDeBloques(contenido));
    },
  );

  it('D26: un párrafo con líneas en blanco da un texto por tramo visible', () => {
    expect(
      visibleDeBloques([
        { id: '11111111-1111-4111-8111-111111111111', tipo: 'parrafo', texto: 'Uno\n\n  \n\nDos\nsigue\n\n' },
      ]).textos,
    ).toEqual(['Uno', 'Dos sigue']);
  });

  it('D26: los títulos repetidos reciben anclas únicas y un título sin letras ni números no lleva', () => {
    const visible = visibleDeBloques([
      { id: '11111111-1111-4111-8111-111111111111', tipo: 'titulo', nivel: 2, texto: 'Repetido' },
      { id: '22222222-2222-4222-8222-222222222222', tipo: 'titulo', nivel: 3, texto: 'Repetido' },
      { id: '33333333-3333-4333-8333-333333333333', tipo: 'titulo', nivel: 2, texto: '¡¿?!' },
      { id: '44444444-4444-4444-8444-444444444444', tipo: 'titulo', nivel: 2, texto: 'Contenido' },
    ]);

    expect(visible.anclas).toEqual(['repetido', 'repetido-2', 'contenido-2']);
    expect(visible.textos).toEqual(['Repetido', 'Repetido', '¡¿?!', 'Contenido']);
  });

  it('D26: un enlace inseguro no es un enlace: queda su texto', () => {
    const visible = visibleDeBloques([
      {
        id: '11111111-1111-4111-8111-111111111111',
        tipo: 'parrafo',
        texto: 'Un [clic](javascript:alert(1)) y [bien](/x)',
      },
    ]);

    expect(visible.enlaces).toEqual([{ href: '/x', texto: 'bien' }]);
    expect(visible.textos).toEqual(['Un clic y bien']);
  });

  it('es pura: no modifica el contenido recibido', () => {
    const contenido = CORPUS_CONTENIDOS.find(({ nombre }) => nombre === 'los diez tipos')?.contenido ?? [];
    const copia = structuredClone(contenido);

    visibleDeBloques(contenido);

    expect(contenido).toEqual(copia);
  });
});
