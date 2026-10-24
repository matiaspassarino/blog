// T075 (spec 003, H4-E1 a E4, RF-016, RF-017, CE-007). FASE ROJA: la lista real de /articulos (T077, T078) no existe
// aún; hoy la página es solo un título.
//
// CONTRATO DE INTERFAZ SUPUESTO (si la real difiere, se ajusta aquí):
//   - Formulario de filtros con campos de etiqueta exacta: "Estado" (select; valores borrador | programado | publicado |
//     archivado), "Categoría" (select; el texto de cada opción es el nombre), "Autor" (select; el texto es el nombre del
//     miembro) y "Buscar por título" (input de texto, Enter envía). Botones "Filtrar" y, para limpiar, un enlace
//     "Quitar filtros" (hacia /articulos). Es un formulario GET: la dirección conserva los filtros (`estado`, `categoria`,
//     `autor`, `q`, `pagina`); los campos se rellenan desde la dirección.
//   - Recuento en un `role="status"` con el texto "N artículos" ("1 artículo" en singular), con el total de coincidencias.
//   - Tabla (`role="table"`) con columnas "Título", "Estado", "Autor", "Categoría" y "Fecha ..."; el título es un enlace al
//     editor (`/articulos/<id>`); el estado se ve como texto en la fila ("Borrador", "Programado", "Publicado",
//     "Archivado", sin distinguir mayúsculas) y cada fila lleva un `<time datetime>` con su fecha relevante.
//   - Debajo de 768 px la tabla se ve como tarjetas (la fila es `display:block`), sin scroll horizontal.
//     Filtros: apilados (una columna) a 360 px, en 2 columnas a 768 px y en una sola fila desde 1024 px.
//   - Estado vacío (spec 004, T047): el componente `EstadoVacio` (`data-estado="vacio"`) con el texto "No hay artículos" y,
//     dentro de él, "Quitar filtros" como enlace con aspecto de botón secundario. El formulario de filtros puede repetir
//     su propio enlace "Quitar filtros" fuera del vacío.
//   - Un enlace "Nuevo artículo" hacia /articulos/nuevo.
//   - Paginación de 20 por página: `nav` con nombre "Paginación"; los enlaces se llaman "2" o "Página 2"; la página actual
//     lleva `aria-current="page"`; los enlaces conservan los filtros. Una página fuera de rango o inválida muestra la 1.
// Datos: cada describe siembra los suyos (prefijo `e2e-li-` + una marca única por ejecución) y filtra por esa marca
// con la búsqueda, así que no depende de los datos del seed ni de otros specs en paralelo.
// CE-007: el límite es 1 s (CI); en desarrollo (compilación bajo demanda, Windows) se tolera 2 s. Se mide la
// navegación a la pantalla ya cargada una vez ("en caliente").
import { expect, test, type Page } from '@playwright/test';
import { ID_EDITORA, limpiarArticulosE2E, pasarAComoServicio, sembrarArticulo } from './ayudas/articulos';
import { ingresar, USUARIOS } from './ayudas/sesion';
import { servicio } from './ayudas/servicio';

const PREFIJO = 'e2e-li-';
const ID_ADMIN = '00000000-0000-4000-a000-000000000001';
const ID_EDITOR = '00000000-0000-4000-a000-000000000003';
const sufijo = () => crypto.randomUUID().replaceAll('-', '').slice(0, 6);
const MARCA = `lis${sufijo()}`; // palabra única de los artículos de los escenarios
const MARCA_PAGINAS = `lip${sufijo()}`; // palabra única de los 25 artículos de la paginación
const LIMITE_MS = process.env.CI ? 1_000 : 2_000;

const titulo = (marca: string, resto: string) => `${PREFIJO}${marca} ${resto}`;
const TITULOS = {
  borrador: titulo(MARCA, 'Borrador de Edu'),
  programado: titulo(MARCA, 'Programado de Eva'),
  publicado: titulo(MARCA, 'Publicado de Ana'),
  archivado: titulo(MARCA, 'Archivado de Eva'),
  tildes: titulo(MARCA, 'Canción de Órgano'),
};
const CATEGORIA_A = `${PREFIJO}cat-a-${sufijo()}`;
const CATEGORIA_B = `${PREFIJO}cat-b-${sufijo()}`;

let ids: Record<keyof typeof TITULOS, string>;

