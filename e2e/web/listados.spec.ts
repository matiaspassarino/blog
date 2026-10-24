// T061: listados del blog (spec 002, H2-E1 a H2-E7; RF-007 a RF-011, RSEO-004, RSEO-009).
// Actualizado en la spec 005 (H7, T144): suma el artículo con tablas "Formatos, alineación y tablas en el editor".
// Datos del seed (supabase/seed.sql): 15 publicados (12 en /blog y 3 en /blog/pagina/2).
// - Diseño (`diseno`): 6 publicados, y además el programado "Tendencias de diseño…".
// - Branding (`branding`): 3 publicados y el mismo programado.
// - Eva Editora (`eva-editora`): 8 publicados, un programado y ningún avatar.
// El estado vacío (H2-E7) necesita una categoría y una etiqueta sin publicados, que el seed no
// tiene: cada worker crea las suyas como postgres (docker exec sobre supabase_db_blog), con un
// sufijo aleatorio, y las borra al terminar. No tienen artículos, así que no cambian ningún
// listado ni el sitemap de las demás suites.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrir, esperar404, taxonomiasVacias } from './ayudas';

const TITULO_TABLAS = 'Formatos, alineación y tablas en el editor';

const TITULOS_DISENO = [
  TITULO_TABLAS,
  'Guía visual: todos los bloques del blog',
  'Dos fotos también cuentan una historia',
  'Identidades visuales que nos inspiran',
  'Principios de accesibilidad web que todo sitio necesita',
  'Cómo elegir una tipografía para tu marca',
];
const TITULOS_BRANDING = [
  'Dos fotos también cuentan una historia',
  'Identidades visuales que nos inspiran',
  'Cómo elegir una tipografía para tu marca',
];
const TITULOS_EVA = [
  TITULO_TABLAS,
  'Guía visual: todos los bloques del blog',
  'Redes sociales para pymes: menos es más',
  'Dos fotos también cuentan una historia',
  'Identidades visuales que nos inspiran',
  'Fotos de producto con el celular',
  'Principios de accesibilidad web que todo sitio necesita',
  'Cómo elegir una tipografía para tu marca',
];
const TITULO_PROGRAMADO = 'Tendencias de diseño para el próximo año';
const TITULO_DE_OTRO_AUTOR = 'Primeros pasos con JavaScript moderno';
// Los tres publicados más antiguos: los únicos de /blog/pagina/2.
const TITULOS_PAGINA_2 = [
  'Fotos de producto con el celular',
  'Principios de accesibilidad web que todo sitio necesita',
  'Cómo elegir una tipografía para tu marca',
];
const BIOGRAFIA_EVA = 'Diseñadora de identidad visual. Le interesan la tipografía y la accesibilidad.';

/** Pide la ruta sin seguir redirecciones y verifica el 301 al destino. */
async function esperar301(page: Page, ruta: string, destino: string) {
  const respuesta = await page.request.get(ruta, { maxRedirects: 0 });
  expect(respuesta.status(), `${ruta} debería responder 301`).toBe(301);
  const ubicacion = respuesta.headers().location ?? '';
  expect(new URL(ubicacion, 'http://localhost:4321').pathname).toBe(destino);
}

/** Las tarjetas del listado (TarjetaArticulo es un <article>). */
function tarjetas(page: Page) {
  return page.getByRole('main').getByRole('article');
}

/** Títulos de las tarjetas, en el orden del documento. */
async function titulosDe(page: Page) {
  return tarjetas(page).getByRole('heading').allInnerTexts();
}

/** Verifica que las fechas de las tarjetas vayan de la más reciente a la más antigua (RF-007). */
async function esperarOrdenDescendente(page: Page) {
  const fechas = await tarjetas(page)
    .locator('time[datetime]')
    .evaluateAll((elementos) => elementos.map((e) => new Date(e.getAttribute('datetime') ?? '').getTime()));
  expect(fechas.length).toBeGreaterThan(0);
  expect(fechas.every((fecha) => !Number.isNaN(fecha))).toBe(true);
  expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
}

