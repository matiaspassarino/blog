// T048: página de artículo (spec 002, H1-E1, H1-E2, H1-E4, RF-001, RF-005, RF-026). Al final, T127 (spec 005, H6).
// Usa "Guía visual: todos los bloques del blog" del seed (T012): autora Eva Editora,
// categoría Diseño, etiquetas UX, Accesibilidad y Tipografía, y los 10 tipos de bloque.
import { expect, test, type Locator, type Page, type Request } from '@playwright/test';
import { alineado, MARCAS, parrafo, texto, titulo } from '../admin/ayudas/articulos';
import { servicio } from '../admin/ayudas/servicio';

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

// ---------------------------------------------------------------------------------------------------------------------
// T127 (spec 005, Fase 12, H6 esc. 4 y 5; RF-024 y RF-026; research D27 y D31 U7, U9 y U16): el sitio muestra los
// formatos nuevos y la alineación. FASE ROJA: el renderer solo dibuja strong, em, code y a, y no lee `textAlign`.
//
// El artículo con tablas, formatos y alineaciones llega al seed recién en T144 (Fase 13). Mientras tanto, para no
// cambiar los listados que prueban otros archivos (cantidad de publicados, páginas, RSS), esta prueba agrega por un rato
// elementos al final de un publicado del seed que ninguna otra prueba usa ("Cómo responder consultas más rápido") y
// después le devuelve su contenido. Corre en orden en un solo trabajador, que modifica y restaura.
//
// "Igual que en el lienzo": `editor-documento.spec.ts` compara el lienzo con la vista previa del panel (mismos estilos
// calculados); la vista previa y el sitio usan el mismo `<Documento>` y las mismas clases (`render/clases.ts`). Acá se
// comprueba que el sitio real (con su CSS de Tailwind) dibuja esas etiquetas y estilos.
// ---------------------------------------------------------------------------------------------------------------------

const RUTA_FORMATOS = '/blog/como-responder-consultas-mas-rapido';
const SLUG_FORMATOS = 'como-responder-consultas-mas-rapido';

/** Los elementos que se agregan al final del artículo (con los nueve formatos y las tres alineaciones guardadas). */
const elementosConFormato = () => [
  alineado(titulo(2, 'Formatos del editor'), 'center'),
  alineado(
    parrafo(
      texto('subrayado', MARCAS.subrayado),
      ' ',
      texto('tachado', MARCAS.tachado),
      ' ',
      texto('resaltado', MARCAS.resaltado),
      ' m',
      texto('2', MARCAS.superindice),
      ' H',
      texto('2', MARCAS.subindice),
      'O, un ',
      texto('enlace', MARCAS.enlace('/blog')),
      ', un ',
      texto('enlace subrayado', MARCAS.enlace('/blog'), MARCAS.subrayado),
      ', ',
      texto('todo junto', MARCAS.negrita, MARCAS.cursiva, MARCAS.subrayado, MARCAS.tachado, MARCAS.resaltado),
      ' y ',
      texto('código', MARCAS.codigo),
      '.',
    ),
    'justify',
  ),
  alineado(parrafo('Un párrafo a la derecha.'), 'right'),
  alineado(parrafo('Un párrafo centrado.'), 'center'),
];
const TEXTO_DEL_PARRAFO = 'subrayado tachado resaltado m2 H2O, un enlace, un enlace subrayado, todo junto y código.';

type Articulo = { id: string; version: number; contenido: { type: 'doc'; content: unknown[] } };

async function leerArticulo(): Promise<Articulo> {
  const { data, error } = await servicio()
    .from('articulos')
    .select('id, version, contenido')
    .eq('slug', SLUG_FORMATOS)
    .single();
  if (error || !data) throw new Error(`No está el artículo ${SLUG_FORMATOS} del seed: ${error?.message}`);
  return data as unknown as Articulo;
}

async function cambiarContenido(contenido: Articulo['contenido']) {
  const { id, version } = await leerArticulo();
  const { error } = await servicio()
    .from('articulos')
    .update({ contenido: contenido as never, version })
    .eq('id', id);
  if (error) throw new Error(`No se pudo cambiar el contenido: ${error.message}`);
}

const parrafoConFormatos = (page: Page) => page.getByRole('main').locator('p').filter({ hasText: 'tachado resaltado' });
const alineacionDe = (localizador: Locator) =>
  localizador.evaluate((el) => {
    const e = getComputedStyle(el);
    return { alineacion: e.textAlign, guiones: e.hyphens };
  });
const lineaDe = (localizador: Locator) =>
  localizador.evaluate((el) => {
    const e = getComputedStyle(el);
    return {
      linea: e.textDecorationLine,
      color: e.color,
      colorDeLinea: e.textDecorationColor,
      grosor: e.textDecorationThickness,
      separacion: e.textUnderlineOffset,
    };
  });

