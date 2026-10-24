// T036 (spec 005, RF-003, RF-005; contracts/atajos.md "Atajos de escritura (reglas de entrada)"): las dos funciones
// puras que deciden las reglas de entrada y la apertura del menú «/». Las reglas de ProseMirror que las usan, los
// atajos de formato y el menú se prueban en E2E (editor-documento.spec.ts).
// FASE ROJA: `./atajos` no existe. API supuesta:
//   type AtajoDeEscritura =
//     | { tipo: 'titulo'; nivel: 2 | 3 | 4 }
//     | { tipo: 'lista'; ordenada: boolean }
//     | { tipo: 'cita' }
//     | { tipo: 'separador' }
//     | { tipo: 'codigo' }
//   detectarAtajo(textoDeLaLinea: string): AtajoDeEscritura | null
//     `textoDeLaLinea` es TODO el texto del párrafo (con el último carácter ya escrito). Solo hay atajo si ese texto es
//     exactamente el disparador: `## `, `### `, `#### `, `- `, `* `, `1. `, `> ` (con el espacio final), `---` y tres
//     comillas invertidas (sin espacio). Con cualquier otra cosa antes o después (es decir, si la línea no estaba vacía
//     antes del disparador) devuelve null.
//   puedeAbrirMenu(contexto: { antes: string; despues: string }): boolean
//     `antes` y `despues` son el texto del párrafo a la izquierda y a la derecha del «/» recién escrito (sin el «/»).
//     Solo se abre en una línea vacía: ambos vacíos. En medio de un texto o de una URL (`https:/`) no.
import { describe, expect, it } from 'vitest';
import { detectarAtajo, puedeAbrirMenu } from './atajos';

describe('detectarAtajo: disparadores al comienzo de una línea vacía (RF-003)', () => {
  it.each([
    ['## ', { tipo: 'titulo', nivel: 2 }],
    ['### ', { tipo: 'titulo', nivel: 3 }],
    ['#### ', { tipo: 'titulo', nivel: 4 }],
    ['- ', { tipo: 'lista', ordenada: false }],
    ['* ', { tipo: 'lista', ordenada: false }],
    ['1. ', { tipo: 'lista', ordenada: true }],
    ['> ', { tipo: 'cita' }],
    ['---', { tipo: 'separador' }],
    ['```', { tipo: 'codigo' }],
  ])('%j dispara %j', (texto, esperado) => {
    expect(detectarAtajo(texto)).toEqual(esperado);
  });

  it.each([
    ['sin el espacio final de `##`', '##'],
    ['sin el espacio final de `-`', '-'],
    ['sin el espacio final de `1.`', '1.'],
    ['sin el espacio final de `>`', '>'],
    ['solo dos guiones', '--'],
    ['solo dos comillas invertidas', '``'],
    ['título de nivel 1 (no existe)', '# '],
    ['título de nivel 5 (no existe)', '##### '],
    ['lista numerada que no empieza en 1', '2. '],
    ['cuatro guiones', '----'],
    ['cuatro comillas invertidas', '````'],
  ])('no dispara: %s', (_motivo, texto) => {
    expect(detectarAtajo(texto)).toBeNull();
  });

  it.each([
    ['texto antes', 'hola ## '],
    ['un espacio antes', ' ## '],
    ['texto antes de los guiones', 'a---'],
    ['texto antes de la viñeta', 'x- '],
    ['texto después del disparador', '## hola'],
    ['texto después de la viñeta', '- algo'],
    ['texto antes de la cita', 'dijo > '],
  ])('no dispara si la línea no estaba vacía: %s', (_motivo, texto) => {
    expect(detectarAtajo(texto)).toBeNull();
  });

  it('una línea vacía o un texto común no dispara nada', () => {
    expect(detectarAtajo('')).toBeNull();
    expect(detectarAtajo('Un párrafo cualquiera')).toBeNull();
  });
});

describe('puedeAbrirMenu: solo en una línea vacía (RF-005)', () => {
  it('se abre con el «/» en una línea vacía', () => {
    expect(puedeAbrirMenu({ antes: '', despues: '' })).toBe(true);
  });

  it('no se abre en medio de un texto', () => {
    expect(puedeAbrirMenu({ antes: 'hola ', despues: '' })).toBe(false);
    expect(puedeAbrirMenu({ antes: 'hola', despues: ' mundo' })).toBe(false);
    expect(puedeAbrirMenu({ antes: '', despues: 'mundo' })).toBe(false);
  });

  it('no se abre dentro de una URL', () => {
    expect(puedeAbrirMenu({ antes: 'https:/', despues: '' })).toBe(false);
    expect(puedeAbrirMenu({ antes: 'https://ejemplo.com', despues: '' })).toBe(false);
    expect(puedeAbrirMenu({ antes: 'a', despues: 'b' })).toBe(false);
  });
});
