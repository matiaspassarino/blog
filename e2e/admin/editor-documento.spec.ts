// T039 (spec 005, H1 esc. 1 a 7; contracts/atajos.md y contracts/componentes.md). FASE ROJA: el editor estilo
// documento no existe aún (la pantalla de hoy es la lista de bloques con «Agregar bloque»).
//
// Supuestos de interfaz: ver el encabezado de las ayudas nuevas en ./ayudas/editor.ts (lienzo, barra, selector de
// estilo, campo de enlace y menú de inserción). Además este archivo asume:
//   - La pantalla conserva `[data-editor="listo"]` cuando el editor terminó de montarse (esperarEditorListo).
//   - Los atajos de formato son `Mod+B`, `Mod+I`, `Mod+E` y `Mod+K` (Mod = Ctrl o Cmd, `ControlOrMeta` en Playwright).
//   - Con «Lista con viñetas» activa, Enter sobre un ítem vacío sale de la lista y deja un párrafo.
//   - Guardar convierte el documento a la misma lista de bloques de siempre (`parrafo`, `titulo`, `lista`, `cita`),
//     con la negrita como `**texto**`.
//   - La tipografía del lienzo se compara con la de la vista previa del propio panel (/articulos/<id>/vista-previa),
//     que usa el renderer del sitio: mismo tipo de letra, tamaño, peso, interlineado y color.
// El esc. 5 con toque no se prueba aquí (hace falta un dispositivo táctil; es de la prueba manual del quickstart).
import { expect, test, type Page } from '@playwright/test';
import { articuloPorTitulo, limpiarArticulosE2E, parrafo, sembrarArticulo } from './ayudas/articulos';
import { nombreDePrueba } from './ayudas/datos';
import {
  abrirMenuInsertar,
  barraDeFormato,
  elegirEstilo,
  escribirEnLienzo,
  esperarEditorListo,
  guardarYEsperar,
  lienzo,
  opcionDeInsercion,
  selectorDeEstilo,
} from './ayudas/editor';
import { ingresar, USUARIOS } from './ayudas/sesion';

const PREFIJO = 'e2e-doc-';
const MOD = 'ControlOrMeta';
const LIENZO = '[aria-label="Contenido del artículo"]';

test.afterAll(() => limpiarArticulosE2E(PREFIJO));

test.beforeEach(async ({ page }) => {
  await ingresar(page, USUARIOS.editor);
});

async function abrirNuevo(page: Page) {
  await page.goto('/articulos/nuevo');
  await esperarEditorListo(page);
}

const botonDeBarra = (page: Page, nombre: string) =>
  barraDeFormato(page).getByRole('button', { name: nombre, exact: true });

/** Escribe `texto` en el lienzo y lo deja todo seleccionado (un solo párrafo). */
async function escribirYSeleccionar(page: Page, texto: string) {
  await escribirEnLienzo(page, texto);
  await page.keyboard.press(`${MOD}+a`);
}

/** Tipo de letra, tamaño, peso, interlineado y color del primer elemento que coincide con el selector y el texto. */
const estilosDe = (page: Page, selector: string, texto: string) =>
  page
    .locator(selector)
    .filter({ hasText: texto })
    .first()
    .evaluate((el) => {
      const e = getComputedStyle(el);
      return [e.fontFamily, e.fontSize, e.fontWeight, e.lineHeight, e.color].join(' | ');
    });

