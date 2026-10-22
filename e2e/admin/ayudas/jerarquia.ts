// Ayudas de los E2E de jerarquía visual (spec 004, T002; research D13). Miden lo que muestra el panel:
// qué acciones hay por nivel, alturas y alineación de un grupo, área táctil y si una barra ocupa una línea.
//
// SUPUESTOS DE INTERFAZ (contracts/componentes.md):
//   - Todo `Button` del panel lleva `data-nivel` ('primaria' | 'secundaria' | 'terciaria' | 'peligro') y `data-tamanio`
//     ('estandar' | 'compacto'). Un enlace con `asChild` también (por eso cuenta como acción).
//   - La barra del editor es un `role="group"` con nombre "Acciones del artículo".
import { expect, type Locator, type Page } from '@playwright/test';

export type Nivel = 'primaria' | 'secundaria' | 'terciaria' | 'peligro';
export const NIVELES: Nivel[] = ['primaria', 'secundaria', 'terciaria', 'peligro'];

/** Nombres (aria-label o texto, con el sufijo `sr-only`) de las acciones visibles de cada nivel. */
type AccionesPorNivel = Record<Nivel, string[]>;

/** Contexto donde se cuentan las acciones: la página (o un ámbito) y, con un diálogo abierto, solo el diálogo. */
type Contexto = Page | Locator;

const SELECTOR_ACCION = '[data-nivel]:visible';

/**
 * Cuenta las acciones visibles por nivel. Con un `alertdialog` o `dialog` abierto en la página, cuenta solo dentro
 * de él (spec, casos borde: "dentro de un diálogo la jerarquía se evalúa sola").
 */