/** Cada tarjeta tiene un solo enlace, en su título de nivel 2, hacia el artículo (RF-009). */
async function esperarTarjetasConUnEnlace(lista: Locator) {
  const cantidad = await lista.count();
  for (let indice = 0; indice < cantidad; indice++) {
    const tarjeta = lista.nth(indice);
    await expect(tarjeta.getByRole('link')).toHaveCount(1);
    await expect(tarjeta.getByRole('heading', { level: 2 }).getByRole('link')).toHaveAttribute(
      'href',
      /^\/blog\/[a-z0-9-]+$/,
    );
  }
}

/** La página tiene un único h1 con el texto pedido. */
async function esperarH1(page: Page, texto: string) {
  const encabezados = page.getByRole('heading', { level: 1 });
  await expect(encabezados).toHaveCount(1);
  await expect(encabezados).toHaveText(texto);
}

/** La navegación de paginación. */
function paginacion(page: Page) {
  return page.getByRole('navigation', { name: 'Paginación' });
}

/** Verifica la canónica absoluta y propia de la página (RSEO-004). */
async function esperarCanonica(page: Page, ruta: string) {
  const canonica = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(canonica).toMatch(/^https?:\/\//);
  expect(new URL(canonica ?? '').pathname).toBe(ruta);
}

test.describe('H2-E1 / RF-007: /blog lista los publicados de a 12', () => {
  test('H2-E1: /blog tiene un único h1 y muestra las 12 tarjetas más recientes', async ({ page }) => {
    await abrir(page, '/blog');

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(tarjetas(page)).toHaveCount(12);
    const titulos = await titulosDe(page);
    expect(titulos[0]).toBe(TITULO_TABLAS);
    for (const titulo of TITULOS_PAGINA_2) expect(titulos).not.toContain(titulo);
    expect(titulos).not.toContain(TITULO_PROGRAMADO);
  });

  test('H2-E1 / RF-007: las tarjetas van de la más reciente a la más antigua', async ({ page }) => {
    await abrir(page, '/blog');

    await esperarOrdenDescendente(page);
  });

  test('RF-009: cada tarjeta es un <article> con un solo enlace, en el título', async ({ page }) => {
    await abrir(page, '/blog');

    await esperarTarjetasConUnEnlace(tarjetas(page));
  });

  test('H2-E1 / RF-010: la paginación marca la página actual y enlaza a /blog/pagina/2', async ({ page }) => {
    await abrir(page, '/blog');
    const nav = paginacion(page);

    await expect(nav).toBeVisible();
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.locator('[aria-current="page"]')).toContainText('1');
    await expect(nav.locator('a[href="/blog/pagina/2"]').first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /siguiente/i })).toHaveAttribute('href', '/blog/pagina/2');
  });

  test('RSEO-004: /blog tiene canónica propia y el título "Blog"', async ({ page }) => {
    await abrir(page, '/blog');

    await esperarCanonica(page, '/blog');
    await expect(page).toHaveTitle(/^Blog\b/);
  });
});

test.describe('RF-007 / RF-010 / RSEO-004: /blog/pagina/2', () => {
  test('RF-007: /blog/pagina/2 muestra los 3 publicados más antiguos', async ({ page }) => {
    await abrir(page, '/blog/pagina/2');

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(tarjetas(page)).toHaveCount(3);
    expect(await titulosDe(page)).toEqual(TITULOS_PAGINA_2);
    await esperarOrdenDescendente(page);
  });

  test('RSEO-004: tiene canónica propia (no la de la página 1) y "página 2" en el título', async ({ page }) => {
    await abrir(page, '/blog/pagina/2');

    await esperarCanonica(page, '/blog/pagina/2');
    await expect(page).toHaveTitle(/página 2/i);
  });

  test('RF-010: marca la página 2 como actual y ofrece volver a la anterior', async ({ page }) => {
    await abrir(page, '/blog/pagina/2');
    const nav = paginacion(page);

    await expect(nav.locator('[aria-current="page"]')).toContainText('2');
    await expect(nav.getByRole('link', { name: /anterior/i })).toHaveAttribute('href', '/blog');
    await expect(nav.getByRole('link', { name: /siguiente/i })).toHaveCount(0);
  });

  test('H2-E6: /blog/pagina/1 redirige con un 301 a /blog', async ({ page }) => {
    await esperar301(page, '/blog/pagina/1', '/blog');
  });

  test('H2-E5: /blog/pagina/99 responde 404', async ({ page }) => {
    await esperar404(page, '/blog/pagina/99');
  });

  test('H2-E5: /blog/pagina/abc (no es un entero) responde 404', async ({ page }) => {
    await esperar404(page, '/blog/pagina/abc');
  });
});