test.describe('artículo con más formato y alineación (H6-E4, H6-E5, RF-026)', () => {
  // En orden y en un solo trabajador (opta por salir de fullyParallel), sin saltear el resto si una falla.
  test.describe.configure({ mode: 'default' });
  let original: Articulo['contenido'] | undefined;

  test.beforeAll(async () => {
    original = (await leerArticulo()).contenido;
    await cambiarContenido({ ...original, content: [...original.content, ...elementosConFormato()] });
  });

  test.afterAll(async () => {
    if (original) await cambiarContenido(original);
  });

  test('H6-E5: cada formato se dibuja con su etiqueta y los lectores reciben el texto completo', async ({ page }) => {
    await page.goto(RUTA_FORMATOS);
    const parrafoFormateado = parrafoConFormatos(page);

    await expect(parrafoFormateado).toHaveText(TEXTO_DEL_PARRAFO);
    await expect(parrafoFormateado.locator('u').first()).toHaveText('subrayado');
    await expect(parrafoFormateado.locator('s').first()).toHaveText('tachado');
    await expect(parrafoFormateado.locator('mark').first()).toHaveText('resaltado');
    await expect(parrafoFormateado.locator('sup')).toHaveText('2');
    await expect(parrafoFormateado.locator('sub')).toHaveText('2');
    await expect(parrafoFormateado.locator('code')).toHaveText('código');
    await expect(parrafoFormateado.locator('strong em u s mark')).toHaveText('todo junto');
    await expect(parrafoFormateado.locator('[aria-hidden="true"]')).toHaveCount(0);
  });

  test('D31 U9: un enlace subrayado se ve solo como enlace (sin una segunda línea)', async ({ page }) => {
    await page.goto(RUTA_FORMATOS);
    const enlace = parrafoConFormatos(page).getByRole('link', { name: 'enlace subrayado' });

    await expect(enlace).toHaveAttribute('href', '/blog');
    await expect(enlace.locator('u')).toHaveCount(0);
  });

  test('H6-E4 / D31 U16: los párrafos y el título se alinean (el justificado divide palabras)', async ({ page }) => {
    await page.goto(RUTA_FORMATOS);
    const principal = page.getByRole('main');

    expect(await alineacionDe(principal.getByRole('heading', { level: 2, name: 'Formatos del editor' }))).toMatchObject(
      { alineacion: 'center' },
    );
    expect(await alineacionDe(parrafoConFormatos(page))).toEqual({ alineacion: 'justify', guiones: 'auto' });
    expect(await alineacionDe(principal.getByText('Un párrafo a la derecha.'))).toMatchObject({ alineacion: 'right' });
    expect(await alineacionDe(principal.getByText('Un párrafo centrado.'))).toMatchObject({ alineacion: 'center' });
  });

  test('H6-E5: el resaltado usa los colores del sitio (fondo propio, distinto del de la página)', async ({ page }) => {
    await page.goto(RUTA_FORMATOS);
    const resaltado = parrafoConFormatos(page).locator('mark').first();

    const { fondo, color } = await resaltado.evaluate((el) => {
      const e = getComputedStyle(el);
      return { fondo: e.backgroundColor, color: e.color };
    });
    const fondoDeLaPagina = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(fondo).not.toBe('rgba(0, 0, 0, 0)');
    expect(fondo).not.toBe(fondoDeLaPagina);
    expect(color).not.toBe(fondo);
  });

  test.describe('con puntero (escritorio)', () => {
    test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

    test('H6-E5 / D31 U9: el subrayado no se parece a un enlace: color del texto, línea fina y sin cambio al pasar el puntero', async ({
      page,
    }) => {
      await page.goto(RUTA_FORMATOS);
      const subrayado = parrafoConFormatos(page).locator('u').first();
      const enlace = parrafoConFormatos(page).getByRole('link', { name: 'enlace', exact: true });

      const lineaDelSubrayado = await lineaDe(subrayado);
      const lineaDelEnlace = await lineaDe(enlace);
      expect(lineaDelSubrayado.linea).toContain('underline');
      expect(lineaDelSubrayado.colorDeLinea).toBe(lineaDelSubrayado.color);
      expect(lineaDelEnlace.colorDeLinea).not.toBe(lineaDelEnlace.color);
      expect(lineaDelSubrayado.colorDeLinea).not.toBe(lineaDelEnlace.colorDeLinea);
      expect(parseFloat(lineaDelSubrayado.separacion)).toBeLessThan(parseFloat(lineaDelEnlace.separacion));

      await subrayado.hover();
      expect(await lineaDe(subrayado)).toEqual(lineaDelSubrayado);
      await enlace.hover();
      expect((await lineaDe(enlace)).grosor).not.toBe(lineaDelEnlace.grosor);

      // Prueba visual: el subrayado y el enlace no se dibujan igual.
      const [imagenDelSubrayado, imagenDelEnlace] = [await subrayado.screenshot(), await enlace.screenshot()];
      expect(imagenDelSubrayado.equals(imagenDelEnlace)).toBe(false);
    });
  });

  test.describe('en modo de alto contraste', () => {
    test.use({ forcedColors: 'active' });

    test('D31 U7: con forcedColors el resaltado sigue visible (Mark y MarkText)', async ({ page }) => {
      await page.goto(RUTA_FORMATOS);
      const resaltado = parrafoConFormatos(page).locator('mark').first();

      const colores = await resaltado.evaluate((el) => {
        const muestra = document.createElement('span');
        muestra.style.backgroundColor = 'Mark';
        muestra.style.color = 'MarkText';
        document.body.append(muestra);
        const sistema = getComputedStyle(muestra);
        const propio = getComputedStyle(el);
        const resultado = {
          fondo: propio.backgroundColor,
          texto: propio.color,
          mark: sistema.backgroundColor,
          markText: sistema.color,
          pagina: getComputedStyle(document.body).backgroundColor,
        };
        muestra.remove();
        return resultado;
      });

      expect(colores.fondo).toBe(colores.mark);
      expect(colores.texto).toBe(colores.markText);
      expect(colores.fondo).not.toBe(colores.pagina);
    });
  });

  test.describe('sin JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('RF-026: los formatos y la alineación se ven sin JavaScript', async ({ page }) => {
      await page.goto(RUTA_FORMATOS);

      await expect(parrafoConFormatos(page).locator('mark').first()).toHaveText('resaltado');
      await expect(parrafoConFormatos(page).locator('sup')).toHaveText('2');
      expect(await alineacionDe(parrafoConFormatos(page))).toMatchObject({ alineacion: 'justify' });
    });
  });
});