async function asignarCategoria(id: string, categoriaId: string) {
  const s = servicio();
  const { data: actual } = await s.from('articulos').select('version').eq('id', id).single();
  const { error } = await s
    .from('articulos')
    .update({ categoria_id: categoriaId, version: actual!.version })
    .eq('id', id);
  if (error) throw new Error(`No se pudo asignar la categoría: ${error.message}`);
}

async function sembrarEscenarios() {
  const s = servicio();
  const { data: categorias, error } = await s
    .from('categorias')
    .insert([{ nombre: CATEGORIA_A }, { nombre: CATEGORIA_B }])
    .select('id, nombre');
  if (error) throw new Error(`No se pudieron crear las categorías: ${error.message}`);
  const idCategoria = (nombre: string) => categorias.find((c) => c.nombre === nombre)!.id;
  const manana = new Date(Date.now() + 24 * 60 * 60_000);

  // En orden: cada uno queda terminado antes de sembrar el siguiente, así el último es el más reciente.
  const borrador = await sembrarArticulo({ titulo: TITULOS.borrador, autorId: ID_EDITOR });
  await asignarCategoria(borrador.id, idCategoria(CATEGORIA_A));
  const programado = await sembrarArticulo({ titulo: TITULOS.programado, autorId: ID_EDITORA });
  await asignarCategoria(programado.id, idCategoria(CATEGORIA_A));
  await pasarAComoServicio(programado.id, 'programado', manana);
  const publicado = await sembrarArticulo({ titulo: TITULOS.publicado, autorId: ID_ADMIN });
  await asignarCategoria(publicado.id, idCategoria(CATEGORIA_B));
  await pasarAComoServicio(publicado.id, 'publicado');
  const archivado = await sembrarArticulo({ titulo: TITULOS.archivado, autorId: ID_EDITORA });
  await asignarCategoria(archivado.id, idCategoria(CATEGORIA_B));
  await pasarAComoServicio(archivado.id, 'publicado');
  await pasarAComoServicio(archivado.id, 'archivado');
  const tildes = await sembrarArticulo({ titulo: TITULOS.tildes, autorId: ID_EDITOR });
  await asignarCategoria(tildes.id, idCategoria(CATEGORIA_B));
  ids = {
    borrador: borrador.id,
    programado: programado.id,
    publicado: publicado.id,
    archivado: archivado.id,
    tildes: tildes.id,
  };
}

// --- Ayudas de pantalla ---
const irALista = (page: Page, parametros: Record<string, string> = {}) =>
  page.goto(`/articulos?${new URLSearchParams(parametros)}`);

/** Enlaces de título de los artículos que llevan la marca, en el orden en que se ven. */
const titulosDe = (page: Page, marca: string) => page.getByRole('link', { name: marca });
const filaDe = (page: Page, tituloArticulo: string) =>
  page.getByRole('row').filter({ has: page.getByRole('link', { name: tituloArticulo, exact: true }) });
const recuento = (page: Page) => page.getByRole('status').filter({ hasText: /art[ií]culos?/ });
const navegacionPaginas = (page: Page) => page.getByRole('navigation', { name: 'Paginación' });
const filtroEstado = (page: Page) => page.getByLabel('Estado', { exact: true });
const filtroCategoria = (page: Page) => page.getByLabel('Categoría', { exact: true });
const filtroAutor = (page: Page) => page.getByLabel('Autor', { exact: true });
const campoBusqueda = (page: Page) => page.getByLabel('Buscar por título');
const filtrar = (page: Page) => page.getByRole('button', { name: 'Filtrar', exact: true }).click();
const parametro = (page: Page, nombre: string) => new URL(page.url()).searchParams.get(nombre);

test.beforeEach(async ({ page }) => {
  await ingresar(page, USUARIOS.editor);
});