test.describe('Escribir como documento', () => {
  test('H1-E1: un artículo nuevo muestra un párrafo vacío y la barra, sin «Agregar bloque»', async ({ page }) => {
    await abrirNuevo(page);

    await expect(lienzo(page)).toBeVisible();
    await expect(lienzo(page).locator('p')).toHaveCount(1);
    await expect(lienzo(page).locator('p')).toHaveText('');
    await expect(barraDeFormato(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar bloque' })).toHaveCount(0);
    await expect(page.getByLabel('Tipo de bloque a agregar')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(Subir|Bajar|Duplicar|Quitar) bloque/ })).toHaveCount(0);
  });

  test('H1-E1: la barra tiene los controles de formato y un solo tope de tabulación', async ({ page }) => {
    await abrirNuevo(page);
    const barra = barraDeFormato(page);

    for (const nombre of [
      'Negrita',
      'Cursiva',
      'Código',
      'Enlace',
      'Lista con viñetas',
      'Lista numerada',
      'Insertar',
      'Deshacer',
      'Rehacer',
    ]) {
      await expect(botonDeBarra(page, nombre), nombre).toBeVisible();
    }
    await expect(selectorDeEstilo(page)).toHaveText(/Párrafo/);
    // Roving tabindex: un solo control entra en el orden de tabulación; las flechas mueven entre los demás.
    await expect(barra.locator('[tabindex="0"]')).toHaveCount(1);
    await barra.locator('[tabindex="0"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(barra.locator('[tabindex="0"]')).toHaveCount(1);
    await expect(barra.locator('[tabindex="0"]')).toBeFocused();
  });

  test('H1-E2: Enter parte el párrafo, deja el texto anterior intacto y pone el cursor en el nuevo', async ({
    page,
  }) => {
    await abrirNuevo(page);

    await escribirEnLienzo(page, 'Primero');
    await page.keyboard.press('Enter');
    await escribirEnLienzo(page, 'Segundo');

    await expect(lienzo(page).locator('p')).toHaveText(['Primero', 'Segundo']);

    // En medio de un texto, Enter lo parte en dos. ProseMirror ignora los cambios de selección del navegador durante
    // unos 50 ms después de escribir; con una persona eso no se nota, pero Playwright teclea más rápido.
    for (const tecla of ['ArrowLeft', 'ArrowLeft', 'Enter']) {
      await page.waitForTimeout(100);
      await page.keyboard.press(tecla);
    }
    await expect(lienzo(page).locator('p')).toHaveText(['Primero', 'Segun', 'do']);
  });

  test('H1-E2: Enter sobre un ítem vacío sale de la lista', async ({ page }) => {
    await abrirNuevo(page);

    await botonDeBarra(page, 'Lista con viñetas').click();
    await escribirEnLienzo(page, 'uno');
    await page.keyboard.press('Enter');
    await escribirEnLienzo(page, 'dos');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // ítem vacío: sale de la lista
    await escribirEnLienzo(page, 'afuera');

    await expect(lienzo(page).locator('ul > li')).toHaveText(['uno', 'dos']);
    // Detrás de una lista siempre queda un párrafo vacío donde poner el cursor (TrailingNode).
    await expect(lienzo(page).locator('> p')).toHaveText(['afuera', '']);
  });

  test('H1-E3: la negrita se aplica con la barra, se ve en negrita y se quita con el mismo control', async ({
    page,
  }) => {
    await abrirNuevo(page);
    await escribirYSeleccionar(page, 'hola');

    await botonDeBarra(page, 'Negrita').click();

    await expect(lienzo(page).locator('strong')).toHaveText('hola');
    await expect(botonDeBarra(page, 'Negrita')).toHaveAttribute('aria-pressed', 'true');
    const peso = await lienzo(page)
      .locator('strong')
      .evaluate((el) => Number(getComputedStyle(el).fontWeight));
    expect(peso).toBeGreaterThanOrEqual(600);

    await botonDeBarra(page, 'Negrita').click();

    await expect(lienzo(page).locator('strong')).toHaveCount(0);
    await expect(botonDeBarra(page, 'Negrita')).toHaveAttribute('aria-pressed', 'false');
  });

  test('H1-E3: cursiva y código se aplican con su atajo (Mod+I, Mod+E) y se quitan con la barra', async ({ page }) => {
    await abrirNuevo(page);
    await escribirYSeleccionar(page, 'palabra');

    await page.keyboard.press(`${MOD}+i`);
    await expect(lienzo(page).locator('em')).toHaveText('palabra');
    await expect(botonDeBarra(page, 'Cursiva')).toHaveAttribute('aria-pressed', 'true');
    await botonDeBarra(page, 'Cursiva').click();
    await expect(lienzo(page).locator('em')).toHaveCount(0);

    await page.keyboard.press(`${MOD}+e`);
    await expect(lienzo(page).locator('code')).toHaveText('palabra');
    await expect(botonDeBarra(page, 'Código')).toHaveAttribute('aria-pressed', 'true');
    await botonDeBarra(page, 'Código').click();
    await expect(lienzo(page).locator('code')).toHaveCount(0);
  });

  test('H1-E3: la negrita con Mod+B se aplica y el mismo atajo la quita', async ({ page }) => {
    await abrirNuevo(page);
    await escribirYSeleccionar(page, 'fuerte');

    await page.keyboard.press(`${MOD}+b`);
    await expect(lienzo(page).locator('strong')).toHaveText('fuerte');
    await page.keyboard.press(`${MOD}+b`);
    await expect(lienzo(page).locator('strong')).toHaveCount(0);
  });

  test('H1-E3: el enlace se crea con la barra: el campo de URL aplica con Enter y devuelve el foco al lienzo', async ({
    page,
  }) => {
    await abrirNuevo(page);
    await escribirYSeleccionar(page, 'sitio');

    await botonDeBarra(page, 'Enlace').click();
    const campo = page.getByLabel('URL del enlace');
    await expect(campo).toBeFocused();
    await campo.fill('https://example.com/pagina');
    await page.keyboard.press('Enter');

    await expect(lienzo(page).locator('a')).toHaveText('sitio');
    await expect(lienzo(page).locator('a')).toHaveAttribute('href', 'https://example.com/pagina');
    await expect(campo).toHaveCount(0);
    await expect(lienzo(page)).toBeFocused();
  });

  test('H1-E3: Mod+K abre el campo de URL y Esc lo cierra sin enlace y con el foco en el lienzo', async ({ page }) => {
    await abrirNuevo(page);
    await escribirYSeleccionar(page, 'sitio');

    await page.keyboard.press(`${MOD}+k`);
    const campo = page.getByLabel('URL del enlace');
    await expect(campo).toBeFocused();
    await page.keyboard.press('Escape');

    await expect(campo).toHaveCount(0);
    await expect(lienzo(page)).toBeFocused();
    await expect(lienzo(page).locator('a')).toHaveCount(0);
  });

  test('H1-E3: una URL no permitida no crea el enlace y marca el campo como inválido', async ({ page }) => {
    await abrirNuevo(page);
    await escribirYSeleccionar(page, 'sitio');

    await botonDeBarra(page, 'Enlace').click();
    const campo = page.getByLabel('URL del enlace');
    await campo.fill('javascript:alert(1)');
    await page.keyboard.press('Enter');

    await expect(campo).toHaveAttribute('aria-invalid', 'true');
    await expect(lienzo(page).locator('a')).toHaveCount(0);
  });

  test('H1-E4: el estilo de párrafo cambia el tipo del párrafo conservando el texto', async ({ page }) => {
    await abrirNuevo(page);
    await escribirEnLienzo(page, 'Un texto');

    for (const [estilo, etiqueta] of [
      ['Título 2', 'h2'],
      ['Título 3', 'h3'],
      ['Título 4', 'h4'],
      ['Cita', 'blockquote'],
    ] as const) {
      await elegirEstilo(page, estilo);
      await expect(lienzo(page).locator(etiqueta), estilo).toHaveText('Un texto');
      await expect(selectorDeEstilo(page), estilo).toHaveText(new RegExp(estilo));
    }

    await elegirEstilo(page, 'Párrafo');
    await expect(lienzo(page).locator('> p').first()).toHaveText('Un texto');
    await expect(lienzo(page).locator('h2, h3, h4, blockquote')).toHaveCount(0);
  });

  test('H1-E4: «Lista con viñetas» y «Lista numerada» convierten el párrafo y se quitan con el mismo botón', async ({
    page,
  }) => {
    await abrirNuevo(page);
    await escribirEnLienzo(page, 'Ítem');

    await botonDeBarra(page, 'Lista con viñetas').click();
    await expect(lienzo(page).locator('ul > li')).toHaveText('Ítem');
    await expect(botonDeBarra(page, 'Lista con viñetas')).toHaveAttribute('aria-pressed', 'true');

    await botonDeBarra(page, 'Lista numerada').click();
    await expect(lienzo(page).locator('ol > li')).toHaveText('Ítem');
    await expect(lienzo(page).locator('ul')).toHaveCount(0);

    await botonDeBarra(page, 'Lista numerada').click();
    await expect(lienzo(page).locator('> p')).toHaveText(['Ítem', '']);
  });

  test('H1-E5: «/» en una línea vacía abre el menú, se filtra al escribir y Enter inserta la opción activa', async ({
    page,
  }) => {
    await abrirNuevo(page);
    const area = lienzo(page);

    await escribirEnLienzo(page, '/');
    const menu = page.getByRole('listbox');
    await expect(menu).toBeVisible();
    await expect(area).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(area).toBeFocused(); // el foco queda en el lienzo

    await page.keyboard.type('tit');
    await expect(opcionDeInsercion(page, 'Título 2')).toBeVisible();
    await expect(opcionDeInsercion(page, 'Título 3')).toBeVisible();
    await expect(opcionDeInsercion(page, 'Título 4')).toBeVisible();
    await expect(opcionDeInsercion(page, 'Imagen')).toHaveCount(0);

    const opciones = menu.getByRole('option');
    const idPrimera = await opciones.nth(0).getAttribute('id');
    const idSegunda = await opciones.nth(1).getAttribute('id');
    await expect(area).toHaveAttribute('aria-activedescendant', idPrimera!);
    await page.keyboard.press('ArrowDown');
    await expect(area).toHaveAttribute('aria-activedescendant', idSegunda!);
    await page.keyboard.press('Enter');

    await expect(menu).toHaveCount(0);
    await expect(area.locator('h3')).toHaveCount(1);
    await expect(area.locator('h3')).toHaveText(''); // el «/tit» se borró
    await expect(area).toBeFocused();
  });

  test('H1-E5: Esc cierra el menú sin cambios y borrar el «/» también', async ({ page }) => {
    await abrirNuevo(page);
    const menu = page.getByRole('listbox');

    await escribirEnLienzo(page, '/');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(lienzo(page).locator('p')).toHaveText('/');
    await expect(lienzo(page)).toBeFocused();

    await page.keyboard.press('Backspace');
    await page.keyboard.type('/');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Backspace');
    await expect(menu).toHaveCount(0);
    await expect(lienzo(page).locator('p')).toHaveText('');
  });

  test('H1-E5: sin coincidencias avisa «Sin resultados» y Enter no cambia nada', async ({ page }) => {
    await abrirNuevo(page);

    await escribirEnLienzo(page, '/zzz');

    await expect(page.getByRole('status').filter({ hasText: 'Sin resultados' })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(lienzo(page).locator('p')).toHaveText('/zzz');
    await expect(lienzo(page).locator('p')).toHaveCount(1);
  });

  test('H1-E5: el menú no se abre en medio de un texto ni de una URL', async ({ page }) => {
    await abrirNuevo(page);

    await escribirEnLienzo(page, 'hola /');
    await expect(page.getByRole('listbox')).toHaveCount(0);

    await page.keyboard.press('Enter');
    await escribirEnLienzo(page, 'https:/');
    await expect(page.getByRole('listbox')).toHaveCount(0);

    await page.keyboard.press('Enter');
    await escribirEnLienzo(page, 'a/b');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(lienzo(page).locator('p')).toHaveText(['hola /', 'https:/', 'a/b']);
  });

  test('H1-E5: desde «Insertar» el foco entra al menú y vuelve al lienzo; con el ratón se elige una opción', async ({
    page,
  }) => {
    await abrirNuevo(page);

    const menu = await abrirMenuInsertar(page);
    await expect.poll(() => menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(lienzo(page)).toBeFocused();

    await abrirMenuInsertar(page);
    await opcionDeInsercion(page, 'Cita').click();
    await expect(lienzo(page).locator('blockquote')).toHaveCount(1);
    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  test('H1-E6: Retroceso al comienzo de un párrafo lo une con el anterior', async ({ page }) => {
    await abrirNuevo(page);
    await escribirEnLienzo(page, 'Uno');
    await page.keyboard.press('Enter');
    await escribirEnLienzo(page, 'Dos');

    await page.keyboard.press('Home');
    await page.keyboard.press('Backspace');

    await expect(lienzo(page).locator('p')).toHaveText('UnoDos');
    await expect(lienzo(page).locator('p')).toHaveCount(1);
  });

  test('H1-E6: el documento nunca queda sin ningún párrafo', async ({ page }) => {
    await abrirNuevo(page);

    // Párrafo vacío único: Retroceso lo mantiene.
    await lienzo(page).click();
    await page.keyboard.press('Backspace');
    await expect(lienzo(page).locator('p')).toHaveCount(1);

    // Un párrafo vacío debajo de otro se une con el anterior.
    await page.keyboard.press('Enter');
    await expect(lienzo(page).locator('p')).toHaveCount(2);
    await page.keyboard.press('Backspace');
    await expect(lienzo(page).locator('p')).toHaveCount(1);

    // Borrar todo el contenido deja un párrafo vacío.
    await escribirEnLienzo(page, 'texto');
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.press('Backspace');
    await expect(lienzo(page).locator('p')).toHaveCount(1);
    await expect(lienzo(page).locator('p')).toHaveText('');
  });

  test('H1-E7: títulos, párrafos, listas y citas del lienzo se ven con la tipografía de la vista previa', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({
      titulo: nombreDePrueba('doc-tipografia'),
      contenido: [
        parrafo('Texto de un párrafo'),
        { id: crypto.randomUUID(), tipo: 'titulo', nivel: 2, texto: 'Titulo dos' },
        { id: crypto.randomUUID(), tipo: 'titulo', nivel: 3, texto: 'Titulo tres' },
        { id: crypto.randomUUID(), tipo: 'lista', ordenada: false, items: ['Ítem de lista'] },
        { id: crypto.randomUUID(), tipo: 'cita', texto: 'Texto de una cita' },
      ],
    });
    const casos = [
      { nombre: 'párrafo', vista: 'main p', lienzo: `${LIENZO} > p`, texto: 'Texto de un párrafo' },
      { nombre: 'título 2', vista: 'main h2', lienzo: `${LIENZO} h2`, texto: 'Titulo dos' },
      { nombre: 'título 3', vista: 'main h3', lienzo: `${LIENZO} h3`, texto: 'Titulo tres' },
      { nombre: 'lista', vista: 'main li', lienzo: `${LIENZO} li`, texto: 'Ítem de lista' },
      { nombre: 'cita', vista: 'main blockquote', lienzo: `${LIENZO} blockquote`, texto: 'Texto de una cita' },
    ];

    await page.goto(`/articulos/${articulo.id}/vista-previa`);
    const esperados: string[] = [];
    for (const caso of casos) esperados.push(await estilosDe(page, caso.vista, caso.texto));

    await page.goto(`/articulos/${articulo.id}`);
    await esperarEditorListo(page);
    await expect(lienzo(page)).toBeVisible();
    for (const [i, caso] of casos.entries()) {
      expect(await estilosDe(page, caso.lienzo, caso.texto), caso.nombre).toBe(esperados[i]);
    }
  });

  test('H1-PI: un título, dos párrafos con negrita, una lista y una cita se guardan en ese orden como bloques', async ({
    page,
  }) => {
    const nombre = nombreDePrueba('doc-guardar');
    await abrirNuevo(page);
    await page.getByLabel('Título', { exact: true }).fill(nombre);

    await escribirEnLienzo(page, 'Un título');
    await elegirEstilo(page, 'Título 2');
    await page.keyboard.press('Enter');
    await escribirEnLienzo(page, 'Primer párrafo con ');
    await page.keyboard.press(`${MOD}+b`);
    await page.keyboard.type('negrita');
    await page.keyboard.press(`${MOD}+b`);
    await page.keyboard.type(' fin');
    await page.keyboard.press('Enter');
    await escribirEnLienzo(page, 'Segundo párrafo');
    await page.keyboard.press('Enter');
    await botonDeBarra(page, 'Lista con viñetas').click();
    await escribirEnLienzo(page, 'uno');
    await page.keyboard.press('Enter');
    await escribirEnLienzo(page, 'dos');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // sale de la lista
    await escribirEnLienzo(page, 'Una cita');
    await elegirEstilo(page, 'Cita');
    await guardarYEsperar(page);

    const guardado = await articuloPorTitulo(nombre);
    const bloques = guardado!.contenido as Record<string, unknown>[];
    expect(bloques.map((b) => b.tipo)).toEqual(['titulo', 'parrafo', 'parrafo', 'lista', 'cita']);
    expect(bloques[0]).toMatchObject({ nivel: 2, texto: 'Un título' });
    expect(bloques[1]).toMatchObject({ texto: 'Primer párrafo con **negrita** fin' });
    expect(bloques[2]).toMatchObject({ texto: 'Segundo párrafo' });
    expect(bloques[3]).toMatchObject({ ordenada: false, items: ['uno', 'dos'] });
    expect(bloques[4]).toMatchObject({ texto: 'Una cita' });
  });
});