export async function accionesPorNivel(contexto: Contexto): Promise<AccionesPorNivel> {
  const raiz = esPagina(contexto) ? await alcance(contexto) : contexto;
  const nombres = await raiz.locator(SELECTOR_ACCION).evaluateAll((elementos) =>
    elementos.map((el) => ({
      nivel: el.getAttribute('data-nivel') ?? '',
      nombre: (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })),
  );
  const resultado: AccionesPorNivel = { primaria: [], secundaria: [], terciaria: [], peligro: [] };
  for (const { nivel, nombre } of nombres) {
    if (nivel in resultado) resultado[nivel as Nivel].push(nombre);
  }
  return resultado;
}

const esPagina = (contexto: Contexto): contexto is Page => 'goto' in contexto;

/** El diálogo abierto, si hay uno; si no, la página entera. */
async function alcance(page: Page): Promise<Locator> {
  const dialogo = page.locator('[role="alertdialog"]:visible, [role="dialog"]:visible, dialog[open]:visible').first();
  return (await dialogo.count()) > 0 ? dialogo : page.locator('body');
}

/**
 * Compara las acciones encontradas con las esperadas de un nivel: cada nombre encontrado debe coincidir con algún
 * esperado (texto exacto o expresión; las filas repiten el nombre con distinto sufijo) y cada esperado debe aparecer.
 */
export function verificarNivel(
  encontradas: string[],
  esperadas: (string | RegExp)[],
  donde: string,
  /** Acciones que pueden estar o no (por ejemplo "Quitar imagen", que depende de si hay imagen). */
  opcionales: (string | RegExp)[] = [],
) {
  const coincide = (nombre: string, esperada: string | RegExp) =>
    typeof esperada === 'string' ? nombre === esperada : esperada.test(nombre);
  const sobrantes = encontradas.filter((nombre) => ![...esperadas, ...opcionales].some((e) => coincide(nombre, e)));
  const faltantes = esperadas.filter((e) => !encontradas.some((nombre) => coincide(nombre, e)));
  expect({ sobrantes, faltantes }, `acciones de ${donde}: ${JSON.stringify(encontradas)}`).toEqual({
    sobrantes: [],
    faltantes: [],
  });
}

type Caja = { x: number; y: number; width: number; height: number };

async function caja(locator: Locator): Promise<Caja> {
  const medida = await locator.boundingBox();
  if (!medida) throw new Error('El elemento no tiene caja: no está visible');
  return medida;
}

/** Alturas (en px) de cada botón visible del grupo. */
export async function alturasDelGrupo(grupo: Locator): Promise<number[]> {
  const botones = grupo.locator(SELECTOR_ACCION);
  const cantidad = await botones.count();
  const alturas: number[] = [];
  for (let i = 0; i < cantidad; i += 1) alturas.push((await caja(botones.nth(i))).height);
  return alturas;
}

/** Dos elementos de la misma fila: mismo borde superior e inferior (tolera 1 px de redondeo). */
export async function estaAlineado(a: Locator, b: Locator, tolerancia = 1): Promise<boolean> {
  const [cajaA, cajaB] = [await caja(a), await caja(b)];
  return (
    Math.abs(cajaA.y - cajaB.y) <= tolerancia &&
    Math.abs(cajaA.y + cajaA.height - (cajaB.y + cajaB.height)) <= tolerancia
  );
}

/** Área táctil del control: al menos 44 × 44 px (WCAG 2.5.5, constitución §VII.4). */
export async function areaTactil(locator: Locator, minimo = 44): Promise<{ ok: boolean; ancho: number; alto: number }> {
  const { width, height } = await caja(locator);
  // Medida real en px; la tolerancia de 0,5 px absorbe el redondeo subpíxel del navegador.
  return { ok: width >= minimo - 0.5 && height >= minimo - 0.5, ancho: width, alto: height };
}

/** Todas las acciones visibles del grupo con el mismo `y` (una sola línea; la línea de estado no cuenta). */
export async function ocupaUnaLinea(locator: Locator, tolerancia = 1): Promise<boolean> {
  const hijos = locator.locator(SELECTOR_ACCION);
  const cantidad = await hijos.count();
  if (cantidad === 0) return false;
  const ys: number[] = [];
  for (let i = 0; i < cantidad; i += 1) ys.push((await caja(hijos.nth(i))).y);
  return Math.max(...ys) - Math.min(...ys) <= tolerancia;
}

/** La barra fija del editor: `role="group"` "Acciones del artículo". */
export const barraDelEditor = (page: Page) => page.getByRole('group', { name: 'Acciones del artículo', exact: true });

/** Posición (x, y) de un botón, para comprobar que no se mueve. */
export async function posicionDe(locator: Locator): Promise<{ x: number; y: number }> {
  const { x, y } = await caja(locator);
  return { x: Math.round(x), y: Math.round(y) };
}

/** Ancho (en px) del botón, para comprobar que no cambia al ocupar. */
export async function anchoDe(locator: Locator): Promise<number> {
  return (await caja(locator)).width;
}

// --- Medidas de todas las acciones de una pantalla (se calculan en el navegador, de una vez) ---------------------------

/**
 * Grupos de acciones de la pantalla: cada acción pertenece al ancestro más bajo que contiene dos o más acciones (la barra,
 * la celda de una fila, el pie de un diálogo). Dentro de un grupo, las acciones que comparten línea (se superponen
 * verticalmente) deben tener el mismo borde superior e inferior (misma altura y alineadas; RF-008, CE-003).
 */
export async function gruposDesalineados(page: Page, tolerancia = 1): Promise<string[]> {
  return page.evaluate((tol) => {
    const acciones = [...document.querySelectorAll<HTMLElement>('[data-nivel]')].filter(
      (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
    );
    const nombre = (el: HTMLElement) =>
      (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const grupos = new Map<Element, HTMLElement[]>();
    for (const accion of acciones) {
      let ancestro = accion.parentElement;
      while (ancestro && acciones.filter((a) => ancestro!.contains(a)).length < 2) ancestro = ancestro.parentElement;
      // Si el ancestro es el contenedor de toda la pantalla, la acción está sola en su grupo.
      if (!ancestro || ancestro.tagName === 'MAIN' || ancestro.tagName === 'BODY' || ancestro.querySelector('main')) {
        continue;
      }
      grupos.set(ancestro, [...(grupos.get(ancestro) ?? []), accion]);
    }
    const problemas: string[] = [];
    for (const lista of grupos.values()) {
      const cajas = lista.map((el) => ({ el, caja: el.getBoundingClientRect() }));
      for (let i = 0; i < cajas.length; i += 1) {
        for (let j = i + 1; j < cajas.length; j += 1) {
          const a = cajas[i]!.caja;
          const b = cajas[j]!.caja;
          const solape = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (solape <= Math.min(a.height, b.height) / 2) continue; // en otra línea
          if (Math.abs(a.top - b.top) > tol || Math.abs(a.bottom - b.bottom) > tol) {
            problemas.push(
              `"${nombre(cajas[i]!.el)}" (${Math.round(a.top)}-${Math.round(a.bottom)}) y "${nombre(cajas[j]!.el)}" (${Math.round(b.top)}-${Math.round(b.bottom)})`,
            );
          }
        }
      }
    }
    return problemas;
  }, tolerancia);
}

/** Controles visibles de la pantalla con un área menor que 44 × 44 px (CE-003, RF-006). */
export async function controlesBajoElMinimo(page: Page, minimo = 44): Promise<string[]> {
  return page.evaluate((min) => {
    const selector =
      '[data-nivel], button, select, textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), nav a[href]';
    const chicos: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const estilo = getComputedStyle(el);
      if (el.getClientRects().length === 0 || estilo.visibility === 'hidden' || el.closest('nextjs-portal')) continue;
      if (el.closest('.sr-only')) continue;
      const { width, height } = el.getBoundingClientRect();
      if (width < min - 0.5 || height < min - 0.5) {
        const nombre = (el.getAttribute('aria-label') ?? el.textContent ?? el.id)
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 40);
        chicos.push(`${el.tagName.toLowerCase()} "${nombre}" mide ${Math.round(width)} × ${Math.round(height)}`);
      }
    }
    return chicos;
  }, minimo);
}

/** Acciones visibles que se superponen entre sí o que se salen de la pantalla (RF-009, zoom al 200 %). */
export async function accionesSuperpuestasOCortadas(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const acciones = [...document.querySelectorAll<HTMLElement>('[data-nivel]')].filter(
      (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden',
    );
    const nombre = (el: HTMLElement) =>
      (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const problemas: string[] = [];
    const cajas = acciones.map((el) => ({ el, caja: el.getBoundingClientRect() }));
    for (const { el, caja } of cajas) {
      if (caja.left < -0.5 || caja.right > document.documentElement.clientWidth + 0.5) {
        problemas.push(`"${nombre(el)}" se sale de la pantalla (${Math.round(caja.left)} a ${Math.round(caja.right)})`);
      }
    }
    for (let i = 0; i < cajas.length; i += 1) {
      for (let j = i + 1; j < cajas.length; j += 1) {
        const a = cajas[i]!.caja;
        const b = cajas[j]!.caja;
        const ancho = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const alto = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ancho > 1 && alto > 1) {
          problemas.push(`"${nombre(cajas[i]!.el)}" se superpone con "${nombre(cajas[j]!.el)}"`);
        }
      }
    }
    return problemas;
  });
}