test.describe('H2-E2 / RF-008: página de categoría', () => {
  test('H2-E2: /blog/categoria/diseno muestra su nombre como h1 y su descripción', async ({ page }) => {
    await abrir(page, '/blog/categoria/diseno');

    await esperarH1(page, 'Diseño');
    await expect(
      page.getByRole('main').getByText('Identidad visual, tipografía y experiencia de usuario.'),
    ).toBeVisible();
  });

  test('H2-E2: muestra solo sus publicados, del más reciente al más antiguo', async ({ page }) => {
    await abrir(page, '/blog/categoria/diseno');

    expect(await titulosDe(page)).toEqual(TITULOS_DISENO);
    await esperarOrdenDescendente(page);
    // La tarjeta muestra la categoría: todas son de Diseño.
    const cantidad = await tarjetas(page).count();
    for (let indice = 0; indice < cantidad; indice++) {
      await expect(tarjetas(page).nth(indice).getByText('Diseño', { exact: true })).toBeVisible();
    }
  });

  test('RF-009: usa la misma tarjeta que /blog', async ({ page }) => {
    await abrir(page, '/blog/categoria/diseno');

    await esperarTarjetasConUnEnlace(tarjetas(page));
  });

  test('RSEO-004 / RSEO-009: tiene canónica propia y es indexable', async ({ page }) => {
    await abrir(page, '/blog/categoria/diseno');

    await esperarCanonica(page, '/blog/categoria/diseno');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page).toHaveTitle(/^Diseño\b/);
  });

  test('H2-E6: /blog/categoria/diseno/pagina/1 redirige con un 301 a la categoría', async ({ page }) => {
    await esperar301(page, '/blog/categoria/diseno/pagina/1', '/blog/categoria/diseno');
  });

  test('H2-E5: /blog/categoria/diseno/pagina/2 (fuera de rango) responde 404', async ({ page }) => {
    await esperar404(page, '/blog/categoria/diseno/pagina/2');
  });

  test('validación C-B1: el número sin "pagina/" no es una URL válida (404, sin duplicados)', async ({ page }) => {
    await esperar404(page, '/blog/categoria/diseno/1');
    await esperar404(page, '/blog/autor/eva-editora/1');
    await esperar404(page, '/blog/2');
  });
});

