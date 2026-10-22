// Ayudas de los E2E de publicación, programación y permisos (spec 003, H3; adaptadas en la spec 004, T017).
// FASE ROJA de la spec 004: hasta T024/T025 el editor sigue con `AccionesEstado` (grupo "Publicación").
//
// CONTRATO DE INTERFAZ SUPUESTO (spec 004: `BarraEditor`, `InfoPublicacion` y `DialogoProgramar`, dentro de
// /articulos/[id]). Si la interfaz real difiere, se ajusta aquí, en un solo lugar.
//   - Barra fija: un `role="group"` con nombre "Acciones del artículo" (`barraDelEditor`). Contiene los botones de
//     estado (nombre exacto): "Publicar", "Programar", "Cancelar programación", "Volver a borrador", "Archivar" y
//     "Eliminar" (este último solo para el admin). Solo existen los que permite el estado (data-model.md). En el ancho
//     de estas pruebas (1280 px) todos están en línea, sin "Más acciones".
//   - "Publicación": una sección (`section` con `h2`, `role="region"`) solo informativa, sin botones:
//       * El estado en texto visible: "Estado: borrador" | "programado" | "publicado" | "archivado" (minúsculas).
//       * Un `<time datetime="<ISO UTC>">` con la fecha de publicación (publicado) o la programada (programado),
//         en la hora local del navegador (`FechaLocal`). Un borrador o archivado no la muestra.
//       * Un enlace "Ver en el sitio" (solo publicado) hacia `<NEXT_PUBLIC_URL_SITIO>/blog/<slug>`.
//   - "Programar" abre un `alertdialog` "Programar la publicación" con el campo "Fecha y hora de publicación"
//     (`<input type="datetime-local">`, mínimo = ahora, con el foco) y los botones "Cancelar" y "Programar" (confirma
//     y envía `new Date(valor).toISOString()`). Sin fecha, con fecha pasada o con rechazo de la base, el diálogo sigue
//     abierto, con el mensaje en un `role="alert"` dentro del diálogo y el foco en el campo.
//   - Los errores de un cambio de estado sin diálogo salen en un `role="alert"` (un `AvisoEstado` encima de la barra),
//     con el texto de `mensajeDeError`: "Para publicar falta: sin categoría." / "…sin bloques.".
//   - Con cambios sin guardar, cualquier cambio de estado NO se ejecuta (y "Programar" no abre el diálogo): aparece un
//     `role="alert"` con "guarda" y "antes" (por ejemplo "Guarda los cambios antes de cambiar el estado.").
//   - "Eliminar" abre un `alertdialog` (ConfirmarAccion) con título que menciona "Eliminar", botón "Cancelar" (foco
//     inicial) y botón de confirmación "Eliminar" (nombre exacto, dentro del diálogo). Al confirmar navega a /articulos.
//   - Ningún otro cambio de estado pide confirmación.
import { expect, type Locator, type Page } from '@playwright/test';
import { barraDelEditor } from './jerarquia';

export const URL_SITIO = 'http://localhost:4321';

export type EstadoVisible = 'borrador' | 'programado' | 'publicado' | 'archivado';
export type AccionDeEstado =
  'Publicar' | 'Programar' | 'Cancelar programación' | 'Volver a borrador' | 'Archivar' | 'Eliminar';

const TODAS_LAS_ACCIONES: AccionDeEstado[] = [
  'Publicar',
  'Programar',
  'Cancelar programación',
  'Volver a borrador',
  'Archivar',
  'Eliminar',
];

/** La sección informativa "Publicación" (estado, fecha y enlace al sitio). */
export const panelPublicacion = (page: Page) => page.getByRole('region', { name: 'Publicación', exact: true });

/** Los botones de estado viven en la barra fija "Acciones del artículo". */
export const botonDeEstado = (page: Page, accion: AccionDeEstado) =>
  barraDelEditor(page).getByRole('button', { name: accion, exact: true });

/** El diálogo "Programar la publicación". */
export const dialogoProgramar = (page: Page) =>
  page.getByRole('alertdialog', { name: 'Programar la publicación', exact: true });

/** El campo de fecha está dentro del diálogo: hay que abrirlo antes (`abrirDialogoProgramar`). */
export const campoFechaProgramada = (page: Page) =>
  dialogoProgramar(page).getByLabel('Fecha y hora de publicación', { exact: true });

export const botonConfirmarProgramar = (page: Page) =>
  dialogoProgramar(page).getByRole('button', { name: 'Programar', exact: true });

export const fechaMostrada = (page: Page): Locator => panelPublicacion(page).locator('time');

export const enlaceVerEnElSitio = (page: Page) =>
  panelPublicacion(page).getByRole('link', { name: 'Ver en el sitio', exact: true });

// Sin el anunciador de rutas de Next, que también es `role="alert"` y se llena tras una navegación.
export const errorDelPanel = (page: Page) =>
  page.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasText: /\S/ });

/** Abre el diálogo de programar desde la barra y espera a que esté a la vista. */
export async function abrirDialogoProgramar(page: Page) {
  await botonDeEstado(page, 'Programar').click();
  await expect(dialogoProgramar(page)).toBeVisible();
}

/** Programa desde la barra: abre el diálogo, completa la fecha (si se da) y confirma con su "Programar". */
export async function programarArticulo(page: Page, fecha?: string) {
  await abrirDialogoProgramar(page);
  if (fecha !== undefined) await campoFechaProgramada(page).fill(fecha);
  await botonConfirmarProgramar(page).click();
}

/** Espera a que el panel muestre el estado indicado (el texto "Estado: <estado>" es visible). */
export async function esperarEstado(page: Page, estado: EstadoVisible) {
  await expect(panelPublicacion(page)).toContainText(new RegExp(`Estado:\\s*${estado}`, 'i'));
}

/** Acciones de estado que la barra ofrece ahora, en el orden de TODAS_LAS_ACCIONES. */
export async function accionesVisibles(page: Page): Promise<AccionDeEstado[]> {
  const visibles: AccionDeEstado[] = [];
  for (const accion of TODAS_LAS_ACCIONES) {
    if ((await botonDeEstado(page, accion).count()) > 0) visibles.push(accion);
  }
  return visibles;
}

export const urlDelArticulo = (id: string) => `/articulos/${id}`;

/** Estado HTTP de la página pública del artículo (sin seguir redirecciones). */
async function estadoEnElSitio(page: Page, slug: string) {
  const respuesta = await page.request.get(`${URL_SITIO}/blog/${slug}`, { maxRedirects: 0 });
  return respuesta.status();
}

/** Espera (hasta 60 s, CE-003) a que el artículo se vea (200) o deje de verse (404) en el sitio público. */
export async function esperarEnElSitio(page: Page, slug: string, visible: boolean, timeout = 60_000) {
  await expect
    .poll(() => estadoEnElSitio(page, slug), {
      timeout,
      intervals: [1_000, 2_000, 3_000],
      message: `el artículo ${slug} ${visible ? 'debería verse' : 'no debería verse'} en el sitio`,
    })
    .toBe(visible ? 200 : 404);
}