test.describe('Lista de artículos (H4)', () => {
  test.beforeAll(sembrarEscenarios);
  test.afterAll(async () => {
    await limpiarArticulosE2E(PREFIJO);
    await servicio().from('categorias').delete().like('nombre', `${PREFIJO}%`);
  });

  test.describe('H4-E1: lista completa', () => {
    test('H4-E1: muestra artículos de todos los estados y autores, más reciente primero', async ({ page }) => {
      await irALista(page, { q: MARCA });

      await expect(titulosDe(page, MARCA)).toHaveText([
        TITULOS.tildes,
        TITULOS.archivado,
        TITULOS.publicado,
        TITULOS.programado,
        TITULOS.borrador,
      ]);
    });

    test('H4-E1: el estado se distingue por texto en cada fila, junto con autor y categoría', async ({ page }) => {
      await irALista(page, { q: MARCA });

      await expect(filaDe(page, TITULOS.borrador).getByText(/^borrador$/i)).toBeVisible();
      await expect(filaDe(page, TITULOS.programado).getByText(/^programado$/i)).toBeVisible();
      await expect(filaDe(page, TITULOS.publicado).getByText(/^publicado$/i)).toBeVisible();
      await expect(filaDe(page, TITULOS.archivado).getByText(/^archivado$/i)).toBeVisible();
      await expect(filaDe(page, TITULOS.borrador)).toContainText(USUARIOS.editor.nombre);
      await expect(filaDe(page, TITULOS.programado)).toContainText(USUARIOS.editora.nombre);
      await expect(filaDe(page, TITULOS.publicado)).toContainText(USUARIOS.admin.nombre);
      await expect(filaDe(page, TITULOS.borrador)).toContainText(CATEGORIA_A);
      await expect(filaDe(page, TITULOS.publicado)).toContainText(CATEGORIA_B);
    });

    test('H4-E1: la tabla tiene las columnas título, estado, autor, categoría y fecha, y una fecha por fila', async ({
      page,
    }) => {
      await irALista(page, { q: MARCA });

      for (const columna of ['Título', 'Estado', 'Autor', 'Categoría']) {
        await expect(page.getByRole('columnheader', { name: columna, exact: true })).toBeVisible();
      }
      await expect(page.getByRole('columnheader', { name: /^Fecha/ })).toBeVisible();
      for (const t of Object.values(TITULOS)) {
        await expect(filaDe(page, t).locator('time[datetime]')).toHaveCount(1);
      }
    });

    test('H4-E1: cada título es un enlace al editor del artículo', async ({ page }) => {
      await irALista(page, { q: MARCA });
      const enlace = page.getByRole('link', { name: TITULOS.publicado, exact: true });
      await expect(enlace).toHaveAttribute('href', `/articulos/${ids.publicado}`);

      await enlace.click();

      await expect(page).toHaveURL(new RegExp(`/articulos/${ids.publicado}$`));
    });

    test('H4-E1: el recuento de resultados se anuncia en un estado de vida (status)', async ({ page }) => {
      await irALista(page, { q: MARCA });

      await expect(recuento(page)).toContainText(/\b5 artículos\b/);
    });

    test('H4-E1: el recuento usa el singular con un solo resultado', async ({ page }) => {
      await irALista(page, { q: MARCA, estado: 'programado' });

      await expect(recuento(page)).toContainText(/\b1 artículo\b(?!s)/);
    });

    test('H4-E1: el enlace "Nuevo artículo" lleva a /articulos/nuevo', async ({ page }) => {
      await irALista(page);
      const enlace = page.getByRole('link', { name: 'Nuevo artículo', exact: true });
      await expect(enlace).toHaveAttribute('href', '/articulos/nuevo');

      await enlace.click();

      await expect(page).toHaveURL(/\/articulos\/nuevo$/);
    });
  });

  test.describe('H4-E2: filtros', () => {
    test('H4-E2: filtrar por estado deja solo los de ese estado y lo refleja en la dirección', async ({ page }) => {
      await irALista(page, { q: MARCA });

      await filtroEstado(page).selectOption('programado');
      await filtrar(page);

      await expect(titulosDe(page, MARCA)).toHaveText([TITULOS.programado]);
      expect(parametro(page, 'estado')).toBe('programado');
      expect(parametro(page, 'q')).toBe(MARCA);
    });

    test('H4-E2: filtrar por categoría deja solo los de esa categoría', async ({ page }) => {
      await irALista(page, { q: MARCA });

      await filtroCategoria(page).selectOption({ label: CATEGORIA_A });
      await filtrar(page);

      await expect(titulosDe(page, MARCA)).toHaveText([TITULOS.programado, TITULOS.borrador]);
      expect(parametro(page, 'categoria')).toBeTruthy();
    });

    test('H4-E2: filtrar por autor deja solo los de ese autor', async ({ page }) => {
      await irALista(page, { q: MARCA });

      await filtroAutor(page).selectOption({ label: USUARIOS.editora.nombre });
      await filtrar(page);

      await expect(titulosDe(page, MARCA)).toHaveText([TITULOS.archivado, TITULOS.programado]);
      expect(parametro(page, 'autor')).toBe(ID_EDITORA);
    });

    test('H4-E2: los filtros se combinan y la lista cumple todos a la vez', async ({ page }) => {
      await irALista(page, { q: MARCA });

      await filtroCategoria(page).selectOption({ label: CATEGORIA_B });
      await filtroAutor(page).selectOption({ label: USUARIOS.editora.nombre });
      await filtrar(page);
      await expect(titulosDe(page, MARCA)).toHaveText([TITULOS.archivado]);

      await filtroEstado(page).selectOption('borrador');
      await filtrar(page);
      await expect(titulosDe(page, MARCA)).toHaveCount(0);
    });

    test('H4-E2: recargar la página conserva los filtros, la lista y los valores de los campos', async ({ page }) => {
      await irALista(page, { q: MARCA });
      await filtroEstado(page).selectOption('publicado');
      await filtroAutor(page).selectOption({ label: USUARIOS.admin.nombre });
      await filtrar(page);
      await expect(titulosDe(page, MARCA)).toHaveText([TITULOS.publicado]);

      await page.reload();

      await expect(titulosDe(page, MARCA)).toHaveText([TITULOS.publicado]);
      await expect(filtroEstado(page)).toHaveValue('publicado');
      await expect(filtroAutor(page)).toHaveValue(ID_ADMIN);
      await expect(campoBusqueda(page)).toHaveValue(MARCA);
    });

    test('H4-E2: la misma dirección abierta en otra pestaña da lo mismo', async ({ page }) => {
      await irALista(page, { q: MARCA });
      await filtroCategoria(page).selectOption({ label: CATEGORIA_B });
      await filtrar(page);
      await expect(titulosDe(page, MARCA)).toHaveCount(3);

      const otra = await page.context().newPage();
      await otra.goto(page.url());

      await expect(titulosDe(otra, MARCA)).toHaveText([TITULOS.tildes, TITULOS.archivado, TITULOS.publicado]);
      await expect(filtroCategoria(otra)).toHaveValue(parametro(page, 'categoria')!);
    });

    test('H4-E2: un parámetro inválido en la dirección se ignora y la pantalla no se rompe', async ({ page }) => {
      const respuesta = await irALista(page, { q: MARCA, estado: 'inexistente', categoria: 'no-uuid', pagina: '-3' });

      expect(respuesta?.status()).toBe(200);
      await expect(titulosDe(page, MARCA)).toHaveCount(5);
    });
  });

  test.describe('H4-E3: búsqueda por título', () => {
    test('H4-E3: busca por una palabra del título, enviando con Enter', async ({ page }) => {
      await irALista(page);

      await campoBusqueda(page).fill(`${MARCA} programado`);
      await campoBusqueda(page).press('Enter');

      await expect(titulosDe(page, MARCA)).toHaveText([TITULOS.programado]);
      expect(parametro(page, 'q')).toBe(`${MARCA} programado`);
    });

    test('H4-E3: no distingue mayúsculas', async ({ page }) => {
      await irALista(page, { q: `${MARCA.toUpperCase()} PROGRAMADO DE EVA` });

      await expect(titulosDe(page, MARCA)).toHaveText([TITULOS.programado]);
    });

    test('H4-E3: no distingue tildes (se busca sin tilde y se encuentra con tilde)', async ({ page }) => {
      await irALista(page, { q: `${MARCA} cancion de organo` });

      await expect(titulosDe(page, MARCA)).toHaveText([TITULOS.tildes]);
    });

    test('H4-E3: no distingue tildes ni mayúsculas (se busca con tilde y en mayúsculas)', async ({ page }) => {
      await irALista(page, { q: `${MARCA} CANCIÓN DE ÓRGANO` });

      await expect(titulosDe(page, MARCA)).toHaveText([TITULOS.tildes]);
    });

    test('H4-E3: la búsqueda se combina con los filtros', async ({ page }) => {
      await irALista(page, { q: MARCA, estado: 'archivado' });

      await expect(titulosDe(page, MARCA)).toHaveText([TITULOS.archivado]);
    });
  });

  test.describe('H4-E4: estado vacío', () => {
    test('H4-E4: sin coincidencias muestra un estado vacío con "Quitar filtros"', async ({ page }) => {
      await irALista(page, { q: `${MARCA}-que-no-existe` });

      const vacio = page.locator('[data-estado="vacio"]');
      await expect(vacio).toBeVisible();
      await expect(vacio).toContainText(/No hay artículos/);
      await expect(vacio.getByRole('link', { name: 'Quitar filtros' })).toBeVisible();
      await expect(page.getByRole('table')).toHaveCount(0);
      await expect(recuento(page)).toContainText(/\b0 artículos\b/);
    });

    test('H4-E4: "Quitar filtros" limpia la dirección y vuelve a mostrar la lista', async ({ page }) => {
      await irALista(page, { q: `${MARCA}-que-no-existe`, estado: 'archivado' });

      await page.locator('[data-estado="vacio"]').getByRole('link', { name: 'Quitar filtros' }).click();

      await expect(page).toHaveURL((url) => url.pathname === '/articulos' && url.search === '');
      await expect(page.getByRole('table')).toBeVisible();
      await expect(campoBusqueda(page)).toHaveValue('');
      await expect(filtroEstado(page)).toHaveValue('');
    });

    test('H4-E4: filtros que se contradicen también dan el estado vacío', async ({ page }) => {
      await irALista(page, { q: MARCA, estado: 'programado', autor: ID_ADMIN });

      await expect(page.locator('[data-estado="vacio"]')).toContainText(/No hay artículos/);
    });
  });

  test.describe('Diseño responsive (T077)', () => {
    test('a 360 px la tabla se ve como tarjetas, sin scroll horizontal y con los filtros apilados', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await irALista(page, { q: MARCA });
      await expect(titulosDe(page, MARCA)).toHaveCount(5);

      const sinScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(sinScroll).toBe(true);
      const filaEsTarjeta = await page
        .locator('tbody tr')
        .first()
        .evaluate((fila) => getComputedStyle(fila).display === 'block');
      expect(filaEsTarjeta).toBe(true);
      const estado = (await filtroEstado(page).boundingBox())!;
      const categoria = (await filtroCategoria(page).boundingBox())!;
      const autor = (await filtroAutor(page).boundingBox())!;
      expect(categoria.y).toBeGreaterThan(estado.y + estado.height - 1);
      expect(autor.y).toBeGreaterThan(categoria.y + categoria.height - 1);
      expect(Math.abs(categoria.x - estado.x)).toBeLessThan(2);
      await expect(page.getByRole('link', { name: TITULOS.publicado, exact: true })).toBeVisible();
    });

    test('a 768 px es una tabla y los filtros van en 2 columnas', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await irALista(page, { q: MARCA });
      await expect(titulosDe(page, MARCA)).toHaveCount(5);

      const filaEsFila = await page
        .locator('tbody tr')
        .first()
        .evaluate((fila) => getComputedStyle(fila).display === 'table-row');
      expect(filaEsFila).toBe(true);
      const estado = (await filtroEstado(page).boundingBox())!;
      const categoria = (await filtroCategoria(page).boundingBox())!;
      const autor = (await filtroAutor(page).boundingBox())!;
      expect(Math.abs(categoria.y - estado.y)).toBeLessThan(4);
      expect(categoria.x).toBeGreaterThan(estado.x + estado.width - 1);
      expect(autor.y).toBeGreaterThan(estado.y + estado.height - 1);
      const sinScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(sinScroll).toBe(true);
    });

    test('a 1280 px es una tabla y los filtros van en una sola fila', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await irALista(page, { q: MARCA });
      await expect(titulosDe(page, MARCA)).toHaveCount(5);

      const filaEsFila = await page
        .locator('tbody tr')
        .first()
        .evaluate((fila) => getComputedStyle(fila).display === 'table-row');
      expect(filaEsFila).toBe(true);
      const cajas = [
        (await filtroEstado(page).boundingBox())!,
        (await filtroCategoria(page).boundingBox())!,
        (await filtroAutor(page).boundingBox())!,
        (await campoBusqueda(page).boundingBox())!,
      ];
      for (const caja of cajas) expect(Math.abs(caja.y - cajas[0].y)).toBeLessThan(4);
    });
  });
});

