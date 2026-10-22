// Lectura de tokens.css y contraste WCAG: ayudas de las pruebas de @blog/ui (tokens.test.ts, clases.test.ts).
// Lee tokens.css como texto; la conversión OKLCH → sRGB → luminancia relativa está acá, sin dependencias.
// La referencia a vitest/node trae los tipos de Node (node:fs) sin agregar @types/node.
/// <reference types="vitest/node" />
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8');

/** Valores de las variables CSS declaradas en tokens.css (sin comentarios). */
export const tokens = new Map<string, string>(
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(([, nombre, valor]) => [
    nombre ?? '',
    (valor ?? '').trim(),
  ]),
);

/** Valor de un token, resolviendo `var(--otro)` dentro de tokens.css. */
export function valorDe(nombre: string, visitados = new Set<string>()): string {
  const valor = tokens.get(nombre);
  if (valor === undefined) throw new Error(`Falta el token ${nombre} en tokens.css`);
  const referencia = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(valor);
  if (!referencia?.[1]) return valor;
  if (visitados.has(nombre)) throw new Error(`Referencia circular en ${nombre}`);
  return valorDe(referencia[1], visitados.add(nombre));
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

export function contraste(primerPlano: string, fondo: string): number {
  const [clara, oscura] = [luminancia(primerPlano), luminancia(fondo)].sort((x, y) => y - x) as [number, number];
  return (clara + 0.05) / (oscura + 0.05);
}
