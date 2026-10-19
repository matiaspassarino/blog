// T049: lo que no está publicado responde 404, y casos borde de la tarjeta y de la imagen OG
// (spec 002, H1-E5, RF-006, RF-009, RF-016; casos borde "sin imagen destacada" y "título largo").
import { expect, test, type Page } from '@playwright/test';
import { abrir, esperar404 } from './ayudas';

// Slugs del seed (supabase/seed.sql), derivados del título con privado.slugificar.
const NO_PUBLICADOS = {
  borrador: '/blog/checklist-de-lanzamiento-de-un-sitio',
  'borrador sin bloques': '/blog/componentes-reutilizables-en-el-frontend',
  programado: '/blog/tendencias-de-diseno-para-el-proximo-ano',
  'otro programado': '/blog/metricas-que-importan-para-un-sitio-de-servicios',
  archivado: '/blog/anuncio-de-la-version-beta-del-estudio',
  inexistente: '/blog/no-existe',
};

// Publicado sin imagen destacada y con el título de 120 caracteres (categoría Marketing).
const TITULO_LARGO =
  'Guía completa para planificar, diseñar, escribir, publicar y evaluar el blog de una pyme de servicios sin perder el foco';
const RUTA_TITULO_LARGO =
  '/blog/guia-completa-para-planificar-disenar-escribir-publicar-y-evaluar-el-blog-de-una-pyme-de-servicios-sin-perder-el-foco';
// Otro publicado de Marketing: el de título largo es el más reciente de la categoría, así que
// aparece primero entre sus relacionados (RF-005) y ahí se ve su tarjeta.
const RUTA_CON_TARJETA_LARGA = '/blog/redes-sociales-para-pymes-menos-es-mas';

test.describe('H1-E5 / RF-006: lo no publicado responde 404', () => {
  for (const [caso, ruta] of Object.entries(NO_PUBLICADOS)) {
    test(`H1-E5: un artículo ${caso} responde 404 con cabecera, pie y enlaces`, async ({ page }) => {
      await esperar404(page, ruta);
    });
  }

  test('RF-006: la 404 es idéntica para borrador, programado, archivado e inexistente', async ({ page }) => {
    const referencia = await esperar404(page, NO_PUBLICADOS.inexistente);

    for (const [caso, ruta] of Object.entries(NO_PUBLICADOS)) {
      expect(await esperar404(page, ruta), `la 404 del caso ${caso} no debería distinguirse`).toEqual(referencia);
    }
    expect(referencia.robots).toMatch(/noindex/);
  });

  test('RF-016: una ruta cualquiera fuera del blog responde 404', async ({ page }) => {
    await esperar404(page, '/cualquier-cosa');
  });
});

test.describe('casos borde: artículo sin imagen destacada y con título de 120 caracteres', () => {
  test('caso borde: sin imagen destacada, og:image usa la imagen genérica', async ({ page }) => {
    await abrir(page, RUTA_TITULO_LARGO);

    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og-generica\.png$/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  });

  test('caso borde: el h1 de 120 caracteres no desborda la página del artículo', async ({ page }) => {
    await abrir(page, RUTA_TITULO_LARGO);

    const titulo = page.getByRole('heading', { level: 1 });
    await expect(titulo).toHaveText(TITULO_LARGO);
    const desborde = await titulo.evaluate((elemento) => elemento.scrollWidth - elemento.clientWidth);
    expect(desborde).toBeLessThanOrEqual(0);
    const desbordePagina = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desbordePagina).toBeLessThanOrEqual(0);
  });

  test('RF-009: en su tarjeta, el artículo sin imagen destacada muestra la imagen genérica', async ({ page }) => {
    await abrir(page, RUTA_CON_TARJETA_LARGA);

    const tarjeta = page
      .getByRole('region', { name: /relacionados/i })
      .getByRole('article')
      .filter({ has: page.getByRole('link', { name: TITULO_LARGO }) });
    await expect(tarjeta).toHaveCount(1);
    const imagen = tarjeta.locator('img');
    await expect(imagen).toHaveCount(1);
    await expect(imagen).toHaveAttribute('src', /generica/);
    await expect(imagen).toHaveAttribute('width', /^\d+$/);
    await expect(imagen).toHaveAttribute('height', /^\d+$/);
  });

  test('caso borde: el título de 120 caracteres no desborda la tarjeta y conserva el texto completo', async ({
    page,
  }) => {
    await abrir(page, RUTA_CON_TARJETA_LARGA);

    const tarjeta = page
      .getByRole('region', { name: /relacionados/i })
      .getByRole('article')
      .filter({ has: page.getByRole('link', { name: TITULO_LARGO }) });
    // El nombre accesible del enlace es el título completo, aunque se recorte con line-clamp.
    const enlace = tarjeta.getByRole('link', { name: TITULO_LARGO, exact: true });
    await expect(enlace).toHaveCount(1);
    const encabezado = tarjeta.getByRole('heading', { name: TITULO_LARGO });
    await expect(encabezado).toBeVisible();

    for (const elemento of [tarjeta, encabezado]) {
      const desborde = await elemento.evaluate((nodo) => nodo.scrollWidth - nodo.clientWidth);
      expect(desborde).toBeLessThanOrEqual(0);
    }
    expect(await encabezado.textContent()).toContain(TITULO_LARGO);
  });
});