test.describe('H2-E3 / RF-008: página de etiqueta', () => {
  test('H2-E3: /blog/etiqueta/branding muestra su nombre como h1 y solo sus publicados', async ({ page }) => {
    await abrir(page, '/blog/etiqueta/branding');

    await esperarH1(page, 'Branding');
    expect(await titulosDe(page)).toEqual(TITULOS_BRANDING);
    await esperarOrdenDescendente(page);
  });

  test('RF-009 / RSEO-004: usa la misma tarjeta y tiene canónica propia', async ({ page }) => {
    await abrir(page, '/blog/etiqueta/branding');

    await esperarTarjetasConUnEnlace(tarjetas(page));
    await esperarCanonica(page, '/blog/etiqueta/branding');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test('H2-E5: /blog/etiqueta/branding/pagina/99 responde 404', async ({ page }) => {
    await esperar404(page, '/blog/etiqueta/branding/pagina/99');
  });
});

test.describe('H2-E4 / RF-008 / RF-011: página de autor', () => {
  test('H2-E4: /blog/autor/eva-editora muestra su nombre como h1, su foto y su biografía', async ({ page }) => {
    await abrir(page, '/blog/autor/eva-editora');
    const principal = page.getByRole('main');

    await esperarH1(page, 'Eva Editora');
    // El seed no tiene avatares: vale una <img> o el reemplazo con role="img" nombrado con la autora.
    await expect(principal.getByRole('img', { name: /Eva Editora/ }).first()).toBeVisible();
    await expect(principal.getByText(BIOGRAFIA_EVA)).toBeVisible();
  });

  test('H2-E4: muestra solo sus publicados, del más reciente al más antiguo', async ({ page }) => {
    await abrir(page, '/blog/autor/eva-editora');

    const titulos = await titulosDe(page);
    expect(titulos).toEqual(TITULOS_EVA);
    expect(titulos).not.toContain(TITULO_PROGRAMADO);
    expect(titulos).not.toContain(TITULO_DE_OTRO_AUTOR);
    await esperarOrdenDescendente(page);
    await esperarTarjetasConUnEnlace(tarjetas(page));
  });

  test('H2-E4: nunca muestra el rol ni el estado del miembro', async ({ page }) => {
    await abrir(page, '/blog/autor/eva-editora');

    // Solo la presentación: los extractos de las tarjetas pueden decir "editor" (el del blog).
    // "Editora" es parte del nombre; \b deja afuera ese caso y atrapa "editor", "admin" o "activo" sueltos.
    const texto = await page.getByRole('main').evaluate((principal) => {
      const copia = principal.cloneNode(true) as HTMLElement;
      for (const tarjeta of copia.querySelectorAll('article')) tarjeta.remove();
      return copia.textContent ?? '';
    });
    expect(texto).toContain('Eva Editora');
    expect(texto).not.toMatch(/\b(admin|administrador|administradora|editor|activo|activa|inactivo)\b/i);
  });

  for (const slug of ['ana-admin', 'eva-editora', 'edu-editor']) {
    test(`H2-E4: el HTML de /blog/autor/${slug} no contiene el correo`, async ({ page }) => {
      await abrir(page, `/blog/autor/${slug}`);

      const html = await page.content();
      expect(html).not.toContain('@demo.local');
      expect(html).not.toMatch(/"(email|rol|activo)"\s*:/);
    });
  }

  test('RSEO-004: tiene canónica propia y el nombre en el título', async ({ page }) => {
    await abrir(page, '/blog/autor/eva-editora');

    await esperarCanonica(page, '/blog/autor/eva-editora');
    await expect(page).toHaveTitle(/^Eva Editora\b/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'profile');
  });

  test('RF-011: un autor inexistente responde 404', async ({ page }) => {
    await esperar404(page, '/blog/autor/no-existe');
  });

  test('H2-E5: /blog/autor/eva-editora/pagina/2 (fuera de rango) responde 404', async ({ page }) => {
    await esperar404(page, '/blog/autor/eva-editora/pagina/2');
  });
});

test.describe('H2-E7 / RSEO-009: categoría y etiqueta sin publicados', () => {
  const vacias = taxonomiasVacias();
  const nombre = vacias.nombre;

  test.beforeAll(() => {
    vacias.crear();
  });

  test.afterAll(() => {
    vacias.borrar();
  });

  for (const tipo of ['categoria', 'etiqueta'] as const) {
    test(`H2-E7: una ${tipo} sin publicados muestra el estado vacío con un enlace al blog`, async ({ page }) => {
      const slug = tipo === 'categoria' ? vacias.slugCategoria : vacias.slugEtiqueta;
      await abrir(page, `/blog/${tipo}/${slug}`);
      const principal = page.getByRole('main');

      await esperarH1(page, nombre);
      await expect(tarjetas(page)).toHaveCount(0);
      await expect(principal.getByRole('link', { name: /blog/i }).first()).toHaveAttribute('href', '/blog');
      await expect(paginacion(page)).toHaveCount(0);
    });

    test(`RSEO-009: una ${tipo} sin publicados tiene meta robots noindex`, async ({ page }) => {
      const slug = tipo === 'categoria' ? vacias.slugCategoria : vacias.slugEtiqueta;
      await abrir(page, `/blog/${tipo}/${slug}`);

      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    });
  }
});
