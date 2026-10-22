// Ayudas de los E2E de publicación, programación y permisos (spec 003, H3). FASE ROJA: AccionesEstado no existe aún.
//
// CONTRATO DE INTERFAZ SUPUESTO (T072: `componentes/articulo/AccionesEstado.tsx`, dentro de /articulos/[id]).
// Si la interfaz real difiere, se ajusta aquí, en un solo lugar.
//   - Un `role="group"` con nombre "Publicación" agrupa todo lo de esta sección. Dentro:
//       * El estado en texto visible: "Estado: borrador" | "programado" | "publicado" | "archivado" (minúsculas).
//       * Un `<time datetime="<ISO UTC>">` con la fecha de publicación (publicado) o la programada (programado),
//         formateada en la hora local del navegador (`FechaLocal`). Un borrador o archivado no la muestra.
//       * Un enlace "Ver en el sitio" (solo publicado) hacia `<NEXT_PUBLIC_URL_SITIO>/blog/<slug>`.
//       * Botones (nombre exacto): "Publicar", "Programar", "Cancelar programación", "Volver a borrador", "Archivar"
//         y "Eliminar" (este último solo para el admin). Solo existen los que permite el estado (data-model.md).
//       * Un campo con etiqueta "Fecha y hora de publicación" (`<input type="datetime-local">`, mínimo = ahora) visible
//         mientras el artículo es borrador; el botón "Programar" lo lee y envía `new Date(valor).toISOString()`.
//         La interfaz no usa la validación nativa del navegador: una fecha pasada llega a la acción y la rechaza la base.
//       * Los errores salen en un `role="alert"` dentro del grupo, con el texto de `mensajeDeError`:
//         "Para publicar falta: sin categoría." / "…sin bloques." y "Elige una fecha y hora que todavía no hayan pasado."
//       * Con cambios sin guardar, cualquier cambio de estado NO se ejecuta y el grupo muestra un `role="alert"` que
//         contiene "guarda" y "antes" (por ejemplo "Guarda los cambios antes de cambiar el estado.").
//   - "Eliminar" abre un `alertdialog` (ConfirmarAccion) con título que menciona "Eliminar", botón "Cancelar" (foco
//     inicial) y botón de confirmación "Eliminar" (nombre exacto, dentro del diálogo). Al confirmar navega a /articulos.
//   - Ningún otro cambio de estado pide confirmación.
import { expect, type Locator, type Page } from '@playwright/test';

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

export const panelPublicacion = (page: Page) => page.getByRole('group', { name: 'Publicación' });

export const botonDeEstado = (page: Page, accion: AccionDeEstado) =>
  panelPublicacion(page).getByRole('button', { name: accion, exact: true });

export const campoFechaProgramada = (page: Page) =>
  panelPublicacion(page).getByLabel('Fecha y hora de publicación', { exact: true });

export const fechaMostrada = (page: Page): Locator => panelPublicacion(page).locator('time');

export const enlaceVerEnElSitio = (page: Page) =>
  panelPublicacion(page).getByRole('link', { name: 'Ver en el sitio', exact: true });

export const errorDelPanel = (page: Page) => panelPublicacion(page).getByRole('alert');

/** Espera a que el panel muestre el estado indicado (el texto "Estado: <estado>" es visible). */
export async function esperarEstado(page: Page, estado: EstadoVisible) {
  await expect(panelPublicacion(page)).toContainText(new RegExp(`Estado:\\s*${estado}`, 'i'));
}

/** Acciones que el panel ofrece ahora, en el orden de pantalla. */
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