test.describe('Paginación de 20 por página (RF-016)', () => {
  const TOTAL = 25;
  const titulosPaginas = (page: Page) => titulosDe(page, MARCA_PAGINAS);

  test.beforeAll(async () => {
    const numeros = Array.from({ length: TOTAL }, (_, i) => String(i + 1).padStart(2, '0'));
    for (let desde = 0; desde < numeros.length; desde += 5) {
      await Promise.all(
        numeros
          .slice(desde, desde + 5)
          .map((n) => sembrarArticulo({ titulo: titulo(MARCA_PAGINAS, `Artículo ${n}`), autorId: ID_EDITOR })),
      );
    }
  });
  test.afterAll(() => limpiarArticulosE2E(`${PREFIJO}${MARCA_PAGINAS}`));

  test('RF-016: la primera página muestra 20, el recuento total y la navegación con la página 1 actual', async ({
    page,
  }) => {
    await irALista(page, { q: MARCA_PAGINAS });

    await expect(titulosPaginas(page)).toHaveCount(20);
    await expect(recuento(page)).toContainText(new RegExp(`\\b${TOTAL} artículos\\b`));
    const navegacion = navegacionPaginas(page);
    await expect(navegacion).toBeVisible();
    await expect(navegacion.locator('[aria-current="page"]')).toHaveText(/^\s*1\s*$/);
    await expect(navegacion.getByRole('link', { name: /^(Página )?2$/ })).toBeVisible();
  });

  test('RF-016: la segunda página muestra los 5 restantes, conserva el filtro y marca la página actual', async ({
    page,
  }) => {
    await irALista(page, { q: MARCA_PAGINAS });

    await navegacionPaginas(page)
      .getByRole('link', { name: /^(Página )?2$/ })
      .click();

    await expect(titulosPaginas(page)).toHaveCount(5);
    expect(parametro(page, 'pagina')).toBe('2');
    expect(parametro(page, 'q')).toBe(MARCA_PAGINAS);
    await expect(navegacionPaginas(page).locator('[aria-current="page"]')).toHaveText(/^\s*2\s*$/);
    await expect(recuento(page)).toContainText(new RegExp(`\\b${TOTAL} artículos\\b`));
  });

  test('RF-016: abrir directamente la página 2 por la dirección da el mismo resultado', async ({ page }) => {
    await irALista(page, { q: MARCA_PAGINAS, pagina: '2' });

    await expect(titulosPaginas(page)).toHaveCount(5);
  });

  test('RF-016: una página fuera de rango vuelve a la primera, sin error', async ({ page }) => {
    const respuesta = await irALista(page, { q: MARCA_PAGINAS, pagina: '99' });

    expect(respuesta?.status()).toBe(200);
    await expect(titulosPaginas(page)).toHaveCount(20);
    await expect(navegacionPaginas(page).locator('[aria-current="page"]')).toHaveText(/^\s*1\s*$/);
    await expect(recuento(page)).toContainText(new RegExp(`\\b${TOTAL} artículos\\b`));
  });

  test('RF-016: una página que no es un número positivo muestra la primera', async ({ page }) => {
    await irALista(page, { q: MARCA_PAGINAS, pagina: 'abc' });

    await expect(titulosPaginas(page)).toHaveCount(20);
    await expect(navegacionPaginas(page).locator('[aria-current="page"]')).toHaveText(/^\s*1\s*$/);
  });
});

