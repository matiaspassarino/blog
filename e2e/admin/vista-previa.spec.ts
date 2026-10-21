// T053 (spec 003, H2-E7, RSEO-002). FASE ROJA: /articulos/[id]/vista-previa no existe aún.
//
// Supuestos de interfaz (T063, D15):
//   - La vista previa es /articulos/<id>/vista-previa; renderiza título (único `h1`), `Bloques` de @blog/bloques/render y,
//     fuera del contenido renderizado, un `<p role="status">` "Vista previa, no publicada" (nunca un encabezado) con una
//     banda "Vista previa: así se verá en el sitio" y el estado del artículo ("borrador", "publicado"…) en texto.
//   - `<meta name="robots">` con `noindex`, sin `<link rel="canonical">`, y encabezado `X-Robots-Tag: noindex`.
//   - Sin sesión: redirige a /ingreso?volver=<ruta>.
//   - La comparación con el sitio público es ESTRUCTURAL: se toma la secuencia, en orden de documento, de los elementos
//     h2, h3, h4, figure, blockquote, ul, ol, pre, hr e iframe que están dentro de `main` (vista previa) y de
//     `article` (sitio, http://localhost:4321/blog/<slug>), sin contar los que viven dentro de header, nav, aside o
//     footer. Para que sea comparable, el artículo del ejemplo no lleva imagen destacada ni etiquetas.
// Requiere el sitio público en :4321 leyendo la misma base local (playwright.config.ts lo levanta).
import { expect, test, type Page } from '@playwright/test';
import { pngDecodificable } from '../../packages/db/src/pruebas/imagenes';
import {
  diezBloques,
  imagenSemilla,
  limpiarArticulosE2E,
  publicarComoServicio,
  sembrarArticulo,
  subirObjeto,
} from './ayudas/articulos';
import { nombreDePrueba } from './ayudas/datos';
import { ingresar, USUARIOS } from './ayudas/sesion';

const PREFIJO = 'e2e-vp-';
const URL_SITIO = 'http://localhost:4321';
const SELECTOR_ESTRUCTURA = 'h2, h3, h4, figure, blockquote, ul, ol, pre, hr, iframe';

test.afterAll(() => limpiarArticulosE2E(PREFIJO));

async function sembrarConDiezBloques(etiqueta: string) {
  const ruta = `pruebas-e2e/${crypto.randomUUID()}.png`;
  await subirObjeto(ruta, pngDecodificable(4, 3));
  return sembrarArticulo({ titulo: nombreDePrueba(etiqueta), contenido: diezBloques(imagenSemilla(ruta)) });
}

/** Secuencia ordenada de etiquetas estructurales dentro de `contenedor`, sin las de header, nav, aside o footer. */
function estructuraDe(page: Page, contenedor: string) {
  return page.evaluate(
    ({ contenedor, selector }) => {
      const raiz = document.querySelector(contenedor);
      if (!raiz) return null;
      return [...raiz.querySelectorAll(selector)]
        .filter((e) => !e.closest('header, nav, aside, footer'))
        .map((e) => e.tagName.toLowerCase());
    },
    { contenedor, selector: SELECTOR_ESTRUCTURA },
  );
}

test.describe('Vista previa (H2-E7, RSEO-002)', () => {
  test('H2-E7: muestra los mismos elementos y en el mismo orden que la página pública de un artículo equivalente', async ({
    page,
  }) => {
    test.slow();
    const borrador = await sembrarConDiezBloques('vp-borrador');
    const publicado = await publicarComoServicio((await sembrarConDiezBloques('vp-publicado')).id);
    await ingresar(page, USUARIOS.editor);

    await page.goto(`/articulos/${borrador.id}/vista-previa`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(borrador.titulo);
    const enLaVistaPrevia = await estructuraDe(page, 'main');

    await expect
      .poll(async () => (await page.request.get(`${URL_SITIO}/blog/${publicado.slug}`)).status(), { timeout: 60_000 })
      .toBe(200);
    await page.goto(`${URL_SITIO}/blog/${publicado.slug}`);
    const enElSitio = await estructuraDe(page, 'article');

    expect(enLaVistaPrevia).not.toBeNull();
    expect(enLaVistaPrevia!.length).toBeGreaterThanOrEqual(9); // h2, figure(s), blockquote, ol, pre, hr, iframe…
    expect(enLaVistaPrevia).toEqual(enElSitio);
  });

  test('H2-E7: sin sesión redirige al ingreso', async ({ page }) => {
    const articulo = await sembrarConDiezBloques('vp-sin-sesion');

    await page.goto(`/articulos/${articulo.id}/vista-previa`);

    await expect(page).toHaveURL(/\/ingreso\?/);
    expect(new URL(page.url()).searchParams.get('volver')).toBe(`/articulos/${articulo.id}/vista-previa`);
  });

  test('RSEO-002: lleva noindex, no tiene canonical y su dirección no empieza con /blog', async ({ page }) => {
    const articulo = await sembrarConDiezBloques('vp-seo');
    await ingresar(page, USUARIOS.editor);

    const respuesta = await page.goto(`/articulos/${articulo.id}/vista-previa`);

    expect(respuesta?.status()).toBe(200);
    expect(respuesta?.headers()['x-robots-tag']).toMatch(/noindex/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    expect(new URL(page.url()).pathname.startsWith('/blog')).toBe(false);
  });

  test('H2-E7: muestra el aviso de vista previa y el estado, con un solo h1', async ({ page }) => {
    const borrador = await sembrarConDiezBloques('vp-aviso');
    await ingresar(page, USUARIOS.editor);

    await page.goto(`/articulos/${borrador.id}/vista-previa`);

    await expect(page.getByRole('status').filter({ hasText: 'Vista previa, no publicada' })).toBeVisible();
    await expect(page.getByText('Vista previa: así se verá en el sitio')).toBeVisible();
    await expect(page.getByRole('main')).toContainText(/borrador/i);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: /Vista previa/ })).toHaveCount(0);
  });

  test('H2-E7: el estado se actualiza según el artículo (publicado)', async ({ page }) => {
    const publicado = await publicarComoServicio((await sembrarConDiezBloques('vp-estado')).id);
    await ingresar(page, USUARIOS.editor);

    await page.goto(`/articulos/${publicado.id}/vista-previa`);

    await expect(page.getByRole('main')).toContainText(/publicado/i);
  });

  test('H2-E7: un artículo que no existe muestra la página de no encontrado', async ({ page }) => {
    await ingresar(page, USUARIOS.editor);

    const respuesta = await page.goto(`/articulos/${crypto.randomUUID()}/vista-previa`);

    expect(respuesta?.status()).toBe(404);
  });
});
