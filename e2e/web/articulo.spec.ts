// T048: página de artículo (spec 002, H1-E1, H1-E2, H1-E4, RF-001, RF-005, RF-026).
// Usa "Guía visual: todos los bloques del blog" del seed (T012): autora Eva Editora,
// categoría Diseño, etiquetas UX, Accesibilidad y Tipografía, y los 10 tipos de bloque.
import { expect, test, type Locator, type Page, type Request } from '@playwright/test';

const RUTA_GUIA = '/blog/guia-visual-todos-los-bloques-del-blog';
const TITULO_GUIA = 'Guía visual: todos los bloques del blog';
const ALT_DESTACADA = 'Piezas de un sistema de diseño ordenadas sobre una mesa';
const DOMINIOS_VIDEO = /(^|\.)(youtube\.com|youtube-nocookie\.com|ytimg\.com)$/;

/** Abre la guía y verifica que responde 200. */
async function abrirGuia(page: Page) {
  const respuesta = await page.goto(RUTA_GUIA);
  expect(respuesta?.status(), `${RUTA_GUIA} debería responder 200`).toBe(200);
}

/** Posición del elemento en el orden del documento. */
function posicionEnDocumento(locator: Locator) {
  return locator.evaluate((elemento) => Array.from(document.querySelectorAll('*')).indexOf(elemento));
}

