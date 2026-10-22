// T019 (spec 002): una sola identidad (constitucion.md §VII.6) y contraste WCAG 2.1 AA (§VII.4).
// Lee tokens.css como texto; la conversión OKLCH → sRGB → luminancia relativa está acá,
// sin dependencias (plan.md, "Impacto en UI y tokens"; análisis C1).
// La referencia a vitest/node trae los tipos de Node (node:fs) sin agregar @types/node.
/// <reference types="vitest/node" />
import { describe, expect, it } from 'vitest';
import { identidad } from './identidad';
import { contraste, tokens, valorDe } from './pruebas/contraste';

/** Primera familia entre comillas de un token de fuente; tolera `var(--fuente-…, 'Familia', …)` (research D16). */
function familiaDe(nombre: string): string | undefined {
  return /['"]([^'"]+)['"]/.exec(valorDe(nombre))?.[1];
}

describe('identidad (packages/ui/src/identidad.ts)', () => {
  it('§VII.6: exporta fuentes.cuerpo y fuentes.titulos', () => {
    expect(identidad.fuentes.cuerpo).toEqual(expect.any(String));
    expect(identidad.fuentes.titulos).toEqual(expect.any(String));
  });

  it('§VII.6: exporta el logo con src, alt, ancho y alto', () => {
    const { logo } = identidad as unknown as { logo?: { src: unknown; alt: unknown; ancho: unknown; alto: unknown } };

    expect(logo).toBeDefined();
    expect(logo?.src).toBeTruthy();
    expect(logo?.alt).toEqual(expect.any(String));
    expect(String(logo?.alt).trim()).not.toBe('');
    expect(logo?.ancho).toBeGreaterThan(0);
    expect(logo?.alto).toBeGreaterThan(0);
  });

  it('§VII.6: la familia de --font-cuerpo coincide con identidad.fuentes.cuerpo (una sola identidad)', () => {
    expect(familiaDe('--font-cuerpo')).toBe(identidad.fuentes.cuerpo);
  });

  it('§VII.6: la familia de --font-titulos coincide con identidad.fuentes.titulos (una sola identidad)', () => {
    expect(familiaDe('--font-titulos')).toBe(identidad.fuentes.titulos);
  });
});

describe('tokens nuevos de la spec 002 (T031)', () => {
  it.each([
    '--spacing-seccion',
    '--spacing-bloque',
    '--container-lectura',
    '--container-sitio',
    '--text-titulo-1',
    '--text-titulo-2',
    '--text-titulo-3',
    '--color-foco',
    '--color-marca-suave',
    '--aspect-tarjeta',
  ])('existe %s en tokens.css', (nombre) => {
    expect(tokens.has(nombre), `falta ${nombre}`).toBe(true);
  });

  it.each(['--text-titulo-1', '--text-titulo-2', '--text-titulo-3'])('%s es fluido (usa clamp)', (nombre) => {
    expect(tokens.get(nombre) ?? '').toMatch(/^clamp\(/);
  });

  it('--aspect-tarjeta es 16/9', () => {
    expect((tokens.get('--aspect-tarjeta') ?? '').replace(/\s/g, '')).toBe('16/9');
  });
});

describe('contraste WCAG 2.1 AA de los tokens de color (§VII.4)', () => {
  it('control: la conversión da 21:1 entre blanco y negro', () => {
    tokens.set('--control-blanco', 'oklch(1 0 0)');
    tokens.set('--control-negro', 'oklch(0 0 0)');
    expect(contraste('--control-blanco', '--control-negro')).toBeCloseTo(21, 1);
  });

  it.each([
    ['--color-texto', '--color-fondo'],
    ['--color-texto', '--color-superficie'],
    ['--color-texto-suave', '--color-fondo'],
    ['--color-texto-suave', '--color-superficie'],
    ['--color-marca-contraste', '--color-marca'],
    ['--color-texto', '--color-marca-suave'],
    // Validación de la 002 (U-B2, U-M1): pares que el sitio usa.
    ['--color-marca-contraste', '--color-marca-hover'],
    ['--color-marca', '--color-fondo'],
    ['--color-marca', '--color-superficie'],
    ['--color-texto-suave', '--color-marca-suave'],
  ])('texto: %s sobre %s tiene contraste ≥ 4,5:1', (primerPlano, fondo) => {
    expect(contraste(primerPlano, fondo)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['--color-foco', '--color-fondo'],
    ['--color-borde', '--color-fondo'],
    ['--color-borde', '--color-marca-suave'],
  ])('no textual: %s sobre %s tiene contraste ≥ 3:1', (primerPlano, fondo) => {
    expect(contraste(primerPlano, fondo)).toBeGreaterThanOrEqual(3);
  });
});

describe('tokens de estado del panel (spec 003, T005)', () => {
  it.each([
    '--color-advertencia',
    '--color-exito-suave',
    '--color-error-suave',
    '--color-advertencia-suave',
    '--color-exito-borde',
    '--color-error-borde',
    '--color-advertencia-borde',
    '--color-overlay',
    '--tactil-min',
  ])('existe %s en tokens.css', (nombre) => {
    expect(tokens.has(nombre), `falta ${nombre}`).toBe(true);
  });

  it('--tactil-min equivale a 44 px (2,75rem), el área táctil mínima (§VII.4)', () => {
    expect(tokens.get('--tactil-min')).toBe('2.75rem');
  });

  it.each([
    ['--color-exito', '--color-fondo'],
    ['--color-exito', '--color-superficie'],
    ['--color-exito', '--color-exito-suave'],
    ['--color-error', '--color-fondo'],
    ['--color-error', '--color-superficie'],
    ['--color-error', '--color-error-suave'],
    ['--color-advertencia', '--color-fondo'],
    ['--color-advertencia', '--color-superficie'],
    ['--color-advertencia', '--color-advertencia-suave'],
    ['--color-marca', '--color-marca-suave'],
  ])('texto de estado: %s sobre %s tiene contraste ≥ 4,5:1', (primerPlano, fondo) => {
    expect(contraste(primerPlano, fondo)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['--color-exito-borde', '--color-fondo'],
    ['--color-error-borde', '--color-fondo'],
    ['--color-advertencia-borde', '--color-fondo'],
    ['--color-foco', '--color-superficie'],
    ['--color-foco', '--color-marca-suave'],
    ['--color-foco', '--color-exito-suave'],
    ['--color-foco', '--color-error-suave'],
    ['--color-foco', '--color-advertencia-suave'],
  ])('no textual: %s sobre %s tiene contraste ≥ 3:1', (primerPlano, fondo) => {
    expect(contraste(primerPlano, fondo)).toBeGreaterThanOrEqual(3);
  });
});