test.describe('CE-007: cada pantalla responde en menos de 1 s con los datos de demo', () => {
  // Sin prefijo propio: mide la lista con los datos del seed. Se carga una vez antes para no medir la compilación.
  async function medir(page: Page, destino: string, listo: () => Promise<void>) {
    await page.goto(destino);
    await listo();
    const inicio = Date.now();
    await page.goto(destino, { waitUntil: 'domcontentloaded' });
    await listo();
    return Date.now() - inicio;
  }

  const filas = (page: Page) => page.getByRole('row').nth(1);

  test(`CE-007: la lista completa responde en menos de ${LIMITE_MS} ms (1 s en CI)`, async ({ page }) => {
    const ms = await medir(page, '/articulos', () => expect(filas(page)).toBeVisible());

    expect(ms).toBeLessThan(LIMITE_MS);
  });

  test(`CE-007: la lista filtrada por estado responde en menos de ${LIMITE_MS} ms`, async ({ page }) => {
    const ms = await medir(page, '/articulos?estado=programado', () => expect(recuento(page)).toBeVisible());

    expect(ms).toBeLessThan(LIMITE_MS);
  });

  test(`CE-007: la búsqueda por título responde en menos de ${LIMITE_MS} ms`, async ({ page }) => {
    const ms = await medir(page, '/articulos?q=dise%C3%B1o', () => expect(recuento(page)).toBeVisible());

    expect(ms).toBeLessThan(LIMITE_MS);
  });

  test(`CE-007: la segunda página responde en menos de ${LIMITE_MS} ms`, async ({ page }) => {
    const ms = await medir(page, '/articulos?pagina=2', () => expect(recuento(page)).toBeVisible());

    expect(ms).toBeLessThan(LIMITE_MS);
  });
});
