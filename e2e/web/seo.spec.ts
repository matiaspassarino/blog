// T087: metadatos, datos estructurados, sitemap, feed y robots (spec 002, H5-E1 a H5-E6;
// RSEO-001 a RSEO-007, CE-003; contracts/rutas.md, "Metadatos por ruta").
// Datos del seed (supabase/seed.sql):
// - 14 publicados: el feed tiene min(20, publicados) ítems; se cuentan en /blog y /blog/pagina/2.
// - Borrador: `checklist-de-lanzamiento-de-un-sitio`. Slugs anteriores: el artículo
//   `escribir-para-la-web`, la categoría `marketing` y la etiqueta `redes-sociales`.
// - La taxonomía vacía (RSEO-009) la crea cada worker con taxonomiasVacias() (ayudas.ts).
// PUBLIC_URL_SITIO vale http://localhost:4321 en local (apps/web/.env).
import { expect, test, type Page } from '@playwright/test';
import { taxonomiasVacias } from './ayudas';

const URL_SITIO = (process.env.PUBLIC_URL_SITIO ?? 'http://localhost:4321').replace(/\/$/, '');

type PaginaPublica = { nombre: string; ruta: string; estado: number; ogType: string; jsonLd: string[] };

const PAGINAS: PaginaPublica[] = [
  { nombre: 'portada', ruta: '/', estado: 200, ogType: 'website', jsonLd: ['Organization', 'WebSite'] },
  { nombre: 'blog', ruta: '/blog', estado: 200, ogType: 'website', jsonLd: ['CollectionPage', 'BreadcrumbList'] },
  {
    nombre: 'blog página 2',
    ruta: '/blog/pagina/2',
    estado: 200,
    ogType: 'website',
    jsonLd: ['CollectionPage', 'BreadcrumbList'],
  },
  {
    nombre: 'artículo',
    ruta: '/blog/guia-visual-todos-los-bloques-del-blog',
    estado: 200,
    ogType: 'article',
    jsonLd: ['BlogPosting', 'BreadcrumbList'],
  },
  {
    nombre: 'categoría',
    ruta: '/blog/categoria/diseno',
    estado: 200,
    ogType: 'website',
    jsonLd: ['CollectionPage', 'BreadcrumbList'],
  },
  {
    nombre: 'etiqueta',
    ruta: '/blog/etiqueta/ux',
    estado: 200,
    ogType: 'website',
    jsonLd: ['CollectionPage', 'BreadcrumbList'],
  },
  {
    nombre: 'autor',
    ruta: '/blog/autor/eva-editora',
    estado: 200,
    ogType: 'profile',
    jsonLd: ['ProfilePage', 'BreadcrumbList'],
  },
  { nombre: 'no encontrada', ruta: '/no-existe-e2e-seo', estado: 404, ogType: 'website', jsonLd: [] },
];

type Dato = Record<string, unknown>;

/** Abre la ruta y verifica el estado. */
async function abrir(page: Page, ruta: string, estado = 200) {
  const respuesta = await page.goto(ruta);
  expect(respuesta?.status(), `${ruta} debería responder ${estado}`).toBe(estado);
}

/** Contenido de un <meta> por property (og:*, article:*) o por name (description, twitter:*). */
async function meta(page: Page, clave: string) {
  const atributo = clave.startsWith('og:') || clave.startsWith('article:') ? 'property' : 'name';
  const elementos = page.locator(`head meta[${atributo}="${clave}"]`);
  await expect(elementos, `una sola meta ${clave}`).toHaveCount(1);
  return (await elementos.getAttribute('content')) ?? '';
}

/** Parsea cada <script type="application/ld+json"> de la página (falla si alguno no es JSON). */
async function jsonLdDe(page: Page): Promise<Dato[]> {
  const textos = await page.locator('script[type="application/ld+json"]').allTextContents();
  return textos.flatMap((texto) => {
    const dato = JSON.parse(texto) as Dato | Dato[];
    return Array.isArray(dato) ? dato : [dato];
  });
}

const esAbsoluta = (url: string) => url.startsWith(`${URL_SITIO}/`) || /^https:\/\//.test(url);

