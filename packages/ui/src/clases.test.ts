// T003 (spec 004, RF-001, RF-006, RF-007, RF-010, RF-016, CE-004, CE-005; research D1 a D3): `clasesBoton`, la
// única definición del botón (constitución §VII.3).
//
// Firma supuesta (contracts/componentes.md):
//   clasesBoton(variante?: 'primaria' | 'secundaria' | 'terciaria' | 'peligro',
//               opciones?: { tamanio: 'compacto'; soloIcono: true } | { tamanio: 'estandar' | 'compacto'; soloIcono?: false }): string
// El segundo parámetro se invoca por una envoltura sin tipos estrictos para que este archivo compile antes de que
// exista; los tipos del contrato los verifica `apps/admin` (button.test.tsx).
/// <reference types="vitest/node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clasesBoton } from './clases';
import { contraste, tokens, valorDe } from './pruebas/contraste';

type Variante = 'primaria' | 'secundaria' | 'terciaria' | 'peligro';
type Opciones = { tamanio: 'estandar' | 'compacto'; soloIcono?: boolean };

const conOpciones = clasesBoton as unknown as (variante?: Variante, opciones?: Opciones) => string;
const VARIANTES: Variante[] = ['primaria', 'secundaria', 'terciaria', 'peligro'];
const clasesDe = (clases: string) => clases.split(/\s+/).filter(Boolean);

describe('Sitio intacto sin opciones (RF-016, CE-005, research D1)', () => {
  // Texto exacto que devuelve `clasesBoton` hoy y que usan Boton.astro y Cta.tsx. Si no cambia el texto, no cambia
  // el aspecto del sitio.
  const BASE =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-2.5 font-titulos font-semibold transition-colors duration-(--duracion-corta) ease-estandar';
  const PRIMARIA = `${BASE} bg-marca text-marca-contraste hover:bg-marca-hover`;
  const SECUNDARIA = `${BASE} border border-borde bg-fondo text-texto hover:bg-superficie`;
  const PELIGRO = `${BASE} border border-error-borde bg-error-suave text-error hover:bg-fondo`;

  it('CE-005: clasesBoton() devuelve el texto de hoy de la primaria', () => {
    expect(clasesBoton()).toBe(PRIMARIA);
  });

  it('CE-005: clasesBoton(undefined) devuelve el texto de hoy de la primaria (el camino de Cta.tsx)', () => {
    expect(clasesBoton(undefined)).toBe(PRIMARIA);
  });

  it('CE-005: clasesBoton("primaria") devuelve el texto de hoy', () => {
    expect(clasesBoton('primaria')).toBe(PRIMARIA);
  });

  it('CE-005: clasesBoton("secundaria") devuelve el texto de hoy', () => {
    expect(clasesBoton('secundaria')).toBe(SECUNDARIA);
  });

  it('CE-005: clasesBoton("peligro") devuelve el texto de hoy', () => {
    expect(clasesBoton('peligro')).toBe(PELIGRO);
  });

  it('RF-016: sin opciones, ninguna clase del panel (altos, bordes de 1 px parejos, estados) se filtra al sitio', () => {
    for (const variante of ['primaria', 'secundaria', 'peligro'] as const) {
      const clases = clasesBoton(variante);
      expect(clases, variante).not.toMatch(/min-h-\(--tactil-min\)|text-balance|active:|aria-disabled:|aria-pressed:/);
    }
  });
});

