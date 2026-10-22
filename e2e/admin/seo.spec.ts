// T042 (spec 003, RSEO-001): ninguna pantalla del panel es indexable. FASE ROJA: /ingreso y /articulos no existen aún.
import { expect, test } from '@playwright/test';
import { ingresar, USUARIOS } from './ayudas/sesion';

async function comprobarNoIndexable(page: import('@playwright/test').Page, ruta: string, estado: number) {
  const respuesta = await page.goto(ruta);
  expect(respuesta?.status()).toBe(estado);
  expect(respuesta?.headers()['x-robots-tag']).toBe('noindex, nofollow');
  // Next agrega su propio `noindex` a las páginas 404: se comprueba que esté el del panel.
  await expect(page.locator('meta[name="robots"][content="noindex, nofollow"]')).toHaveCount(1);
}

test.describe('Panel no indexable (RSEO-001)', () => {
  test('RSEO-001: /ingreso lleva X-Robots-Tag y meta robots noindex, nofollow', async ({ page }) => {
    await comprobarNoIndexable(page, '/ingreso', 200);
  });

  test('RSEO-001: /articulos con sesión lleva X-Robots-Tag y meta robots noindex, nofollow', async ({ page }) => {
    await ingresar(page, USUARIOS.editor);
    await comprobarNoIndexable(page, '/articulos', 200);
  });

  test('RSEO-001: una 404 lleva X-Robots-Tag y meta robots noindex, nofollow', async ({ page }) => {
    await ingresar(page, USUARIOS.editor);
    await comprobarNoIndexable(page, '/esta-pagina-no-existe', 404);
  });

  test('RSEO-001: /robots.txt devuelve Disallow: /', async ({ request }) => {
    const respuesta = await request.get('/robots.txt');
    expect(respuesta.status()).toBe(200);
    expect(await respuesta.text()).toMatch(/Disallow: \/(\r?\n|$)/);
  });
});