test.describe('H5-E3 / RSEO-001: metadatos de toda página pública', () => {
  for (const pagina of PAGINAS) {
    test(`H5-E3: ${pagina.nombre} (${pagina.ruta}) tiene idioma, título, descripción, canónica, OG, Twitter y feed`, async ({
      page,
    }) => {
      await abrir(page, pagina.ruta, pagina.estado);

      await expect(page.locator('html')).toHaveAttribute('lang', 'es');

      const titulo = await page.title();
      expect(titulo.length, `título: "${titulo}"`).toBeGreaterThan(0);
      expect(titulo.length, `título: "${titulo}"`).toBeLessThanOrEqual(60);

      const descripcion = await meta(page, 'description');
      expect(descripcion.length).toBeGreaterThan(0);
      expect(descripcion.length).toBeLessThanOrEqual(160);

      const canonica = page.locator('head link[rel="canonical"]');
      await expect(canonica).toHaveCount(1);
      const urlCanonica = (await canonica.getAttribute('href')) ?? '';
      expect(urlCanonica).toMatch(/^https?:\/\//);
      if (pagina.estado === 200) expect(new URL(urlCanonica).pathname).toBe(pagina.ruta);

      expect(await meta(page, 'og:type')).toBe(pagina.ogType);
      expect((await meta(page, 'og:title')).length).toBeGreaterThan(0);
      expect((await meta(page, 'og:description')).length).toBeGreaterThan(0);
      expect(await meta(page, 'og:url')).toBe(urlCanonica);
      expect(esAbsoluta(await meta(page, 'og:image'))).toBe(true);
      expect(Number(await meta(page, 'og:image:width'))).toBeGreaterThan(0);
      expect(Number(await meta(page, 'og:image:height'))).toBeGreaterThan(0);
      expect(await meta(page, 'twitter:card')).toBe('summary_large_image');

      // RSEO-006: toda página anuncia el feed.
      await expect(page.locator('head link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
        'href',
        /\/rss\.xml$/,
      );
    });
  }

  test('RSEO-002: el artículo declara article:published_time, article:modified_time y article:section', async ({
    page,
  }) => {
    await abrir(page, '/blog/guia-visual-todos-los-bloques-del-blog');
    expect(Number.isNaN(Date.parse(await meta(page, 'article:published_time')))).toBe(false);
    expect(Number.isNaN(Date.parse(await meta(page, 'article:modified_time')))).toBe(false);
    expect(await meta(page, 'article:section')).toBe('Diseño');
  });
});

test.describe('H5-E4 / RSEO-002 / RSEO-003: datos estructurados por tipo de página', () => {
  for (const pagina of PAGINAS) {
    const esperados = pagina.jsonLd.length > 0 ? pagina.jsonLd.join(' + ') : 'ninguno obligatorio';
    test(`H5-E4: ${pagina.nombre} (${pagina.ruta}) declara JSON-LD válido: ${esperados}`, async ({ page }) => {
      await abrir(page, pagina.ruta, pagina.estado);
      const datos = await jsonLdDe(page);

      for (const dato of datos) expect(dato['@context']).toBe('https://schema.org');
      const tipos = datos.map((dato) => dato['@type']);
      for (const tipo of pagina.jsonLd) expect(tipos, `${pagina.ruta} debería declarar ${tipo}`).toContain(tipo);
    });
  }

  test('H5-E4: el BlogPosting del artículo tiene titular, imagen, autor, editor, fechas y URL absoluta', async ({
    page,
  }) => {
    const ruta = '/blog/guia-visual-todos-los-bloques-del-blog';
    await abrir(page, ruta);
    const articulo = (await jsonLdDe(page)).find((dato) => dato['@type'] === 'BlogPosting');
    expect(articulo, 'BlogPosting').toBeDefined();

    expect(articulo?.headline).toBe('Guía visual: todos los bloques del blog');
    expect(esAbsoluta(String(articulo?.image))).toBe(true);
    expect(articulo?.author).toMatchObject({ '@type': 'Person', url: `${URL_SITIO}/blog/autor/eva-editora` });
    expect((articulo?.publisher as Dato | undefined)?.['@type']).toBe('Organization');
    expect(Number.isNaN(Date.parse(String(articulo?.datePublished)))).toBe(false);
    expect(Number.isNaN(Date.parse(String(articulo?.dateModified)))).toBe(false);
    expect(articulo?.url).toBe(`${URL_SITIO}${ruta}`);
  });

  test('RSEO-002: las migas del artículo son Inicio › Blog › Diseño › artículo, con item absoluto', async ({
    page,
  }) => {
    await abrir(page, '/blog/guia-visual-todos-los-bloques-del-blog');
    const migas = (await jsonLdDe(page)).find((dato) => dato['@type'] === 'BreadcrumbList');
    const elementos = (migas?.itemListElement ?? []) as Dato[];

    expect(elementos.map((elemento) => elemento.position)).toEqual([1, 2, 3, 4]);
    expect(elementos.map((elemento) => elemento.item)).toEqual([
      `${URL_SITIO}/`,
      `${URL_SITIO}/blog`,
      `${URL_SITIO}/blog/categoria/diseno`,
      `${URL_SITIO}/blog/guia-visual-todos-los-bloques-del-blog`,
    ]);
  });

  test('RSEO-003: la página de autor declara una ProfilePage con mainEntity Person', async ({ page }) => {
    await abrir(page, '/blog/autor/eva-editora');
    const perfil = (await jsonLdDe(page)).find((dato) => dato['@type'] === 'ProfilePage');
    expect(perfil?.mainEntity).toMatchObject({ '@type': 'Person', name: 'Eva Editora' });
  });
});

/** Las <url> del sitemap, parseado con DOMParser en el navegador (falla si no está bien formado). */
async function urlsDelSitemap(page: Page, xml: string) {
  return page.evaluate((texto) => {
    const documento = new DOMParser().parseFromString(texto, 'application/xml');
    const error = documento.querySelector('parsererror');
    if (error) throw new Error(`sitemap mal formado: ${error.textContent}`);
    return Array.from(documento.getElementsByTagName('url')).map((url) => ({
      loc: url.getElementsByTagName('loc')[0]?.textContent ?? '',
      lastmod: url.getElementsByTagName('lastmod')[0]?.textContent ?? '',
    }));
  }, xml);
}

/** El feed, parseado con DOMParser en el navegador (falla si no está bien formado). */
async function datosDelFeed(page: Page, xml: string) {
  return page.evaluate((texto) => {
    const documento = new DOMParser().parseFromString(texto, 'application/xml');
    const error = documento.querySelector('parsererror');
    if (error) throw new Error(`feed mal formado: ${error.textContent}`);
    const hijo = (padre: Element, nombre: string) =>
      Array.from(padre.children).find((elemento) => elemento.nodeName === nombre)?.textContent ?? '';
    const canal = documento.getElementsByTagName('channel')[0];
    if (!canal) throw new Error('el feed no tiene <channel>');
    const atomLink = Array.from(canal.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'link')).find(
      (elemento) => elemento.parentElement === canal,
    );
    return {
      raiz: documento.documentElement.nodeName,
      version: documento.documentElement.getAttribute('version'),
      titulo: hijo(canal, 'title'),
      enlace: hijo(canal, 'link'),
      atomSelf: atomLink
        ? {
            rel: atomLink.getAttribute('rel'),
            href: atomLink.getAttribute('href'),
            tipo: atomLink.getAttribute('type'),
          }
        : null,
      items: Array.from(canal.getElementsByTagName('item')).map((item) => ({
        titulo: hijo(item, 'title'),
        enlace: hijo(item, 'link'),
        descripcion: hijo(item, 'description'),
        fecha: hijo(item, 'pubDate'),
        categorias: Array.from(item.getElementsByTagName('category')).map((categoria) => categoria.textContent ?? ''),
      })),
    };
  }, xml);
}

test.describe('H5-E1 / RSEO-005 / RSEO-009: /sitemap.xml', () => {
  const vacias = taxonomiasVacias();

  test.beforeAll(() => {
    vacias.crear();
  });

  test.afterAll(() => {
    vacias.borrar();
  });

  test('H5-E1: incluye las páginas públicas indexables con lastmod, y excluye vacías, borradores y slugs anteriores', async ({
    page,
    request,
  }) => {
    const respuesta = await request.get('/sitemap.xml');
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['content-type']).toMatch(/xml/);

    const urls = await urlsDelSitemap(page, await respuesta.text());
    const locs = urls.map((url) => url.loc);

    for (const ruta of [
      '/',
      '/blog',
      '/blog/guia-visual-todos-los-bloques-del-blog',
      '/blog/categoria/diseno',
      '/blog/autor/eva-editora',
    ]) {
      expect(locs, `el sitemap debería incluir ${ruta}`).toContain(new URL(ruta, `${URL_SITIO}/`).href);
    }
    for (const url of urls) {
      expect(url.loc.startsWith(`${URL_SITIO}/`), url.loc).toBe(true);
      expect(Number.isNaN(Date.parse(url.lastmod)), `lastmod de ${url.loc}`).toBe(false);
    }

    for (const ruta of [
      `/blog/categoria/${vacias.slugCategoria}`,
      `/blog/etiqueta/${vacias.slugEtiqueta}`,
      '/blog/checklist-de-lanzamiento-de-un-sitio',
      '/blog/escribir-para-la-web',
      '/blog/categoria/marketing',
      '/blog/etiqueta/redes-sociales',
    ]) {
      expect(locs, `el sitemap no debería incluir ${ruta}`).not.toContain(`${URL_SITIO}${ruta}`);
    }
  });
});