describe('Versión del panel (con opciones): base, bordes y estados (RF-001, RF-010; research D2 y D3)', () => {
  it.each(VARIANTES)('RF-006: %s tiene alto mínimo de 44 px (min-h-(--tactil-min)) y text-balance', (variante) => {
    const clases = clasesDe(conOpciones(variante, { tamanio: 'estandar' }));

    expect(clases).toContain('min-h-(--tactil-min)');
    expect(clases).toContain('text-balance');
  });

  it.each(VARIANTES)('RF-008: %s lleva borde de 1 px, así todas miden lo mismo', (variante) => {
    const clases = clasesDe(conOpciones(variante, { tamanio: 'estandar' }));

    expect(clases).toContain('border');
  });

  it.each([
    ['primaria', 'border-transparent'],
    ['terciaria', 'border-transparent'],
    ['secundaria', 'border-borde'],
    ['peligro', 'border-error-borde'],
  ] as const)('RF-008: el borde de %s es %s', (variante, borde) => {
    expect(clasesDe(conOpciones(variante, { tamanio: 'estandar' }))).toContain(borde);
  });

  it.each(VARIANTES)('RF-010: %s tiene estado de puntero (hover:) y de presionado (active:)', (variante) => {
    const clases = conOpciones(variante, { tamanio: 'estandar' });

    expect(clases).toMatch(/(^|\s)hover:/);
    expect(clases).toMatch(/(^|\s)active:/);
  });

  it('RF-010: la primaria se desplaza 1 px al presionarla', () => {
    expect(clasesDe(conOpciones('primaria', { tamanio: 'estandar' }))).toContain('active:translate-y-px');
  });

  it('RF-010: la terciaria se ve activa con aria-pressed (conmutadores como "Mostrar contraseña")', () => {
    expect(conOpciones('terciaria', { tamanio: 'estandar' })).toMatch(/(^|\s)aria-pressed:bg-marca-suave/);
  });

  it.each(['primaria', 'secundaria', 'peligro'] as const)(
    'RF-010: %s no define aria-pressed (solo la terciaria)',
    (variante) => {
      expect(conOpciones(variante, { tamanio: 'estandar' })).not.toMatch(/aria-pressed:/);
    },
  );

  it.each(VARIANTES)('RF-010: %s se ve inactiva con aria-disabled: y disabled: (opacidad y cursor)', (variante) => {
    const clases = conOpciones(variante, { tamanio: 'estandar' });

    expect(clases).toMatch(/(^|\s)aria-disabled:opacity-/);
    expect(clases).toMatch(/(^|\s)disabled:opacity-/);
    expect(clases).toMatch(/(^|\s)aria-disabled:cursor-not-allowed/);
  });

  it('D2: la terciaria es texto de marca sin fondo, con fondo marca-suave y subrayado al pasar el puntero', () => {
    const clases = clasesDe(conOpciones('terciaria', { tamanio: 'estandar' }));

    expect(clases).toContain('text-marca');
    expect(clases).toContain('hover:bg-marca-suave');
    expect(clases).toContain('hover:underline');
    expect(clases.some((c) => /^bg-/.test(c) && c !== 'bg-transparent')).toBe(false);
  });

  it('D2: la peligro mantiene su fondo de error suave, borde de error y texto de error', () => {
    const clases = clasesDe(conOpciones('peligro', { tamanio: 'estandar' }));

    expect(clases).toEqual(expect.arrayContaining(['bg-error-suave', 'border-error-borde', 'text-error']));
  });
});

describe('Tamaños (RF-006, RF-007; research D3)', () => {
  it.each(VARIANTES)('%s estándar tiene relleno horizontal de 20 px (px-5)', (variante) => {
    const clases = clasesDe(conOpciones(variante, { tamanio: 'estandar' }));

    expect(clases).toContain('px-5');
    expect(clases).not.toContain('text-sm');
  });

  it.each(VARIANTES)('%s compacto: ancho mínimo de 44 px, px-3 y texto sm', (variante) => {
    const clases = clasesDe(conOpciones(variante, { tamanio: 'compacto' }));

    expect(clases).toEqual(expect.arrayContaining(['min-w-(--tactil-min)', 'px-3', 'text-sm']));
    expect(clases).toContain('min-h-(--tactil-min)');
    expect(clases).not.toContain('px-5');
  });

  it.each(VARIANTES)('RF-007: %s solo ícono es un cuadrado de 44 px, distinto del compacto con texto', (variante) => {
    const soloIcono = conOpciones(variante, { tamanio: 'compacto', soloIcono: true });
    const compacto = conOpciones(variante, { tamanio: 'compacto' });

    expect(soloIcono).not.toBe(compacto);
    expect(soloIcono).toMatch(/(^|\s)(aspect-square|size-\(--tactil-min\)|w-\(--tactil-min\))(\s|$)/);
    expect(clasesDe(soloIcono)).toContain('min-h-(--tactil-min)');
    expect(clasesDe(soloIcono)).toContain('min-w-(--tactil-min)');
  });
});