test.describe('artículo publicado: la guía de bloques', () => {
  test('H1-E1: tiene un único h1, con el título del artículo', async ({ page }) => {
    await abrirGuia(page);

    const encabezados = page.getByRole('heading', { level: 1 });
    await expect(encabezados).toHaveCount(1);
    await expect(encabezados).toHaveText(TITULO_GUIA);
  });

  test('H1-E1 / RF-001: muestra el nombre y la foto de la autora', async ({ page }) => {
    await abrirGuia(page);
    const principal = page.getByRole('main');

    await expect(principal.getByText('Eva Editora').first()).toBeVisible();
    // El seed no tiene avatares: vale una <img> o un reemplazo con role="img" nombrado con la autora.
    await expect(principal.getByRole('img', { name: /Eva Editora/ }).first()).toBeVisible();
  });

  test('H1-E1 / RF-001: la fecha de publicación va en <time datetime>', async ({ page }) => {
    await abrirGuia(page);

    const fecha = page.getByRole('main').locator('time[datetime]').first();
    await expect(fecha).toBeVisible();
    await expect(fecha).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}/);
    await expect(fecha).not.toHaveText('');
  });

  test('H1-E1: la categoría y las etiquetas están enlazadas', async ({ page }) => {
    await abrirGuia(page);
    const principal = page.getByRole('main');

    await expect(principal.getByRole('link', { name: 'Diseño', exact: true }).first()).toHaveAttribute(
      'href',
      '/blog/categoria/diseno',
    );
    for (const [nombre, slug] of [
      ['UX', 'ux'],
      ['Accesibilidad', 'accesibilidad'],
      ['Tipografía', 'tipografia'],
    ] as const) {
      await expect(principal.getByRole('link', { name: nombre, exact: true }).first()).toHaveAttribute(
        'href',
        `/blog/etiqueta/${slug}`,
      );
    }
  });

  test('H1-E1: los 10 tipos de bloque se muestran en el orden del contenido', async ({ page }) => {
    await abrirGuia(page);
    const principal = page.getByRole('main');

    const bloques = {
      parrafo: principal.getByText('Este artículo reúne todos los bloques del editor.'),
      titulo: principal.getByRole('heading', { level: 2, name: 'Imágenes y citas' }),
      imagen: principal.getByRole('img', { name: 'Boceto de una interfaz dibujado a mano' }),
      cita: principal.getByRole('blockquote').filter({ hasText: 'El diseño no es solo cómo se ve' }),
      lista: principal.getByRole('list').filter({ has: page.getByText('Definir el objetivo.') }),
      galeria: principal
        .getByRole('list')
        .filter({ has: page.getByRole('img', { name: 'Paleta de colores impresa' }) }),
      cta: principal.getByRole('link', { name: /Ver las pautas/ }),
      separador: principal.getByRole('separator'),
      codigo: principal.getByText('<script>alert(1)</script>'),
      video: principal.getByTitle('Video de muestra del bloque de video'),
    };

    const posiciones: number[] = [];
    for (const [tipo, bloque] of Object.entries(bloques)) {
      await expect(bloque.first(), `falta el bloque ${tipo}`).toBeAttached();
      posiciones.push(await posicionEnDocumento(bloque.first()));
    }
    expect(posiciones).toEqual([...posiciones].sort((a, b) => a - b));

    // La lista del seed es ordenada y la galería tiene sus 4 imágenes.
    expect(await bloques.lista.first().evaluate((elemento) => elemento.tagName)).toBe('OL');
    await expect(bloques.galeria.first().getByRole('listitem')).toHaveCount(4);
    // El segundo título es de nivel 3.
    await expect(principal.getByRole('heading', { level: 3, name: 'Código y video' })).toBeAttached();
  });

  test('H1-E3: la imagen decorativa no expone texto alternativo', async ({ page }) => {
    await abrirGuia(page);

    const sinAlt = await page.getByRole('main').locator('img:not([alt])').count();
    expect(sinAlt, 'toda <img> debe tener alt (vacío si es decorativa)').toBe(0);
    await expect(page.getByRole('main').locator('img[alt=""]').first()).toBeAttached();
  });

  test('H1-E2: el bloque de código muestra <script> como texto y no lo ejecuta', async ({ page }) => {
    const dialogos: string[] = [];
    page.on('dialog', async (dialogo) => {
      dialogos.push(dialogo.message());
      await dialogo.dismiss();
    });

    await abrirGuia(page);

    const codigo = page.getByRole('main').locator('pre code');
    await expect(codigo.first()).toContainText('<script>alert(1)</script>');
    await expect(codigo.first()).toContainText('Este código se muestra como texto y nunca se ejecuta.');
    expect(dialogos).toEqual([]);
  });

  test('H1-E4: al cargar la página no hay peticiones a YouTube fuera del srcdoc del video', async ({ page }) => {
    const peticionesVideo: string[] = [];
    page.on('request', (peticion: Request) => {
      const { hostname } = new URL(peticion.url());
      // Las peticiones de la miniatura dentro del iframe srcdoc son esperables (research D6).
      if (DOMINIOS_VIDEO.test(hostname) && peticion.frame() === page.mainFrame()) {
        peticionesVideo.push(peticion.url());
      }
    });

    await abrirGuia(page);
    const video = page.getByRole('main').getByTitle('Video de muestra del bloque de video');
    await video.scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');

    expect(peticionesVideo).toEqual([]);
    // Ningún iframe navegó al reproductor del proveedor: el video se carga recién con el clic.
    const urlsDeMarcos = page.frames().map((marco) => marco.url());
    expect(urlsDeMarcos.filter((url) => /youtube(-nocookie)?\.com/.test(url))).toEqual([]);
    await expect(video).toHaveAttribute('srcdoc', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
    await expect(page.getByRole('main').getByRole('link', { name: /Ver en YouTube/ })).toBeVisible();
  });

  test('RF-026: toda <img> tiene width y height', async ({ page }) => {
    await abrirGuia(page);

    const imagenes = page.locator('img');
    expect(await imagenes.count()).toBeGreaterThan(0);
    const sinDimensiones = await imagenes.evaluateAll((lista) =>
      lista
        .filter((imagen) => !imagen.getAttribute('width') || !imagen.getAttribute('height'))
        .map((imagen) => imagen.outerHTML.slice(0, 120)),
    );
    expect(sinDimensiones).toEqual([]);
  });

  test('RF-026: la imagen destacada carga con prioridad y las del cuerpo, diferidas', async ({ page }) => {
    await abrirGuia(page);
    const principal = page.getByRole('main');

    const destacada = principal.getByRole('img', { name: ALT_DESTACADA });
    await expect(destacada).toHaveAttribute('fetchpriority', 'high');
    await expect(destacada).not.toHaveAttribute('loading', 'lazy');

    const delCuerpo = [
      principal.getByRole('img', { name: 'Boceto de una interfaz dibujado a mano' }),
      principal.getByRole('img', { name: 'Paleta de colores impresa' }),
      principal.getByRole('img', { name: 'Tarjetas personales sobre papel kraft' }),
      principal.getByRole('img', { name: 'Pantalla con una grilla de diseño' }),
      principal.getByRole('img', { name: 'Cuaderno con tipografías dibujadas' }),
      principal.locator('img[alt=""]').first(),
    ];
    for (const imagen of delCuerpo) {
      await expect(imagen).toHaveAttribute('loading', 'lazy');
    }
  });

  test('RF-005: la ficha de la autora enlaza a su página y muestra su biografía', async ({ page }) => {
    await abrirGuia(page);
    const principal = page.getByRole('main');

    const enlacesAutora = principal.getByRole('link', { name: /Eva Editora/ });
    await expect(enlacesAutora.first()).toBeVisible();
    const destinos = await enlacesAutora.evaluateAll((enlaces) => enlaces.map((enlace) => enlace.getAttribute('href')));
    expect(destinos).toContain('/blog/autor/eva-editora');
    await expect(principal.getByText('Diseñadora de identidad visual.', { exact: false })).toBeVisible();
  });

  test('RF-005: muestra hasta 3 relacionados de la misma categoría, sin el propio artículo', async ({ page }) => {
    await abrirGuia(page);

    const relacionados = page.getByRole('region', { name: /relacionados/i });
    await expect(relacionados).toBeVisible();
    // Diseño tiene otros 4 publicados en el seed: se muestran exactamente 3.
    const tarjetas = relacionados.getByRole('article');
    await expect(tarjetas).toHaveCount(3);
    for (const tarjeta of await tarjetas.all()) {
      await expect(tarjeta.getByText('Diseño', { exact: true })).toBeVisible();
      await expect(tarjeta.getByRole('link').first()).toHaveAttribute('href', /^\/blog\/[a-z0-9-]+$/);
    }
    await expect(relacionados.getByRole('link', { name: TITULO_GUIA })).toHaveCount(0);
  });
});