/** Enlaces de las tarjetas de /blog y /blog/pagina/2: todos los publicados (12 + 2 en el seed). */
async function enlacesPublicados(page: Page) {
  const enlaces: string[] = [];
  for (const ruta of ['/blog', '/blog/pagina/2']) {
    await abrir(page, ruta);
    const hrefs = await page
      .getByRole('main')
      .getByRole('article')
      .getByRole('heading', { level: 2 })
      .getByRole('link')
      .evaluateAll((elementos) => elementos.map((elemento) => elemento.getAttribute('href') ?? ''));
    enlaces.push(...hrefs);
  }
  return enlaces;
}

test.describe('H5-E2 / RSEO-006: /rss.xml', () => {
  test('H5-E2: es un RSS 2.0 válido con los min(20, publicados) más recientes, enlaces absolutos, extracto, fecha y categoría', async ({
    page,
    request,
  }) => {
    const publicados = await enlacesPublicados(page);
    expect(publicados.length).toBeGreaterThan(0);

    const respuesta = await request.get('/rss.xml');
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['content-type']).toMatch(/xml/);

    const feed = await datosDelFeed(page, await respuesta.text());

    expect(feed.raiz).toBe('rss');
    expect(feed.version).toBe('2.0');
    expect(feed.titulo.length).toBeGreaterThan(0);
    expect(feed.enlace.startsWith(URL_SITIO)).toBe(true);
    // Aviso del validador de W3C: el canal declara su propia URL con atom:link rel="self".
    expect(feed.atomSelf).toEqual({ rel: 'self', href: `${URL_SITIO}/rss.xml`, tipo: 'application/rss+xml' });

    expect(feed.items).toHaveLength(Math.min(20, publicados.length));
    for (const item of feed.items) {
      expect(item.titulo.length, item.enlace).toBeGreaterThan(0);
      expect(item.enlace.startsWith(`${URL_SITIO}/blog/`), `link absoluto: ${item.enlace}`).toBe(true);
      expect(item.descripcion.length, `description de ${item.enlace}`).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(item.fecha)), `pubDate de ${item.enlace}`).toBe(false);
      expect(
        item.categorias.filter((categoria) => categoria.length > 0).length,
        `category de ${item.enlace}`,
      ).toBeGreaterThan(0);
    }

    // Los más recientes primero: el mismo orden que el listado del blog.
    const rutasFeed = feed.items.map((item) => new URL(item.enlace).pathname);
    expect(rutasFeed).toEqual(publicados.slice(0, 20));
  });
});

test.describe('H5-E5 / RSEO-007: /robots.txt', () => {
  test('H5-E5: permite lo público, bloquea /api/ y declara el sitemap absoluto', async ({ request }) => {
    const respuesta = await request.get('/robots.txt');
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['content-type']).toMatch(/text\/plain/);

    const lineas = (await respuesta.text()).split(/\r?\n/).map((linea) => linea.trim());
    expect(lineas).toContain('User-agent: *');
    expect(lineas).toContain('Allow: /');
    expect(lineas).toContain('Disallow: /api/');
    expect(lineas).toContain(`Sitemap: ${URL_SITIO}/sitemap.xml`);
  });
});

test.describe('H5-E6 / RSEO-007: noindex fuera de producción', () => {
  test('H5-E6: en local (sin VERCEL_ENV=production) las páginas responden con X-Robots-Tag: noindex', async ({
    request,
  }) => {
    const respuesta = await request.get('/blog');
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()['x-robots-tag']).toBe('noindex');
  });
});