describe('Solo tokens (constitución §VII.2)', () => {
  const combinaciones = VARIANTES.flatMap((variante) =>
    ([{ tamanio: 'estandar' }, { tamanio: 'compacto' }, { tamanio: 'compacto', soloIcono: true }] as Opciones[]).map(
      (opciones) => [variante, JSON.stringify(opciones), conOpciones(variante, opciones)] as const,
    ),
  );

  it.each(combinaciones)('%s %s no usa valores arbitrarios entre corchetes', (_v, _o, clases) => {
    expect(clases).not.toContain('[');
  });

  it.each(combinaciones)('%s %s no usa colores hex', (_v, _o, clases) => {
    expect(clases).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it.each(combinaciones)('%s %s no usa medidas en px sueltas', (_v, _o, clases) => {
    expect(clases).not.toMatch(/\d+(\.\d+)?px\b/);
  });
});

// Contraste (CE-004): los colores salen de las clases `text-*` y `bg-*` de cada estado, resueltos con los valores
// de tokens.css. Si una clase nombra un token que no existe, el test falla con su nombre.
describe('Contraste WCAG 2.1 AA de cada nivel y estado (CE-004)', () => {
  /** Color del token de la clase `<prefijo>text-<token>` o `<prefijo>bg-<token>`; `undefined` si el estado no lo define. */
  function colorDe(clases: string, prefijo: string, propiedad: 'text' | 'bg'): string | undefined {
    const escapado = prefijo.replace(/[-:]/g, String.raw`\$&`);
    const patron = new RegExp(`(?:^|\\s)${escapado}${propiedad}-([a-z0-9-]+)(?=\\s|$)`, 'g');
    for (const [, nombre] of clases.matchAll(patron)) {
      const token = `--color-${nombre}`;
      if (tokens.has(token)) return token;
      if (nombre === 'transparent') return undefined;
      // `text-sm`, `text-balance`: no son colores; `text-<token>` desconocido sí es un error de la variante.
      if (
        propiedad === 'text' &&
        /^(xs|sm|base|lg|xl|balance|wrap|nowrap|pretty|left|center|right|titulo-\d)/.test(nombre ?? '')
      ) {
        continue;
      }
      throw new Error(`La clase ${prefijo}${propiedad}-${nombre} nombra un token inexistente: ${token}`);
    }
    return undefined;
  }

  /** Pares texto/fondo de cada estado: lo que el estado no define lo hereda del reposo. */
  function pares(variante: Variante) {
    const clases = conOpciones(variante, { tamanio: 'estandar' });
    const texto = colorDe(clases, '', 'text');
    if (!texto) throw new Error(`${variante}: falta el color de texto en reposo (text-<token>)`);
    const fondoReposo = colorDe(clases, '', 'bg');
    const estado = (prefijo: string) => ({
      texto: colorDe(clases, prefijo, 'text') ?? texto,
      fondo: colorDe(clases, prefijo, 'bg'),
    });
    return {
      texto,
      fondoReposo,
      hover: estado('hover:'),
      active: estado('active:'),
      presionado: estado('aria-pressed:'),
    };
  }

  const minimo = 4.5;

  it.each(VARIANTES)('CE-004: %s en reposo tiene contraste ≥ 4,5:1', (variante) => {
    const { texto, fondoReposo } = pares(variante);
    // Sin fondo propio (terciaria) el botón se apoya en el de la pantalla: fondo, superficie o marca-suave.
    const fondos = fondoReposo ? [fondoReposo] : ['--color-fondo', '--color-superficie', '--color-marca-suave'];

    for (const fondo of fondos) {
      expect(contraste(texto, fondo), `${variante}: ${texto} sobre ${fondo}`).toBeGreaterThanOrEqual(minimo);
    }
  });

  it.each(VARIANTES)('CE-004: %s sobre el puntero tiene contraste ≥ 4,5:1', (variante) => {
    const { hover } = pares(variante);

    expect(hover.fondo, `${variante}: hover: debe definir un fondo`).toBeDefined();
    expect(
      contraste(hover.texto, hover.fondo!),
      `${variante}: ${hover.texto} sobre ${hover.fondo}`,
    ).toBeGreaterThanOrEqual(minimo);
  });

  it.each(VARIANTES)('CE-004: %s presionado tiene contraste ≥ 4,5:1', (variante) => {
    const { active } = pares(variante);

    expect(active.fondo, `${variante}: active: debe definir un fondo`).toBeDefined();
    expect(
      contraste(active.texto, active.fondo!),
      `${variante}: ${active.texto} sobre ${active.fondo}`,
    ).toBeGreaterThanOrEqual(minimo);
  });

  it('CE-004: la terciaria activa (aria-pressed) tiene contraste ≥ 4,5:1', () => {
    const { presionado } = pares('terciaria');

    expect(presionado.fondo, 'terciaria: aria-pressed: debe definir un fondo').toBeDefined();
    expect(contraste(presionado.texto, presionado.fondo!)).toBeGreaterThanOrEqual(minimo);
  });

  it.each(VARIANTES)('CE-004: %s deshabilitado queda exento de contraste, pero se distingue del reposo', (variante) => {
    const clases = conOpciones(variante, { tamanio: 'estandar' });
    const reposo = clasesDe(clases).filter((c) => !c.includes(':'));

    // Se distingue por opacidad (aria-disabled:/disabled:), que no existe en reposo.
    expect(reposo.some((c) => /^opacity-/.test(c))).toBe(false);
    expect(clases).toMatch(/aria-disabled:opacity-([1-9]\d?)(\s|$)/);
  });

  it('control: el cálculo de contraste da 21:1 entre blanco y negro', () => {
    tokens.set('--control-blanco-clases', 'oklch(1 0 0)');
    tokens.set('--control-negro-clases', 'oklch(0 0 0)');

    expect(contraste('--control-blanco-clases', '--control-negro-clases')).toBeCloseTo(21, 1);
  });
});

// T018 (spec 005, RF-003, WCAG 1.4.1 y 1.4.11; contracts/componentes.md "Cambios en packages/ui"): el estado activo
// de los botones de la barra del editor no puede depender solo del tinte de fondo.
describe('Terciaria activa con borde de marca (spec 005, T018)', () => {
  it('RF-003: la terciaria con aria-pressed suma aria-pressed:border-marca además del fondo marca-suave', () => {
    const clases = clasesDe(conOpciones('terciaria', { tamanio: 'estandar' }));

    expect(clases).toContain('aria-pressed:border-marca');
    expect(clases).toContain('aria-pressed:bg-marca-suave');
  });

  it('RF-003: el tamaño compacto también lleva el borde de marca al estar activa', () => {
    expect(clasesDe(conOpciones('terciaria', { tamanio: 'compacto' }))).toContain('aria-pressed:border-marca');
  });

  it.each(['primaria', 'secundaria', 'peligro'] as const)(
    'RF-003: %s no define aria-pressed:border-marca',
    (variante) => {
      expect(conOpciones(variante, { tamanio: 'estandar' })).not.toMatch(/aria-pressed:border-marca/);
    },
  );

  it.each(['--color-fondo', '--color-superficie', '--color-marca-suave'])(
    'WCAG 1.4.11: el borde activo (--color-marca) contrasta >= 3:1 contra %s',
    (fondo) => {
      expect(contraste('--color-marca', fondo)).toBeGreaterThanOrEqual(3);
    },
  );

  it('CE-005: clasesBoton() sin opciones sigue sin traer aria-pressed (el sitio no cambia)', () => {
    for (const variante of ['primaria', 'secundaria', 'peligro'] as const) {
      expect(clasesBoton(variante)).not.toMatch(/aria-pressed:/);
    }
    expect(clasesBoton('terciaria')).not.toMatch(/aria-pressed:/);
  });
});

// T125 (spec 005, Fase 12, H6 esc. 5; RF-026; research D27 y D31 U7): el resaltado del sitio y del lienzo. Dos tokens
// nuevos en tokens.css, `--color-resaltado` (fondo de `mark`) y `--color-resaltado-texto` (su texto), con contraste AA
// comprobado acá, y la regla de `forced-colors` que usa los colores del sistema `Mark` y `MarkText`.
// FASE ROJA: los tokens y la regla no existen todavía (T129).
describe('Resaltado: tokens y contraste (spec 005, T125)', () => {
  it.each(['--color-resaltado', '--color-resaltado-texto'])('existe %s en tokens.css', (nombre) => {
    expect(tokens.has(nombre), `falta ${nombre}`).toBe(true);
  });

  it('H6-E5: el texto sobre el resaltado tiene contraste >= 4,5:1 (WCAG 1.4.3)', () => {
    expect(contraste('--color-resaltado-texto', '--color-resaltado')).toBeGreaterThanOrEqual(4.5);
  });

  it('H6-E5: la línea del enlace (decoration-marca) sobre el resaltado tiene contraste >= 3:1 (WCAG 1.4.11)', () => {
    expect(contraste('--color-marca', '--color-resaltado')).toBeGreaterThanOrEqual(3);
  });

  it('el resaltado se distingue del fondo de la página (no es el mismo color)', () => {
    expect(valorDe('--color-resaltado')).not.toBe(valorDe('--color-fondo'));
    expect(contraste('--color-resaltado', '--color-fondo')).toBeGreaterThan(1);
  });

  it('§VII.2: los dos tokens son colores oklch, sin hex', () => {
    for (const nombre of ['--color-resaltado', '--color-resaltado-texto']) {
      expect(valorDe(nombre), nombre).toMatch(/^oklch\(/);
    }
  });
});

describe('Resaltado en modo de alto contraste (forced-colors, D31 U7)', () => {
  /** El texto de tokens.css sin comentarios. */
  const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  /** El cuerpo del bloque `@media (forced-colors: active) { … }` (con llaves anidadas), o `undefined`. */
  function bloqueForcedColors(): string | undefined {
    const inicio = /@media\s*\(\s*forced-colors\s*:\s*active\s*\)\s*\{/.exec(css);
    if (!inicio) return undefined;
    let profundidad = 1;
    let i = inicio.index + inicio[0].length;
    for (; i < css.length && profundidad > 0; i++) {
      if (css[i] === '{') profundidad++;
      if (css[i] === '}') profundidad--;
    }
    return css.slice(inicio.index + inicio[0].length, i - 1);
  }

  it('tokens.css tiene un bloque @media (forced-colors: active)', () => {
    expect(bloqueForcedColors(), 'falta @media (forced-colors: active) en tokens.css').toBeDefined();
  });

  it('en ese bloque, mark usa el fondo Mark y el texto MarkText (colores del sistema)', () => {
    const regla = /(^|[\s,}])mark\s*\{([^}]*)\}/.exec(bloqueForcedColors() ?? '')?.[2] ?? '';

    expect(regla, 'falta la regla de mark').not.toBe('');
    expect(regla).toMatch(/(^|;|\s)background(-color)?\s*:\s*Mark\s*(;|$)/);
    expect(regla).toMatch(/(^|;|\s)color\s*:\s*MarkText\s*(;|$)/);
  });

  it('la regla de forced-colors está fuera de @theme (no es un token)', () => {
    const tema = /@theme\s*\{/.exec(css);
    const media = /@media\s*\(\s*forced-colors/.exec(css);

    expect(media).not.toBeNull();
    // `@theme` cierra antes de la regla: entre el comienzo de @theme y la regla, las llaves están balanceadas.
    const entre = css.slice(tema?.index ?? 0, media?.index ?? 0);
    expect((entre.match(/\{/g) ?? []).length).toBe((entre.match(/\}/g) ?? []).length);
  });
});
