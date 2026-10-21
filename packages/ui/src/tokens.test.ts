// T019 (spec 002): una sola identidad (constitucion.md §VII.6) y contraste WCAG 2.1 AA (§VII.4).
// Lee tokens.css como texto; la conversión OKLCH → sRGB → luminancia relativa está acá,
// sin dependencias (plan.md, "Impacto en UI y tokens"; análisis C1).
// La referencia a vitest/node trae los tipos de Node (node:fs) sin agregar @types/node.
/// <reference types="vitest/node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { identidad } from './identidad';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** Valores de las variables CSS declaradas en tokens.css (sin comentarios). */
const tokens = new Map<string, string>(
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(([, nombre, valor]) => [
    nombre ?? '',
    (valor ?? '').trim(),
  ]),
);

/** Valor de un token, resolviendo `var(--otro)` dentro de tokens.css. */
function valorDe(nombre: string, visitados = new Set<string>()): string {
  const valor = tokens.get(nombre);
  if (valor === undefined) throw new Error(`Falta el token ${nombre} en tokens.css`);
  const referencia = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(valor);
  if (!referencia?.[1]) return valor;
  if (visitados.has(nombre)) throw new Error(`Referencia circular en ${nombre}`);
  return valorDe(referencia[1], visitados.add(nombre));
}

/** Primera familia entre comillas de un token de fuente; tolera `var(--fuente-…, 'Familia', …)` (research D16). */
function familiaDe(nombre: string): string | undefined {
  return /['"]([^'"]+)['"]/.exec(valorDe(nombre))?.[1];
}

type Rgb = [number, number, number];

/** oklch(L C h) → sRGB lineal (Björn Ottosson, "A perceptual color space for image processing"). */
function oklchARgbLineal(valor: string): Rgb {
  const partes = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.]+%?\s*)?\)$/.exec(valor);
  if (!partes) throw new Error(`El color no es oklch(L C h): ${valor}`);
  const l = Number(partes[1]) / (partes[2] === '%' ? 100 : 1);
  const croma = Number(partes[3]);
  const tono = (Number(partes[4]) * Math.PI) / 180;
  const a = croma * Math.cos(tono);
  const b = croma * Math.sin(tono);

  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1,
    -1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1,
    -0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1,
  ];
}

const aGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const aLineal = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const recortar = (c: number) => Math.min(1, Math.max(0, c));

/** Luminancia relativa WCAG: sRGB con gamma (recortado al gamut) → lineal → ponderación. */
function luminancia(nombre: string): number {
  const [r, g, b] = oklchARgbLineal(valorDe(nombre)).map((c) => aLineal(recortar(aGamma(c)))) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(primerPlano: string, fondo: string): number {
  const [clara, oscura] = [luminancia(primerPlano), luminancia(fondo)].sort((x, y) => y - x) as [number, number];
  return (clara + 0.05) / (oscura + 0.05);
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
