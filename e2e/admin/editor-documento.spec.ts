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
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  alineado,
  articuloPorId,
  articuloPorTitulo,
  cita,
  cta,
  codigo,
  diezElementos,
  elementosDe,
  imagenElemento,
  imagenSemilla,
  limpiarArticulosE2E,
  MARCAS,
  lista,
  parrafo,
  pasarAComoServicio,
  publicarComoServicio,
  salto,
  sembrarArticulo,
  separador,
  texto,
  textoDe,
  titulo,
  type Elemento,
} from './ayudas/articulos';
import { nombreDePrueba } from './ayudas/datos';
import {
  abrirMasFormato,
  abrirMenuInsertar,
  accionDelMenu,
  anunciosDeSeleccion,
  archivoDeImagen,
  arrastrarConRaton,
  asaDeElemento,
  barraDeFormato,
  botonDeshacer,
  botonGuardar,
  botonPropiedades,
  botonAcciones,
  botonAlineacion,
  botonMasFormato,
  escribirEnElemento,
  irAlFinalDelDocumento,
  centroDe,
  elegirAccion,
  elegirAlineacion,
  elegirMasFormato,
  elementosDelLienzo,
  elementosSeleccionados,
  entrarAlModo,
  gestoTactil,
  menuDeAcciones,
  observarAnunciosDeSeleccion,
  regionDeEstado,
  textoDeSeleccion,
  textosDelLienzo,
  elegirEstilo,
  elegirImagen,
  escribirEnLienzo,
  esperarEditorListo,
  guardarYEsperar,
  insertarConBarra,
  insertarDesdeBarra,
  isla,
  lienzo,
  opcionDeAlineacion,
  opcionDeFormato,
  opcionDeInsercion,
  panelDePropiedades,
  pestana,
  razonDe,
  selectorDeEstilo,
  subirImagenConAlt,
  type FormatoDeImagen,
} from './ayudas/editor';
import { botonDeEstado, esperarEstado, panelPublicacion } from './ayudas/estado';
import { areaTactil, barraDelEditor } from './ayudas/jerarquia';
import { ingresar, USUARIOS } from './ayudas/sesion';
import { servicio } from './ayudas/servicio';

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

    // Desde la Fase 12 (D28), «Código» vive en «Más formato» y la barra suma «Subrayado» y «Alineación».
    for (const nombre of [
      'Negrita',
      'Cursiva',
      'Subrayado',
      'Enlace',
      'Lista con viñetas',
      'Lista numerada',
      'Insertar',
      'Deshacer',
      'Rehacer',
    ]) {
      await expect(botonDeBarra(page, nombre), nombre).toBeVisible();
    }
    await expect(botonMasFormato(page)).toBeVisible();
    await expect(botonAlineacion(page)).toBeVisible();
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
    // Desde la Fase 12 (D28), «Código» está en «Más formato».
    await abrirMasFormato(page);
    await expect(opcionDeFormato(page, 'Código')).toHaveAttribute('aria-checked', 'true');
    await opcionDeFormato(page, 'Código').click();
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
        titulo(2, 'Titulo dos'),
        titulo(3, 'Titulo tres'),
        lista(['Ítem de lista']),
        cita('Texto de una cita'),
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

    const elementos = elementosDe(await articuloPorTitulo(nombre));
    expect(elementos.map((elemento) => elemento.type)).toEqual([
      'heading',
      'paragraph',
      'paragraph',
      'bulletList',
      'blockquote',
    ]);
    expect(elementos[0]?.attrs).toMatchObject({ level: 2 });
    expect(elementos.map(textoDe)).toEqual([
      'Un título',
      'Primer párrafo con negrita fin',
      'Segundo párrafo',
      'uno\ndos',
      'Una cita',
    ]);
    expect(elementos[1]?.content).toEqual([
      { type: 'text', text: 'Primer párrafo con ' },
      { type: 'text', text: 'negrita', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' fin' },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// T049 (spec 005, H2 esc. 1 a 7; CE-003 en su parte de insertar; quickstart B). FASE ROJA: los elementos especiales y el
// panel de propiedades no existen aún (el lienzo de H1 solo tiene texto). Supuestos de interfaz: ver el encabezado
// "elementos especiales y panel de propiedades" de ./ayudas/editor.ts. Además:
//   - Insertar en una línea vacía reemplaza la línea; las opciones del menú se llaman "Imagen", "Galería", "Llamada a la
//     acción", "Video", "Código" y "Separador" y su nombre accesible suma la descripción.
//   - Esc con el cursor en un elemento (o sobre una isla seleccionada) entra al modo elementos con ese elemento
//     seleccionado; Enter en ese modo abre las propiedades con el foco en su primer campo.
//   - Por debajo de 1280 px, hacer clic en un elemento especial lo selecciona pero NO abre la hoja; «Propiedades» de la
//     barra y Enter en modo elementos la abren y llevan el foco a su primer campo (contracts/atajos.md, "Roles y
//     nombres": la hoja solo "no roba el foco" cuando se abre sin una acción de la persona).
//   - El error de validación de una imagen sin texto alternativo dice "texto alternativo" dentro de la isla.
//   - La región «Publicación» (`<section aria-labelledby>`) está siempre visible y fuera de las pestañas.
//   - Los campos del panel se alcanzan por etiqueta (las de los editores de campos de hoy).
// ---------------------------------------------------------------------------------------------------------------------

/** Documento de 8 elementos con la imagen en la posición 3, para los nombres "Imagen, 3 de 8". */
const sembrarOchoElementos = (titulo: string) =>
  sembrarArticulo({
    titulo,
    contenido: [
      parrafo('Uno'),
      parrafo('Dos'),
      imagenElemento(imagenSemilla('articulos/e2e-inexistente.png')),
      cita('Una cita', { autor: 'Alguien' }),
      lista(['a', 'b']),
      parrafo('Seis'),
      cta({
        titulo: 'Llamada',
        texto: 'Texto de apoyo',
        etiquetaBoton: 'Ir al sitio',
        url: 'https://example.com/destino',
      }),
      separador(),
    ],
  });

const abrirArticulo = async (page: Page, id: string) => {
  await page.goto(`/articulos/${id}`);
  await esperarEditorListo(page);
};

const lienzoTieneElFoco = (page: Page) => lienzo(page).evaluate((el) => el.contains(document.activeElement));
const panelTieneElFoco = (page: Page) => panelDePropiedades(page).evaluate((el) => el.contains(document.activeElement));

const ELEMENTOS_DEL_MENU = [
  'Párrafo',
  'Título 2',
  'Título 3',
  'Título 4',
  'Cita',
  'Lista con viñetas',
  'Lista numerada',
  'Imagen',
  'Galería',
  'Llamada a la acción',
  'Video',
  'Código',
  'Separador',
];

const IMAGEN = /^Imagen, \d+ de \d+$/;
/** El primer elemento guardado de ese tipo del documento. */
const guardadoDeTipo = (guardado: { contenido: unknown } | null | undefined, tipo: string) =>
  elementosDe(guardado).find((elemento) => elemento.type === tipo);

test.describe('Elementos especiales y panel', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('H2-E1: «Insertar» ofrece los diez tipos y los estilos, cada uno con nombre y descripción', async ({ page }) => {
    await abrirNuevo(page);
    const menu = await abrirMenuInsertar(page);

    for (const nombre of ELEMENTOS_DEL_MENU) {
      // El nombre accesible empieza por el del elemento y suma una descripción corta.
      await expect(menu.getByRole('option', { name: new RegExp(`^${nombre}.{4,}`) }), nombre).toHaveCount(1);
    }
    await expect(menu.getByRole('option')).toHaveCount(ELEMENTOS_DEL_MENU.length);
  });

  test('H2-E1: «/» en una línea vacía ofrece los mismos elementos y se filtra por nombre o descripción', async ({
    page,
  }) => {
    await abrirNuevo(page);
    await escribirEnLienzo(page, '/');
    const menu = page.getByRole('listbox');
    await expect(menu.getByRole('option')).toHaveCount(ELEMENTOS_DEL_MENU.length);

    await page.keyboard.type('gale');
    await expect(menu.getByRole('option')).toHaveCount(1);
    await expect(opcionDeInsercion(page, 'Galería')).toBeVisible();
  });

  test('H2-E2: «Insertar» una imagen la pone en el lienzo con el selector, y el panel muestra «Elegir imagen»', async ({
    page,
  }) => {
    await abrirNuevo(page);
    await insertarDesdeBarra(page, 'Imagen');

    await expect(isla(page, IMAGEN)).toBeVisible();
    await expect(isla(page, IMAGEN).getByText('Subir imagen')).toBeVisible();
    await expect(panelDePropiedades(page)).toBeVisible();
    await expect(panelDePropiedades(page).getByRole('button', { name: /^Elegir imagen/ })).toBeVisible();
    // El foco queda en el primer campo del panel (contracts/atajos.md, "Foco al terminar una acción").
    expect(await panelTieneElFoco(page)).toBe(true);
  });

  const FORMATOS: FormatoDeImagen[] = ['png', 'jpeg', 'webp', 'avif'];
  for (const formato of FORMATOS) {
    test(`H2-E2: la imagen ${formato.toUpperCase()} sube desde el panel y pide el texto alternativo`, async ({
      page,
    }) => {
      await abrirNuevo(page);
      await insertarDesdeBarra(page, 'Imagen');
      const panel = panelDePropiedades(page);

      await elegirImagen(page, panel, archivoDeImagen(formato));

      await expect(panel.getByLabel('Texto alternativo', { exact: true })).toBeFocused();
      await expect(panel.getByLabel('Leyenda', { exact: true })).toBeVisible();
      await expect(panel.getByRole('button', { name: 'Quitar imagen' })).toBeVisible();
      await expect(isla(page, IMAGEN).locator('img')).toBeVisible();
    });
  }

  test('H2-E2: una imagen de más de 5 MB se rechaza con el límite y no queda en el lienzo', async ({ page }) => {
    await abrirNuevo(page);
    await insertarDesdeBarra(page, 'Imagen');
    const grande = Buffer.alloc(5 * 1024 * 1024 + 1);
    archivoDeImagen('png').buffer.copy(grande);

    await elegirImagen(page, panelDePropiedades(page), { name: 'enorme.png', mimeType: 'image/png', buffer: grande });

    await expect(panelDePropiedades(page).getByRole('alert')).toContainText('5 MB');
    await expect(isla(page, IMAGEN).locator('img')).toHaveCount(0);
  });

  test('H2-E2: sin texto alternativo ni marca de decorativa no se guarda; con la marca sí', async ({ page }) => {
    const nombre = nombreDePrueba('doc-alt');
    await abrirNuevo(page);
    await page.getByLabel('Título', { exact: true }).fill(nombre);
    await insertarDesdeBarra(page, 'Imagen');
    const panel = panelDePropiedades(page);
    await elegirImagen(page, panel, archivoDeImagen('png'));

    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(panel.getByText(/texto alternativo/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/articulos\/nuevo$/);

    await panel.getByLabel('Imagen decorativa').check();
    await guardarYEsperar(page);
    const imagen = guardadoDeTipo(await articuloPorTitulo(nombre), 'imagen');
    expect(imagen?.attrs).toMatchObject({ imagen: { decorativa: true } });
  });

  test('H2-E2: una imagen con texto alternativo y leyenda se guarda como en el editor de hoy', async ({ page }) => {
    const nombre = nombreDePrueba('doc-imagen');
    await abrirNuevo(page);
    await page.getByLabel('Título', { exact: true }).fill(nombre);
    await insertarDesdeBarra(page, 'Imagen');
    const panel = panelDePropiedades(page);

    await subirImagenConAlt(page, panel, 'Una foto de prueba');
    await panel.getByLabel('Leyenda', { exact: true }).fill('Leyenda de la foto');
    await guardarYEsperar(page);

    const imagen = guardadoDeTipo(await articuloPorTitulo(nombre), 'imagen');
    expect(imagen?.attrs).toMatchObject({
      imagen: { alt: 'Una foto de prueba', decorativa: false },
      leyenda: 'Leyenda de la foto',
    });
  });

  test('H2-E3: galería: se inserta, se completa en el panel y se guarda con columnas e imágenes', async ({ page }) => {
    const nombre = nombreDePrueba('doc-galeria');
    await abrirNuevo(page);
    await page.getByLabel('Título', { exact: true }).fill(nombre);
    await insertarDesdeBarra(page, 'Galería');
    const panel = panelDePropiedades(page);

    await panel.getByLabel('Columnas', { exact: true }).selectOption('2');
    await elegirImagen(page, panel, archivoDeImagen('png', 'uno.png'));
    await elegirImagen(page, panel, archivoDeImagen('png', 'dos.png'));
    await expect(panel.getByLabel('Texto alternativo', { exact: true })).toHaveCount(2);
    await panel.getByLabel('Texto alternativo', { exact: true }).nth(0).fill('Primera imagen');
    await panel.getByLabel('Texto alternativo', { exact: true }).nth(1).fill('Segunda imagen');

    await expect(isla(page, /^Galería, \d+ de \d+$/).locator('img')).toHaveCount(2);
    await guardarYEsperar(page);
    const galeria = guardadoDeTipo(await articuloPorTitulo(nombre), 'galeria');
    expect(galeria?.attrs).toMatchObject({ columnas: 2 });
    expect(galeria?.attrs.imagenes).toHaveLength(2);
  });

  test('H2-E3: llamada a la acción: el foco entra al panel, el botón se ve con su etiqueta y se guarda', async ({
    page,
  }) => {
    const nombre = nombreDePrueba('doc-cta');
    await abrirNuevo(page);
    await page.getByLabel('Título', { exact: true }).fill(nombre);
    await insertarDesdeBarra(page, 'Llamada a la acción');
    const panel = panelDePropiedades(page);
    expect(await panelTieneElFoco(page)).toBe(true);

    await panel.getByLabel('Título', { exact: true }).fill('Suscríbete');
    await panel.getByLabel('Texto', { exact: true }).fill('Recibe las novedades');
    await panel.getByLabel('Texto del botón', { exact: true }).fill('Suscribirme');
    await panel.getByLabel('URL', { exact: true }).fill('https://example.com/suscribir');

    const elemento = isla(page, /^Llamada a la acción, \d+ de \d+$/);
    await expect(elemento).toContainText('Suscríbete');
    await expect(elemento.getByText('Suscribirme')).toBeVisible();
    await guardarYEsperar(page);
    const llamada = guardadoDeTipo(await articuloPorTitulo(nombre), 'cta');
    expect(llamada?.attrs).toMatchObject({
      titulo: 'Suscríbete',
      texto: 'Recibe las novedades',
      etiquetaBoton: 'Suscribirme',
      url: 'https://example.com/suscribir',
    });
  });

  test('H2-E3: video: se ve la vista del video y se guardan proveedor, ID y título', async ({ page }) => {
    const nombre = nombreDePrueba('doc-video');
    await abrirNuevo(page);
    await page.getByLabel('Título', { exact: true }).fill(nombre);
    await insertarDesdeBarra(page, 'Video');
    const panel = panelDePropiedades(page);
    expect(await panelTieneElFoco(page)).toBe(true);

    await panel.getByLabel('Proveedor', { exact: true }).selectOption('youtube');
    await panel.getByLabel('ID del video', { exact: true }).fill('dQw4w9WgXcQ');
    await panel.getByLabel('Título del video', { exact: true }).fill('Un video de prueba');

    await expect(isla(page, /^Video, \d+ de \d+$/)).toContainText('Un video de prueba');
    await guardarYEsperar(page);
    const video = guardadoDeTipo(await articuloPorTitulo(nombre), 'video');
    expect(video?.attrs).toMatchObject({ proveedor: 'youtube', idVideo: 'dQw4w9WgXcQ', titulo: 'Un video de prueba' });
  });

  test('H2-E3: código: el foco queda en el bloque, el texto se escribe en el lienzo y el lenguaje en el panel', async ({
    page,
  }) => {
    const nombre = nombreDePrueba('doc-codigo');
    await abrirNuevo(page);
    await page.getByLabel('Título', { exact: true }).fill(nombre);
    await insertarConBarra(page, 'codigo');

    expect(
      await lienzo(page)
        .locator('pre')
        .evaluate((el) => el.contains(getSelection()?.anchorNode ?? null)),
    ).toBe(true);
    await page.keyboard.type('const x = 1;');
    await expect(lienzo(page).locator('pre')).toHaveText('const x = 1;');
    await expect(panelDePropiedades(page).getByLabel('Lenguaje', { exact: true })).toBeVisible();
    await expect(panelDePropiedades(page).getByLabel('Código', { exact: true })).toHaveCount(0);

    await panelDePropiedades(page).getByLabel('Lenguaje', { exact: true }).fill('ts');
    await guardarYEsperar(page);
    const bloqueDeCodigo = guardadoDeTipo(await articuloPorTitulo(nombre), 'codeBlock');
    expect(textoDe(bloqueDeCodigo)).toBe('const x = 1;');
    expect(bloqueDeCodigo?.attrs).toMatchObject({ lenguaje: 'ts' });
  });

  test('H2-E3: separador: el foco pasa al párrafo siguiente', async ({ page }) => {
    await abrirNuevo(page);
    await insertarDesdeBarra(page, 'Separador');

    await expect(lienzo(page).locator('hr')).toHaveCount(1);
    expect(await lienzoTieneElFoco(page)).toBe(true);
    await expect(lienzo(page).locator('hr + p')).toHaveCount(1);
    await page.keyboard.type('Después del separador');
    await expect(lienzo(page).locator('hr + p')).toHaveText('Después del separador');
  });

  test('H2-E3: una cita con autor y fuente: el panel pide solo autor y fuente, y se guardan', async ({ page }) => {
    const nombre = nombreDePrueba('doc-cita');
    await abrirNuevo(page);
    await page.getByLabel('Título', { exact: true }).fill(nombre);
    await escribirEnLienzo(page, 'Una cita memorable');
    await elegirEstilo(page, 'Cita');
    await botonPropiedades(page).click();

    const panel = panelDePropiedades(page);
    await expect(panel.getByLabel('Texto', { exact: true })).toHaveCount(0);
    await panel.getByLabel('Autor', { exact: true }).fill('Alguien');
    await panel.getByLabel(/^Fuente/).fill('https://example.com/fuente');
    await guardarYEsperar(page);

    const guardada = guardadoDeTipo(await articuloPorTitulo(nombre), 'blockquote');
    expect(textoDe(guardada)).toBe('Una cita memorable');
    expect(guardada?.attrs).toMatchObject({ autor: 'Alguien', fuente: 'https://example.com/fuente' });
  });

  test('H2-E4: al cambiar un campo en el panel, el lienzo se actualiza al instante', async ({ page }) => {
    await abrirNuevo(page);
    await insertarDesdeBarra(page, 'Llamada a la acción');
    const panel = panelDePropiedades(page);
    const elemento = isla(page, /^Llamada a la acción, \d+ de \d+$/);

    await panel.getByLabel('Texto del botón', { exact: true }).fill('Comprar ahora');
    await expect(elemento.getByText('Comprar ahora')).toBeVisible();
    await panel.getByLabel('Texto del botón', { exact: true }).fill('Reservar');
    await expect(elemento.getByText('Reservar')).toBeVisible();
    await expect(elemento.getByText('Comprar ahora')).toHaveCount(0);
  });

  test('H2-E5: guardar con una imagen sin texto alternativo la marca con texto, la selecciona y enfoca el campo', async ({
    page,
  }) => {
    await abrirNuevo(page);
    await page.getByLabel('Título', { exact: true }).fill(nombreDePrueba('doc-error'));
    await escribirEnLienzo(page, 'Texto antes de la imagen');
    await page.keyboard.press('Enter');
    await insertarDesdeBarra(page, 'Imagen');
    await elegirImagen(page, panelDePropiedades(page), archivoDeImagen('png'));
    // El texto alternativo queda vacío: se vuelve al texto, así la imagen no está seleccionada.
    await lienzo(page).locator('p').first().click();

    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect(isla(page, IMAGEN)).toContainText(/texto alternativo/i);
    await expect(panelDePropiedades(page)).toBeVisible();
    await expect(panelDePropiedades(page).getByLabel('Texto alternativo', { exact: true })).toBeFocused();

    // Sin seleccionar el elemento, el error sigue visible en el lienzo como texto (no solo color).
    await lienzo(page).locator('p').first().click();
    await expect(isla(page, IMAGEN)).toContainText(/texto alternativo/i);
  });

  test('H2-E7: el elemento especial se anuncia con su tipo y posición y sus botones no se tabulan', async ({
    page,
  }) => {
    const articulo = await sembrarOchoElementos(nombreDePrueba('doc-nombres'));
    await abrirArticulo(page, articulo.id);

    await expect(isla(page, 'Imagen, 3 de 8')).toBeVisible();
    await expect(isla(page, 'Llamada a la acción, 7 de 8')).toBeVisible();
    const tabulables = isla(page, 'Imagen, 3 de 8').locator('button:not([tabindex="-1"]), a:not([tabindex="-1"])');
    await expect(tabulables).toHaveCount(0);
  });

  test('H2-E7: con el teclado se llega al panel: Esc entra al modo elementos y Enter enfoca el primer campo', async ({
    page,
  }) => {
    const articulo = await sembrarOchoElementos(nombreDePrueba('doc-teclado'));
    await abrirArticulo(page, articulo.id);

    await isla(page, 'Imagen, 3 de 8').click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');

    await expect(panelDePropiedades(page)).toHaveAccessibleName('Propiedades del elemento 3, imagen');
    await expect.poll(() => panelTieneElFoco(page)).toBe(true);
  });

  test('H2-E7: el botón «Propiedades» de la barra lleva al panel de un elemento especial', async ({ page }) => {
    const articulo = await sembrarOchoElementos(nombreDePrueba('doc-boton-prop'));
    await abrirArticulo(page, articulo.id);

    await isla(page, 'Llamada a la acción, 7 de 8').click();
    await botonPropiedades(page).click();

    await expect(panelDePropiedades(page)).toHaveAccessibleName('Propiedades del elemento 7, llamada a la acción');
    await expect(panelDePropiedades(page).getByLabel('Texto del botón', { exact: true })).toBeVisible();
  });
});

test.describe('Elementos especiales y panel: columna lateral desde 1280 px (H2-E6)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('H2-E6: el panel es la pestaña «Elemento», «Publicación» siempre visible y sin hoja', async ({ page }) => {
    const articulo = await sembrarOchoElementos(nombreDePrueba('doc-lateral'));
    await abrirArticulo(page, articulo.id);

    await expect(page.getByRole('tablist')).toBeVisible();
    await expect(pestana(page, 'Artículo')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('region', { name: 'Publicación' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar', exact: true })).toHaveCount(0);

    await isla(page, 'Imagen, 3 de 8').click();
    await expect(pestana(page, 'Elemento')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Elemento' })).toBeVisible();
    await expect(panelDePropiedades(page)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Publicación' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar', exact: true })).toHaveCount(0);
  });

  test('H2-E6: la pestaña cambia sola solo al seleccionar un elemento especial; la elección manual se respeta', async ({
    page,
  }) => {
    const articulo = await sembrarOchoElementos(nombreDePrueba('doc-pestana'));
    await abrirArticulo(page, articulo.id);

    await isla(page, 'Imagen, 3 de 8').click();
    await expect(pestana(page, 'Elemento')).toHaveAttribute('aria-selected', 'true');

    await pestana(page, 'Artículo').click();
    await lienzo(page).locator('p').first().click();
    await expect(pestana(page, 'Artículo')).toHaveAttribute('aria-selected', 'true');

    await isla(page, 'Llamada a la acción, 7 de 8').click();
    await expect(pestana(page, 'Elemento')).toHaveAttribute('aria-selected', 'true');
  });

  test('H2-E6: las pestañas se recorren con las flechas', async ({ page }) => {
    const articulo = await sembrarOchoElementos(nombreDePrueba('doc-flechas'));
    await abrirArticulo(page, articulo.id);

    await pestana(page, 'Artículo').focus();
    await page.keyboard.press('ArrowRight');
    await expect(pestana(page, 'Elemento')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(pestana(page, 'Artículo')).toBeFocused();
  });

  test('H2-E6: sin elemento seleccionado, la pestaña «Elemento» invita a seleccionar uno', async ({ page }) => {
    const articulo = await sembrarOchoElementos(nombreDePrueba('doc-vacio'));
    await abrirArticulo(page, articulo.id);

    await pestana(page, 'Elemento').click();
    await expect(page.getByText('Selecciona un elemento para editar sus propiedades')).toBeVisible();
  });
});

test.describe('Elementos especiales y panel: hoja por debajo de 1280 px (H2-E6)', () => {
  for (const ancho of [1024, 768, 360]) {
    test.describe(`${ancho} px`, () => {
      test.use({ viewport: { width: ancho, height: 800 } });

      test(`H2-E6: tocar el elemento no abre la hoja; «Propiedades» la abre y «Cerrar» la cierra (${ancho} px)`, async ({
        page,
      }) => {
        const articulo = await sembrarOchoElementos(nombreDePrueba(`doc-hoja-${ancho}`));
        await abrirArticulo(page, articulo.id);
        await expect(page.getByRole('tablist')).toHaveCount(0);

        await isla(page, 'Imagen, 3 de 8').click();
        await expect(panelDePropiedades(page)).toHaveCount(0);

        await botonPropiedades(page).click();
        const hoja = panelDePropiedades(page);
        await expect(hoja).toBeVisible();
        await expect(hoja).toHaveAccessibleName('Propiedades del elemento 3, imagen');
        await expect(hoja.getByRole('button', { name: 'Cerrar', exact: true })).toBeVisible();

        // No tapa el elemento seleccionado ni la barra de acciones del artículo (la hoja se acomoda al abrirse). Un
        // elemento más alto que el espacio libre sobre la hoja (la imagen mide ~440 px y la hoja ocupa 45 dvh) queda con
        // su borde superior a la vista: el resto se desplaza.
        const barra = page.getByRole('group', { name: 'Acciones del artículo' });
        await expect
          .poll(async () => {
            const cajaHoja = (await hoja.boundingBox())!;
            const cajaIsla = (await isla(page, 'Imagen, 3 de 8').boundingBox())!;
            const cajaBarra = (await barra.isVisible()) ? (await barra.boundingBox())! : null;
            const libre = cajaHoja.y - cajaIsla.y;
            const aLaVista = cajaIsla.y >= 0 && (libre >= cajaIsla.height - 1 || libre >= 120);
            return aLaVista && (cajaBarra === null || cajaHoja.y + cajaHoja.height <= cajaBarra.y + 1);
          })
          .toBe(true);

        await hoja.getByRole('button', { name: 'Cerrar', exact: true }).click();
        await expect(panelDePropiedades(page)).toHaveCount(0);
      });

      test(`H2-E6: Esc cierra la hoja y el foco vuelve al elemento seleccionado (${ancho} px)`, async ({ page }) => {
        const articulo = await sembrarOchoElementos(nombreDePrueba(`doc-hoja-esc-${ancho}`));
        await abrirArticulo(page, articulo.id);

        await isla(page, 'Imagen, 3 de 8').click();
        await botonPropiedades(page).click();
        await expect(panelDePropiedades(page)).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(panelDePropiedades(page)).toHaveCount(0);
        expect(await lienzoTieneElFoco(page)).toBe(true);
      });

      test(`H2-E6: Enter en modo elementos abre la hoja con el foco en el primer campo (${ancho} px)`, async ({
        page,
      }) => {
        const articulo = await sembrarOchoElementos(nombreDePrueba(`doc-hoja-enter-${ancho}`));
        await abrirArticulo(page, articulo.id);

        await isla(page, 'Llamada a la acción, 7 de 8').click();
        await page.keyboard.press('Escape');
        await page.keyboard.press('Enter');

        await expect(panelDePropiedades(page)).toBeVisible();
        await expect.poll(() => panelTieneElFoco(page)).toBe(true);
      });
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// T064 (spec 005, H3 esc. 1 a 11; CE-003; quickstart C). FASE ROJA: el menú de acciones, el asa, el modo elementos y la
// protección de borrado no existen aún (el botón «Acciones» de la barra está deshabilitado). Supuestos de interfaz: ver el
// encabezado "mover, duplicar, quitar y seleccionar" de ./ayudas/editor.ts. Además:
//   - Con el cursor en un elemento de texto o con una isla seleccionada, «Acciones» actúa sobre ese elemento; Esc entra al
//     modo elementos; Alt+↑/↓ mueven, Mod+D duplica y Supr o Retroceso quitan (solo en modo elementos).
//   - Mover y duplicar dejan el modo elementos puesto sobre el elemento movido o sobre la copia; quitar sale del modo.
//   - Una imagen ya guardada es la del artículo sembrado (`articulos/e2e-inexistente.png`, ver sembrarOchoElementos).
//   - La subida en curso se simula demorando `**/storage/v1/object/upload/sign/**` (como en medios.spec.ts).
//   - El arrastre táctil usa eventos táctiles reales por CDP (Chromium) sobre el asa; el dedo sobre el texto solo desplaza.
//   - El E2E del orden de `Esc` con la hoja usa 1024 px (la hoja existe por debajo de 1280 px).
// ---------------------------------------------------------------------------------------------------------------------

const CINCO = ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'];
const sembrarCinco = (titulo: string) => sembrarArticulo({ titulo, contenido: CINCO.map((texto) => parrafo(texto)) });
const sembrarConImagenGuardada = (titulo: string) =>
  sembrarArticulo({
    titulo,
    contenido: [parrafo('Uno'), imagenElemento(imagenSemilla('articulos/e2e-inexistente.png')), parrafo('Tres')],
  });
const enfocadoEnTexto = (page: Page, texto: string) =>
  page.evaluate((esperado) => {
    const nodo = window.getSelection()?.anchorNode;
    const elemento = nodo instanceof Element ? nodo : nodo?.parentElement;
    return elemento?.closest('[contenteditable] > *')?.textContent === esperado;
  }, texto);
const anuncio = (page: Page, texto: string | RegExp) => regionDeEstado(page).filter({ hasText: texto });
const menuItem = (page: Page, nombre: string) => page.getByRole('menuitem', { name: nombre, exact: true });

test.describe('Mover, duplicar, quitar y seleccionar', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.describe('el menú de acciones', () => {
    test('H3-E1: el botón «Acciones» dice a qué elemento actúa y abre un menú con todas las acciones', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-acc-menu'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Tres', { exact: true }).click();

      const boton = botonAcciones(page);
      await expect(boton).toHaveAccessibleName('Acciones del elemento 3, párrafo');
      await expect(boton).toHaveAttribute('aria-haspopup', 'menu');
      await expect(boton).toHaveAttribute('aria-expanded', 'false');

      await boton.click();
      await expect(boton).toHaveAttribute('aria-expanded', 'true');
      const nombres = ['Subir', 'Bajar', 'Duplicar', 'Convertir en…', 'Quitar', 'Seleccionar', 'Propiedades', 'Atajos'];
      for (const nombre of nombres) await expect(accionDelMenu(page, nombre), nombre).toBeVisible();
    });

    test('H3-E1: el asa aparece al pasar el puntero, tiene el mismo nombre y no entra en el orden de tabulación', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-asa'));
      await abrirArticulo(page, articulo.id);

      await lienzo(page).getByText('Tres', { exact: true }).hover();

      const asa = asaDeElemento(page);
      await expect(asa).toBeVisible();
      await expect(asa).toHaveAccessibleName('Acciones del elemento 3, párrafo');
      await expect(asa).toHaveAttribute('tabindex', '-1');
    });

    test('H3-E1: pulsar el asa abre el mismo menú de acciones', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-asa-menu'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Dos', { exact: true }).hover();

      await asaDeElemento(page).click();

      await expect(menuDeAcciones(page)).toBeVisible();
      await expect(accionDelMenu(page, 'Duplicar')).toBeVisible();
    });

    test('H3-E2: el menú se maneja con flechas, Inicio, Fin y una letra; Esc lo cierra sin sacar el foco del lienzo', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-acc-teclado'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Tres', { exact: true }).click();
      await botonAcciones(page).focus();
      await page.keyboard.press('Enter');
      await expect(menuDeAcciones(page)).toBeVisible();
      const items = menuDeAcciones(page).getByRole('menuitem');

      await page.keyboard.press('ArrowDown');
      await expect(items.first()).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(items.nth(1)).toBeFocused();
      await page.keyboard.press('End');
      await expect(items.last()).toBeFocused();
      await page.keyboard.press('Home');
      await expect(items.first()).toBeFocused();
      await page.keyboard.press('d');
      await expect(accionDelMenu(page, 'Duplicar')).toBeFocused();

      await page.keyboard.press('Escape');
      await expect(menuDeAcciones(page)).toHaveCount(0);
      expect(await lienzoTieneElFoco(page)).toBe(true);
    });

    test('H3-E2: «Subir» y «Bajar» cambian el elemento de lugar, dejan el foco en él y anuncian la posición', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-acc-mover'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Tres', { exact: true }).click();

      await elegirAccion(page, 'Subir');

      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Tres', 'Dos', 'Cuatro', 'Cinco']);
      await expect(anuncio(page, 'Elemento movido a la posición 2 de 5')).toBeVisible();
      expect(await enfocadoEnTexto(page, 'Tres')).toBe(true);

      await elegirAccion(page, 'Bajar');
      expect(await textosDelLienzo(page)).toEqual(CINCO);
      await expect(anuncio(page, 'Elemento movido a la posición 3 de 5')).toBeVisible();
    });

    test('H3-E2: en los extremos «Subir» y «Bajar» no están disponibles (aria-disabled)', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-acc-extremos'));
      await abrirArticulo(page, articulo.id);

      await lienzo(page).getByText('Uno', { exact: true }).click();
      await botonAcciones(page).click();
      await expect(accionDelMenu(page, 'Subir')).toHaveAttribute('aria-disabled', 'true');
      await expect(accionDelMenu(page, 'Bajar')).not.toHaveAttribute('aria-disabled', 'true');
      await page.keyboard.press('Escape');

      await lienzo(page).getByText('Cinco', { exact: true }).click();
      await botonAcciones(page).click();
      await expect(accionDelMenu(page, 'Bajar')).toHaveAttribute('aria-disabled', 'true');
      await expect(accionDelMenu(page, 'Subir')).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('H3-E5: «Duplicar» deja una copia justo debajo, con el foco en ella y un identificador nuevo al guardar', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-acc-duplicar'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Dos', { exact: true }).click();

      await elegirAccion(page, 'Duplicar');

      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Dos', 'Dos', 'Tres', 'Cuatro', 'Cinco']);
      await expect(anuncio(page, 'Elemento duplicado, posición 3 de 6')).toBeVisible();
      await expect(botonAcciones(page)).toHaveAccessibleName('Acciones del elemento 3, párrafo');
      await guardarYEsperar(page);
      const ids = elementosDe(await articuloPorId(articulo.id)).map((elemento) => elemento.attrs.id);
      expect(ids).toHaveLength(6);
      expect(new Set(ids).size).toBe(6);
    });

    test('H3-E6: «Convertir en…» cambia el tipo conservando el texto y anuncia el nuevo tipo', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-acc-convertir'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Tres', { exact: true }).click();

      await elegirAccion(page, 'Convertir en…');
      await menuItem(page, 'Título 2').click();

      await expect(lienzo(page).locator('h2')).toHaveText('Tres');
      await expect(anuncio(page, /Se convirtió en/)).toBeVisible();
      await guardarYEsperar(page);
      const convertido = elementosDe(await articuloPorId(articulo.id))[2];
      expect(convertido).toMatchObject({ type: 'heading', attrs: { level: 2 } });
      expect(textoDe(convertido)).toBe('Tres');
    });

    test('H3-E6: convertir una lista de varios ítems en párrafo avisa antes; cancelar no cambia nada', async ({
      page,
    }) => {
      const articulo = await sembrarArticulo({
        titulo: nombreDePrueba('doc-acc-convertir-lista'),
        contenido: [lista(['a', 'b', 'c'])],
      });
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('b', { exact: true }).click();

      await elegirAccion(page, 'Convertir en…');
      await menuItem(page, 'Párrafo').click();
      const aviso = page.getByRole('alertdialog');
      await expect(aviso).toBeVisible();
      await expect(aviso).toContainText(/ítems|items/i);
      await aviso.getByRole('button', { name: 'Cancelar' }).click();
      await expect(lienzo(page).locator('li')).toHaveCount(3);

      await elegirAccion(page, 'Convertir en…');
      await menuItem(page, 'Párrafo').click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Convertir' }).click();
      await expect(lienzo(page).locator('li')).toHaveCount(0);
    });

    test('H3-E6: convertir una cita con autor en párrafo avisa de que se pierde el autor', async ({ page }) => {
      const articulo = await sembrarArticulo({
        titulo: nombreDePrueba('doc-acc-convertir-cita'),
        contenido: [cita('Una cita', { autor: 'Alguien' })],
      });
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Una cita', { exact: true }).click();

      await elegirAccion(page, 'Convertir en…');
      await menuItem(page, 'Párrafo').click();

      await expect(page.getByRole('alertdialog')).toContainText(/autor/i);
    });

    test('H3-E7: «Quitar» saca el elemento, pasa el foco al contiguo y anuncia cómo deshacer', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-acc-quitar'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Tres', { exact: true }).click();

      await elegirAccion(page, 'Quitar');

      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Dos', 'Cuatro', 'Cinco']);
      await expect(anuncio(page, 'Elemento quitado. Pulsa Ctrl+Z para deshacer')).toBeVisible();
      expect(await lienzoTieneElFoco(page)).toBe(true);

      await page.keyboard.press(`${MOD}+z`);
      expect(await textosDelLienzo(page)).toEqual(CINCO);
    });

    test('H3-E7: quitar el último elemento deja el foco en el anterior', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-acc-quitar-ultimo'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Cinco', { exact: true }).click();

      await elegirAccion(page, 'Quitar');

      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Dos', 'Tres', 'Cuatro']);
      expect(await enfocadoEnTexto(page, 'Cuatro')).toBe(true);
    });

    test('H3-E7: quitar una imagen ya guardada pide confirmación; cancelar la deja y confirmar la quita', async ({
      page,
    }) => {
      const articulo = await sembrarConImagenGuardada(nombreDePrueba('doc-acc-imagen'));
      await abrirArticulo(page, articulo.id);
      await isla(page, 'Imagen, 2 de 3').click();

      await elegirAccion(page, 'Quitar');
      const confirmacion = page.getByRole('alertdialog');
      await expect(confirmacion).toBeVisible();
      await confirmacion.getByRole('button', { name: 'Cancelar' }).click();
      await expect(isla(page, 'Imagen, 2 de 3')).toBeVisible();

      await elegirAccion(page, 'Quitar');
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: /^Quitar/ })
        .click();
      await expect(isla(page, IMAGEN)).toHaveCount(0);
    });
  });

  test.describe('atajos en modo elementos', () => {
    test('H3-E9: Esc entra al modo elementos con el elemento seleccionado y Esc otra vez vuelve al texto', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-modo-esc'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Tres', { exact: true }).click();

      await page.keyboard.press('Escape');
      await expect(textoDeSeleccion(page)).toHaveText('1 elemento seleccionado');
      await expect(elementosSeleccionados(page)).toHaveCount(1);
      await expect(anuncio(page, '1 elemento seleccionado')).toBeVisible();
      expect(await lienzoTieneElFoco(page)).toBe(true);

      await page.keyboard.press('Escape');
      await expect(textoDeSeleccion(page)).toHaveCount(0);
      await expect(elementosSeleccionados(page)).toHaveCount(0);
      expect(await lienzoTieneElFoco(page)).toBe(true);
      expect(await textosDelLienzo(page)).toEqual(CINCO);
    });

    test('H3-E9: «Seleccionar» del menú entra al modo elementos', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-modo-menu'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Dos', { exact: true }).click();

      await elegirAccion(page, 'Seleccionar');

      await expect(textoDeSeleccion(page)).toHaveText('1 elemento seleccionado');
    });

    test('H3-E9: Shift + clic sobre el asa entra al modo elementos', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-modo-asa'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Dos', { exact: true }).hover();

      await asaDeElemento(page).click({ modifiers: ['Shift'] });

      await expect(textoDeSeleccion(page)).toHaveText('1 elemento seleccionado');
      await expect(menuDeAcciones(page)).toHaveCount(0);
    });

    test('H3-E8: Alt+↑ y Alt+↓ mueven el elemento seleccionado y se anuncia la posición', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-atajo-mover'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Tres');

      await page.keyboard.press('Alt+ArrowUp');
      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Tres', 'Dos', 'Cuatro', 'Cinco']);
      await expect(anuncio(page, 'Elemento movido a la posición 2 de 5')).toBeVisible();
      await expect(textoDeSeleccion(page)).toBeVisible();

      await page.keyboard.press('Alt+ArrowUp');
      expect(await textosDelLienzo(page)).toEqual(['Tres', 'Uno', 'Dos', 'Cuatro', 'Cinco']);
      await page.keyboard.press('Alt+ArrowUp'); // ya en el extremo: no hace nada
      expect(await textosDelLienzo(page)).toEqual(['Tres', 'Uno', 'Dos', 'Cuatro', 'Cinco']);

      await page.keyboard.press('Alt+ArrowDown');
      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Tres', 'Dos', 'Cuatro', 'Cinco']);
    });

    test('H3-E8: Mod+D duplica el elemento seleccionado y la copia queda seleccionada', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-atajo-duplicar'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Dos');

      await page.keyboard.press(`${MOD}+d`);

      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Dos', 'Dos', 'Tres', 'Cuatro', 'Cinco']);
      await expect(botonAcciones(page)).toHaveAccessibleName('Acciones del elemento 3, párrafo');
      await expect(textoDeSeleccion(page)).toHaveText('1 elemento seleccionado');
    });

    test('H3-E8: Supr y Retroceso quitan el elemento seleccionado y se puede deshacer', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-atajo-quitar'));
      await abrirArticulo(page, articulo.id);

      await entrarAlModo(page, 'Dos');
      await page.keyboard.press('Delete');
      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Tres', 'Cuatro', 'Cinco']);
      await expect(anuncio(page, 'Elemento quitado. Pulsa Ctrl+Z para deshacer')).toBeVisible();

      await entrarAlModo(page, 'Cuatro');
      await page.keyboard.press('Backspace');
      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Tres', 'Cinco']);

      await page.keyboard.press(`${MOD}+z`);
      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Tres', 'Cuatro', 'Cinco']);
    });

    test('H3-E8: los atajos figuran en el menú de acciones y en el diálogo «Atajos de teclado» (con foco gestionado)', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-atajo-ayuda'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Tres', { exact: true }).click();

      await botonAcciones(page).click();
      await expect(accionDelMenu(page, 'Subir')).toContainText(/Alt\s*\+\s*↑/);
      await expect(accionDelMenu(page, 'Bajar')).toContainText(/Alt\s*\+\s*↓/);
      await expect(accionDelMenu(page, 'Duplicar')).toContainText(/(Ctrl|Cmd|⌘)\s*\+?\s*D/);
      await expect(accionDelMenu(page, 'Quitar')).toContainText(/Supr|Del/);

      await accionDelMenu(page, 'Atajos').click();
      const dialogo = page.getByRole('dialog', { name: 'Atajos de teclado' });
      await expect(dialogo).toBeVisible();
      await expect(dialogo.getByRole('heading', { name: 'Atajos de teclado' })).toBeFocused();
      await expect(dialogo).toContainText('Esc');

      await page.keyboard.press('Escape');
      await expect(dialogo).toHaveCount(0);
      await expect(botonAcciones(page)).toBeFocused();
    });

    test('H3-E9: un rango de texto que cruza párrafos da formato pero no habilita mover ni quitar', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-rango-texto'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Dos', { exact: true }).click();
      await page.keyboard.press('Shift+ArrowDown');
      await page.keyboard.press('Shift+ArrowDown');
      await expect(textoDeSeleccion(page)).toHaveCount(0);

      await page.keyboard.press('Alt+ArrowUp');
      await page.keyboard.press('Alt+ArrowDown');
      expect(await textosDelLienzo(page)).toEqual(CINCO);

      await botonAcciones(page).click();
      for (const nombre of ['Subir', 'Bajar', 'Quitar', 'Duplicar']) {
        await expect(accionDelMenu(page, nombre), nombre).toHaveAttribute('aria-disabled', 'true');
      }
      await page.keyboard.press('Escape');
      await expect(botonDeBarra(page, 'Negrita')).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  test.describe('selección de varios elementos', () => {
    test('H3-E9: Shift+↓ amplía a los contiguos, muestra «3 elementos seleccionados» y anuncia solo al terminar', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-multi-ampliar'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Dos');
      await observarAnunciosDeSeleccion(page);

      await page.keyboard.press('Shift+ArrowDown');
      await page.keyboard.press('Shift+ArrowDown');

      await expect(textoDeSeleccion(page)).toHaveText('3 elementos seleccionados');
      await expect(elementosSeleccionados(page)).toHaveCount(3);
      await expect(anuncio(page, '3 elementos seleccionados')).toBeVisible();
      await page.waitForTimeout(800);
      const anuncios = await anunciosDeSeleccion(page);
      expect(anuncios).toContain('3 elementos seleccionados');
      expect(anuncios).not.toContain('2 elementos seleccionados');
    });

    test('H3-E9: Shift+↑ amplía hacia arriba', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-multi-arriba'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Cuatro');

      await page.keyboard.press('Shift+ArrowUp');

      await expect(textoDeSeleccion(page)).toHaveText('2 elementos seleccionados');
    });

    test('H3-E9: cada elemento seleccionado lleva una marca que no depende del color, también en colores forzados', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-multi-marca'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Dos');
      await page.keyboard.press('Shift+ArrowDown');
      const seleccionados = elementosSeleccionados(page);
      await expect(seleccionados).toHaveCount(2);

      for (const forzados of ['none', 'active'] as const) {
        await page.emulateMedia({ forcedColors: forzados });
        for (let i = 0; i < 2; i++) {
          const marca = await seleccionados.nth(i).evaluate((el) => {
            const estilo = getComputedStyle(el);
            return {
              ancho: parseFloat(estilo.borderLeftWidth),
              estilo: estilo.borderLeftStyle,
              icono: el.querySelector('svg') !== null,
            };
          });
          expect(marca.estilo, `borde (${forzados})`).not.toBe('none');
          expect(marca.ancho, `borde (${forzados})`).toBeGreaterThanOrEqual(2);
          expect(marca.icono, `ícono (${forzados})`).toBe(true);
        }
      }
      await expect(elementosDelLienzo(page)).toHaveCount(5);
    });

    test('H3-E9: el botón «Salir de la selección» vuelve al texto', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-multi-salir'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Dos');
      await page.keyboard.press('Shift+ArrowDown');

      await page.getByRole('button', { name: 'Salir de la selección', exact: true }).click();

      await expect(textoDeSeleccion(page)).toHaveCount(0);
      await expect(elementosSeleccionados(page)).toHaveCount(0);
      expect(await textosDelLienzo(page)).toEqual(CINCO);
    });

    test('H3-E11: Esc o un clic en un texto cancelan la selección múltiple sin cambios', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-multi-cancelar'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Dos');
      await page.keyboard.press('Shift+ArrowDown');
      await expect(textoDeSeleccion(page)).toHaveText('2 elementos seleccionados');

      await page.keyboard.press('Escape');
      await expect(textoDeSeleccion(page)).toHaveCount(0);
      expect(await textosDelLienzo(page)).toEqual(CINCO);

      await entrarAlModo(page, 'Dos');
      await page.keyboard.press('Shift+ArrowDown');
      await lienzo(page).getByText('Cinco', { exact: true }).click();
      await expect(textoDeSeleccion(page)).toHaveCount(0);
      expect(await textosDelLienzo(page)).toEqual(CINCO);
    });

    test('H3-E10: el menú sobre varios elementos no ofrece «Convertir en…»', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-multi-convertir'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Dos');
      await page.keyboard.press('Shift+ArrowDown');

      await botonAcciones(page).click();

      await expect(accionDelMenu(page, 'Convertir en…')).toHaveCount(0);
      await expect(accionDelMenu(page, 'Quitar')).toBeVisible();
    });

    test('H3-E10: Alt+↑ mueve el conjunto y un solo Deshacer lo devuelve', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-multi-mover'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Tres');
      await page.keyboard.press('Shift+ArrowDown');

      await page.keyboard.press('Alt+ArrowUp');
      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Tres', 'Cuatro', 'Dos', 'Cinco']);

      await botonDeBarra(page, 'Deshacer').click();
      expect(await textosDelLienzo(page)).toEqual(CINCO);
      await expect(anuncio(page, /Se deshizo: mover elemento/)).toBeVisible();
    });

    test('H3-E10: Mod+D duplica el conjunto (A B → A B A′ B′) y un solo Deshacer quita las copias', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-multi-duplicar'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Dos');
      await page.keyboard.press('Shift+ArrowDown');

      await page.keyboard.press(`${MOD}+d`);
      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Dos', 'Tres', 'Dos', 'Tres', 'Cuatro', 'Cinco']);

      await page.keyboard.press(`${MOD}+z`);
      expect(await textosDelLienzo(page)).toEqual(CINCO);
    });

    test('H3-E10: quitar varios sin imágenes guardadas no pide confirmación y se anuncia la cantidad', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-multi-quitar'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Dos');
      await page.keyboard.press('Shift+ArrowDown');
      await page.keyboard.press('Shift+ArrowDown');

      await page.keyboard.press('Delete');

      await expect(page.getByRole('alertdialog')).toHaveCount(0);
      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Cinco']);
      await expect(anuncio(page, '3 elementos quitados. Pulsa Ctrl+Z para deshacer')).toBeVisible();
      await page.keyboard.press(`${MOD}+z`);
      expect(await textosDelLienzo(page)).toEqual(CINCO);
    });

    test('H3-E10: quitar varios pide confirmación solo si alguno tiene una imagen ya guardada', async ({ page }) => {
      const articulo = await sembrarConImagenGuardada(nombreDePrueba('doc-multi-quitar-imagen'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Uno');
      await page.keyboard.press('Shift+ArrowDown');

      await page.keyboard.press('Delete');

      const confirmacion = page.getByRole('alertdialog');
      await expect(confirmacion).toBeVisible();
      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Tres']);
      await confirmacion.getByRole('button', { name: /^Quitar/ }).click();
      await expect(isla(page, IMAGEN)).toHaveCount(0);
      expect(await textosDelLienzo(page)).toEqual(['Tres']);
    });

    test('H3-E10: arrastrar el asa de la selección mueve el conjunto', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-multi-asa'));
      await abrirArticulo(page, articulo.id);
      await entrarAlModo(page, 'Cuatro');
      await page.keyboard.press('Shift+ArrowDown');
      await lienzo(page).getByText('Cuatro', { exact: true }).hover();
      const asa = asaDeElemento(page);
      await expect(asa).toBeVisible();
      const cajaUno = (await lienzo(page).getByText('Uno', { exact: true }).boundingBox())!;

      await arrastrarConRaton(page, await centroDe(asa), { x: cajaUno.x + 40, y: cajaUno.y + 2 });

      expect(await textosDelLienzo(page)).toEqual(['Cuatro', 'Cinco', 'Uno', 'Dos', 'Tres']);
    });
  });

  test.describe('arrastrar el asa con el ratón', () => {
    test('H3-E3: soltar el asa entre otros dos elementos lo deja ahí, anuncia la posición y deja el foco en él', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-arrastre'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Tres', { exact: true }).hover();
      const asa = asaDeElemento(page);
      await expect(asa).toBeVisible();
      const cajaUno = (await lienzo(page).getByText('Uno', { exact: true }).boundingBox())!;

      await arrastrarConRaton(page, await centroDe(asa), { x: cajaUno.x + 40, y: cajaUno.y + 2 }, false);
      await expect(page.getByText('Soltar aquí: posición 1 de 5')).toBeVisible();
      await page.mouse.up();

      expect(await textosDelLienzo(page)).toEqual(['Tres', 'Uno', 'Dos', 'Cuatro', 'Cinco']);
      await expect(anuncio(page, 'Elemento movido a la posición 1 de 5')).toBeVisible();
      expect(await enfocadoEnTexto(page, 'Tres')).toBe(true);
      await expect(page.getByText(/^Soltar aquí/)).toHaveCount(0);
    });

    test('H3-E3: el indicador de destino cambia con el puntero', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-arrastre-destino'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Dos', { exact: true }).hover();
      const asa = asaDeElemento(page);
      const cajaCinco = (await lienzo(page).getByText('Cinco', { exact: true }).boundingBox())!;
      const destino = { x: cajaCinco.x + 40, y: cajaCinco.y + cajaCinco.height - 2 };

      await arrastrarConRaton(page, await centroDe(asa), destino, false);

      await expect(page.getByText('Soltar aquí: posición 5 de 5')).toBeVisible();
      await page.mouse.up();
      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Tres', 'Cuatro', 'Cinco', 'Dos']);
    });

    test('H3-E3: Esc durante el arrastre lo cancela sin cambios', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-arrastre-esc'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Tres', { exact: true }).hover();
      const asa = asaDeElemento(page);
      const cajaUno = (await lienzo(page).getByText('Uno', { exact: true }).boundingBox())!;

      await arrastrarConRaton(page, await centroDe(asa), { x: cajaUno.x + 40, y: cajaUno.y + 2 }, false);
      await expect(page.getByText(/^Soltar aquí/)).toBeVisible();
      await page.keyboard.press('Escape');
      await page.mouse.up();

      expect(await textosDelLienzo(page)).toEqual(CINCO);
      await expect(page.getByText(/^Soltar aquí/)).toHaveCount(0);
    });

    test('H3-E3: soltar fuera del documento cancela el movimiento', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-arrastre-fuera'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Tres', { exact: true }).hover();
      const asa = asaDeElemento(page);

      await arrastrarConRaton(page, await centroDe(asa), { x: 5, y: 5 });

      expect(await textosDelLienzo(page)).toEqual(CINCO);
      await expect(page.getByText(/^Soltar aquí/)).toHaveCount(0);
    });

    test('H3-E3: arrastrar una imagen por su cuerpo no la mueve (solo el asa arrastra)', async ({ page }) => {
      const articulo = await sembrarConImagenGuardada(nombreDePrueba('doc-arrastre-nodo'));
      await abrirArticulo(page, articulo.id);
      const cajaUno = (await lienzo(page).getByText('Uno', { exact: true }).boundingBox())!;

      await arrastrarConRaton(page, await centroDe(isla(page, IMAGEN)), { x: cajaUno.x + 40, y: cajaUno.y + 2 });

      expect(await textosDelLienzo(page)).toEqual(['Uno', 'Tres']);
      await expect(isla(page, 'Imagen, 2 de 3')).toBeVisible();
    });
  });

  test.describe('subida en curso', () => {
    test('H3-E7: con una subida en curso no se puede mover ni quitar, y se anuncia por qué', async ({ page }) => {
      await page.route('**/storage/v1/object/upload/sign/**', async (ruta) => {
        await new Promise((resolver) => setTimeout(resolver, 3000));
        await ruta.continue();
      });
      const articulo = await sembrarCinco(nombreDePrueba('doc-subida'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Cinco', { exact: true }).click();
      await insertarDesdeBarra(page, 'Imagen');
      await elegirImagen(page, panelDePropiedades(page), archivoDeImagen('png'));
      await isla(page, IMAGEN).click();
      await page.keyboard.press('Escape');

      await botonAcciones(page).click();
      for (const nombre of ['Subir', 'Bajar', 'Quitar']) {
        await expect(accionDelMenu(page, nombre), nombre).toHaveAttribute('aria-disabled', 'true');
      }
      await page.keyboard.press('Escape');

      await page.keyboard.press('Alt+ArrowUp');
      await page.keyboard.press('Delete');
      await expect(anuncio(page, 'Subiendo imagen… No se puede mover ni quitar hasta que termine')).toBeVisible();
      await expect(isla(page, IMAGEN)).toBeVisible();
      expect(await textosDelLienzo(page)).toEqual(CINCO);
    });
  });

  test.describe('orden de Esc con la hoja (por debajo de 1280 px)', () => {
    test.use({ viewport: { width: 1024, height: 800 } });

    test('H3-E11: Esc cierra primero el menú, después la selección múltiple y por último la hoja', async ({ page }) => {
      const articulo = await sembrarOchoElementos(nombreDePrueba('doc-esc-orden'));
      await abrirArticulo(page, articulo.id);
      await isla(page, 'Imagen, 3 de 8').click();
      await botonPropiedades(page).click();
      await expect(panelDePropiedades(page)).toBeVisible();

      await botonAcciones(page).click();
      await expect(menuDeAcciones(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menuDeAcciones(page)).toHaveCount(0);
      await expect(panelDePropiedades(page)).toBeVisible();

      // Con la hoja abierta la franja libre es angosta: se deja el texto en ella antes de hacer clic (Playwright
      // centra el elemento, y ahí lo tapan la hoja y la barra fija).
      const dos = lienzo(page).getByText('Dos', { exact: true });
      await dos.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 160));
      await dos.click();
      await page.keyboard.press('Escape');
      await page.keyboard.press('Shift+ArrowDown');
      await expect(textoDeSeleccion(page)).toHaveText('2 elementos seleccionados');
      await page.keyboard.press('Escape');
      await expect(textoDeSeleccion(page)).toHaveCount(0);
      await expect(panelDePropiedades(page)).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(panelDePropiedades(page)).toHaveCount(0);
      expect(await lienzoTieneElFoco(page)).toBe(true);
    });
  });

  test.describe('con el dedo (emulación táctil)', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('H3-E3: arrastrar el asa con el dedo reordena el elemento', async ({ page }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-tactil-asa'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Tres', { exact: true }).tap();
      const asa = asaDeElemento(page);
      await expect(asa).toBeVisible();
      const inicio = await centroDe(asa);
      const cajaUno = (await lienzo(page).getByText('Uno', { exact: true }).boundingBox())!;
      const destino = { x: cajaUno.x + 20, y: cajaUno.y + 2 };
      const pasos = Array.from({ length: 10 }, (_, i) => ({
        x: inicio.x + ((destino.x - inicio.x) * (i + 1)) / 10,
        y: inicio.y + ((destino.y - inicio.y) * (i + 1)) / 10,
      }));

      const sesion = await gestoTactil(page, inicio, pasos, false);
      await expect(page.getByText('Soltar aquí: posición 1 de 5')).toBeVisible();
      await sesion.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

      expect(await textosDelLienzo(page)).toEqual(['Tres', 'Uno', 'Dos', 'Cuatro', 'Cinco']);
    });

    test('H3-E4: desplazar la pantalla con el dedo sobre el texto no inicia ningún arrastre', async ({ page }) => {
      const articulo = await sembrarArticulo({
        titulo: nombreDePrueba('doc-tactil-scroll'),
        contenido: Array.from({ length: 40 }, (_, i) => parrafo(`Párrafo número ${i + 1}`)),
      });
      await abrirArticulo(page, articulo.id);
      const antes = await textosDelLienzo(page);
      const origen = await centroDe(lienzo(page).getByText('Párrafo número 3', { exact: true }));
      const pasos = Array.from({ length: 12 }, (_, i) => ({ x: origen.x, y: origen.y - (i + 1) * 20 }));

      await gestoTactil(page, origen, pasos);

      expect(await textosDelLienzo(page)).toEqual(antes);
      await expect(page.getByText(/^Soltar aquí/)).toHaveCount(0);
      await expect(textoDeSeleccion(page)).toHaveCount(0);
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    });

    test('H3-E3: en una imagen, un toque largo no inicia un arrastre del elemento', async ({ page }) => {
      const articulo = await sembrarConImagenGuardada(nombreDePrueba('doc-tactil-imagen'));
      await abrirArticulo(page, articulo.id);

      const sesion = await gestoTactil(page, await centroDe(isla(page, IMAGEN)), [], false);
      await page.waitForTimeout(800);
      await sesion.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

      await expect(page.getByText(/^Soltar aquí/)).toHaveCount(0);
      await expect(isla(page, 'Imagen, 2 de 3')).toBeVisible();
    });
  });

  test.describe('una imagen ya guardada pide confirmación por cualquier vía (H3-E7)', () => {
    const VIAS: { via: string; accion: (page: Page) => Promise<void> }[] = [
      { via: 'el menú «Quitar»', accion: (page) => elegirAccion(page, 'Quitar') },
      { via: 'Supr en modo elementos', accion: (page) => page.keyboard.press('Delete') },
      { via: 'Retroceso en modo elementos', accion: (page) => page.keyboard.press('Backspace') },
      { via: 'cortar', accion: (page) => page.keyboard.press(`${MOD}+x`) },
      { via: 'escribir sobre la selección', accion: (page) => page.keyboard.type('x') },
      {
        via: 'Mod+A y borrar',
        accion: async (page) => {
          await page.keyboard.press(`${MOD}+a`);
          await page.keyboard.press('Delete');
        },
      },
    ];

    for (const { via, accion } of VIAS) {
      test(`H3-E7: por ${via} se pide confirmación y cancelar deja la imagen`, async ({ page }) => {
        const articulo = await sembrarConImagenGuardada(nombreDePrueba('doc-via'));
        await abrirArticulo(page, articulo.id);
        if (via.startsWith('Mod+A')) {
          await lienzo(page).getByText('Uno', { exact: true }).click();
        } else {
          await isla(page, 'Imagen, 2 de 3').click();
          if (via !== 'el menú «Quitar»') await page.keyboard.press('Escape');
        }

        await accion(page);

        const confirmacion = page.getByRole('alertdialog');
        await expect(confirmacion).toBeVisible();
        await confirmacion.getByRole('button', { name: 'Cancelar' }).click();
        await expect(isla(page, IMAGEN)).toBeVisible();
        expect(await textosDelLienzo(page)).toEqual(['Uno', 'Tres']);
      });
    }
  });

  test('CE-003: con solo el teclado se seleccionan los diez tipos y se reordenan cinco elementos', async ({ page }) => {
    const diez = await sembrarArticulo({
      titulo: nombreDePrueba('doc-ce003-diez'),
      contenido: diezElementos(imagenSemilla('articulos/e2e-inexistente.png')),
    });
    await abrirArticulo(page, diez.id);
    await lienzo(page).focus();
    await page.keyboard.press('Escape');
    for (let i = 0; i < 9; i++) await page.keyboard.press('Shift+ArrowDown');
    await expect(textoDeSeleccion(page)).toHaveText('10 elementos seleccionados');

    const cinco = await sembrarCinco(nombreDePrueba('doc-ce003-cinco'));
    await abrirArticulo(page, cinco.id);
    await lienzo(page).focus();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Escape'); // modo elementos sobre "Cinco"
    for (let i = 0; i < 4; i++) await page.keyboard.press('Alt+ArrowUp');
    expect(await textosDelLienzo(page)).toEqual(['Cinco', 'Uno', 'Dos', 'Tres', 'Cuatro']);

    await botonGuardar(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: /guardad/i })).toBeVisible();
    const textos = elementosDe(await articuloPorId(cinco.id)).map(textoDe);
    expect(textos).toEqual(['Cinco', 'Uno', 'Dos', 'Tres', 'Cuatro']);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// T056 (spec 005, H5 esc. 1 a 6, CE-002, RF-011, RF-018). FASE ROJA: «Que nada se pierda». Supuestos de interfaz, además
// de los de ./ayudas/editor.ts y ./ayudas/estado.ts:
//   - Abrir un artículo sin tocarlo no lo ensucia: no aparece "Cambios sin guardar" y «Guardar» queda con
//     `aria-disabled="true"` (spec 004), así que la versión no cambia. Para pasar el documento por la conversión de ida y
//     vuelta sin cambiar nada se escribe una letra al final y se borra; para poder guardar se cambia solo el extracto: el
//     contenido guardado tiene que ser idéntico al original.
//   - Los artículos del seed son los que no empiezan con `e2e-` (después de `pnpm db:reset`).
//   - `guardado` (Guardar, Publicar o Archivar desde la barra) no vuelve a crear el documento: el cursor sigue donde estaba
//     (al devolver el foco al lienzo, lo que se escribe entra ahí) y Deshacer sigue llegando a lo de antes de guardar.
//   - «Reemplazar con la vigente» (`adoptar_vigente`) sí lo vuelve a crear: muestra lo vigente y el historial queda
//     vacío («Deshacer» con `aria-disabled="true"`).
//   - Si la respuesta del servidor al guardar trae un contenido distinto del enviado (se simula cambiando la respuesta de
//     la acción), el editor lo adopta sin perder el cursor, no queda con "Cambios sin guardar" y lo avisa en la región de
//     estado con un texto que menciona al servidor o el ajuste (/servidor|ajust/i).
// ---------------------------------------------------------------------------------------------------------------------

const avisoSinGuardar = (page: Page) => barraDelEditor(page).getByText('Cambios sin guardar');
const primerParrafo = (page: Page) => lienzo(page).locator('p').first();

/** Los artículos del seed (supabase/seed.sql): todos los que no sembró un E2E. */
async function articulosDelSeed() {
  const { data, error } = await servicio()
    .from('articulos')
    .select('id, titulo, version, contenido')
    .not('titulo', 'like', 'e2e-%')
    .order('titulo');
  if (error) throw new Error(`No se pudieron leer los artículos del seed: ${error.message}`);
  return data;
}

/** Abierto y sin tocar: no hay nada que guardar y la base no cambió. */
async function comprobarAbiertoSinCambios(page: Page, articulo: { id: string; version: number; contenido: unknown }) {
  await abrirArticulo(page, articulo.id);
  // Margen para las transacciones del editor al montar (ids, normalización de marcas): no deben ensuciar.
  await page.waitForTimeout(600);
  await expect(avisoSinGuardar(page)).toHaveCount(0);
  await expect(botonGuardar(page)).toHaveAttribute('aria-disabled', 'true');
  const enBase = await articuloPorId(articulo.id);
  expect(enBase.version).toBe(articulo.version);
  expect(enBase.contenido).toEqual(articulo.contenido);
}

/** Pasa el documento por la conversión (una letra que se escribe y se borra) y guarda cambiando solo el extracto. */
async function guardarSinTocarElContenido(page: Page, id: string) {
  await irAlFinalDelDocumento(page);
  await page.keyboard.type('x');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
  await expect(avisoSinGuardar(page)).toHaveCount(0);
  await page.getByLabel('Extracto', { exact: true }).fill(`Extracto cambiado ${crypto.randomUUID().slice(0, 6)}`);
  await guardarYEsperar(page);
  return articuloPorId(id);
}

/** CE-002 sobre un contenido: abrir sin cambios y guardar con el contenido idéntico (mismo orden, ids y campos). */
async function comprobarIdaYVuelta(page: Page, etiqueta: string, contenido: Elemento[]) {
  const articulo = await sembrarArticulo({ titulo: nombreDePrueba(`doc-ce002-${etiqueta}`), contenido });
  await comprobarAbiertoSinCambios(page, articulo);
  const guardado = await guardarSinTocarElContenido(page, articulo.id);
  expect(guardado.contenido).toEqual(articulo.contenido);
}

const CON_CARACTERES_PROPIOS = () => [
  parrafo('Cuesta 2 * 3 pesos, el archivo mi_archivo_final.txt, la nota [1] y la tecla ` sola.'),
  parrafo('Dos asteriscos ** sueltos, un guion bajo _ suelto, [corchetes sin enlace] (aparte) y `` dobles.'),
  parrafo('Un _guion_bajo_ en medio, un *asterisco* simple y una [etiqueta]sin(url).'),
  titulo(3, 'Un título con *asterisco*, _guion_ y `comilla`'),
  lista(['Con * asterisco', 'Con [corchetes]', 'Con ` sola']),
  cita('Una cita con _guiones_bajos_ y ** sueltos', { autor: 'A_lguien' }),
  codigo('const a = b * c; // [x] `y` _z_ **w**', 'ts'),
];

test.describe('Nada se pierde', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.describe('abrir y guardar sin tocar (H5-E1, H5-E2, CE-002)', () => {
    test('H5-E1 / CE-002: cada artículo del seed se abre sin cambios: nada que guardar y la versión no cambia', async ({
      page,
    }) => {
      test.slow();
      const reales = await articulosDelSeed();
      expect(reales.length, 'el seed debería tener artículos (¿falta `pnpm db:reset`?)').toBeGreaterThan(0);
      for (const real of reales) {
        await test.step(real.titulo, () => comprobarAbiertoSinCambios(page, real));
      }
    });

    test('H5-E1 / CE-002: el contenido de cada artículo del seed se guarda idéntico tras pasar por el editor', async ({
      page,
    }) => {
      test.slow();
      for (const real of await articulosDelSeed()) {
        // Sobre una copia: guardar el original cambiaría su versión y el resto de las pruebas lo usa.
        await test.step(real.titulo, () => comprobarIdaYVuelta(page, 'seed', elementosDe(real)));
      }
    });

    test('H5-E1 / CE-002: un artículo con los diez tipos, varios párrafos y un salto de línea se guarda idéntico', async ({
      page,
    }) => {
      await comprobarIdaYVuelta(page, 'diez', [
        ...diezElementos(imagenSemilla('articulos/e2e-inexistente.png')),
        parrafo('Primer tramo'),
        parrafo('Segundo tramo tras dos líneas en blanco'),
        parrafo('Una línea', salto, 'y otra con salto simple'),
      ]);
    });

    test('H5-E2 / CE-002: asteriscos, guiones bajos, corchetes y comillas invertidas propios se conservan exactos', async ({
      page,
    }) => {
      await comprobarIdaYVuelta(page, 'literales', CON_CARACTERES_PROPIOS());
    });
  });

  test.describe('guardar no reinicia el documento; adoptar la vigente sí (RF-011)', () => {
    test('H5-E1 / RF-011: tras guardar, el servidor devuelve lo mismo y el documento no se toca (cursor e historial)', async ({
      page,
    }) => {
      const articulo = await sembrarArticulo({
        titulo: nombreDePrueba('doc-guardado-intacto'),
        contenido: [parrafo('Texto inicial')],
      });
      await abrirArticulo(page, articulo.id);
      await escribirEnElemento(page, primerParrafo(page), ' uno');
      await guardarYEsperar(page);
      expect(textoDe(elementosDe(await articuloPorId(articulo.id))[0])).toBe('Texto inicial uno');

      await lienzo(page).focus();
      // Más que el agrupamiento del historial (500 ms): lo escrito después de guardar es otro paso de Deshacer.
      await page.waitForTimeout(600);
      await page.keyboard.type(' dos');
      await expect(primerParrafo(page)).toHaveText('Texto inicial uno dos');

      await page.keyboard.press(`${MOD}+z`);
      await expect(primerParrafo(page)).toHaveText('Texto inicial uno');
      await page.keyboard.press(`${MOD}+z`);
      await expect(primerParrafo(page)).toHaveText('Texto inicial');
    });

    const CAMBIOS_DE_ESTADO = [
      { accion: 'Publicar', inicial: 'borrador', final: 'publicado' },
      { accion: 'Archivar', inicial: 'publicado', final: 'archivado' },
    ] as const;
    for (const { accion, inicial, final } of CAMBIOS_DE_ESTADO) {
      test(`H5-E1 / RF-011: «${accion}» desde la barra no reinicia el documento: se conservan el cursor y el historial`, async ({
        page,
      }) => {
        const articulo = await sembrarArticulo({
          titulo: nombreDePrueba(`doc-${accion.toLowerCase()}-intacto`),
          contenido: [parrafo('Texto inicial')],
        });
        if (inicial === 'publicado') await publicarComoServicio(articulo.id);
        await abrirArticulo(page, articulo.id);
        await escribirEnElemento(page, primerParrafo(page), ' añadido');
        await guardarYEsperar(page);
        // El cursor queda después de "Texto".
        await primerParrafo(page).click();
        await page.keyboard.press('Home');
        for (let i = 0; i < 'Texto'.length; i += 1) await page.keyboard.press('ArrowRight');

        await botonDeEstado(page, accion).click();
        await esperarEstado(page, final);

        await lienzo(page).focus();
        await page.waitForTimeout(100);
        await page.keyboard.type('X');
        await expect(primerParrafo(page)).toHaveText('TextoX inicial añadido');
        await page.keyboard.press(`${MOD}+z`);
        await expect(primerParrafo(page)).toHaveText('Texto inicial añadido');
        await page.keyboard.press(`${MOD}+z`);
        await expect(primerParrafo(page)).toHaveText('Texto inicial');
      });
    }

    test('H5-E4 / RF-011: «Reemplazar con la vigente» sí reinicia el documento: muestra lo vigente y vacía el historial', async ({
      page,
    }) => {
      const articulo = await sembrarArticulo({
        titulo: nombreDePrueba('doc-adoptar-vigente'),
        contenido: [parrafo('Texto original')],
      });
      await abrirArticulo(page, articulo.id);
      await escribirEnElemento(page, primerParrafo(page), ' propio');
      // Otra persona guarda antes (como servicio): cambia el contenido y sube la versión.
      const { error } = await servicio()
        .from('articulos')
        .update({ contenido: { type: 'doc', content: [parrafo('Texto vigente')] } as never, version: articulo.version })
        .eq('id', articulo.id);
      expect(error).toBeNull();

      await botonGuardar(page).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Alguien guardó cambios más nuevos' })).toBeVisible();
      await page.getByRole('button', { name: 'Reemplazar con la vigente' }).click();
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: /^Reemplazar/ })
        .click();

      await expect(primerParrafo(page)).toHaveText('Texto vigente');
      await expect(botonDeshacer(page)).toHaveAttribute('aria-disabled', 'true');
      await lienzo(page).focus();
      await page.keyboard.press(`${MOD}+z`);
      await expect(primerParrafo(page)).toHaveText('Texto vigente');
      await expect(lienzo(page)).not.toContainText('propio');
      await expect(avisoSinGuardar(page)).toHaveCount(0);
    });

    test('H5-E1: si el servidor devuelve otro contenido al guardar, el editor lo adopta, conserva el cursor y lo avisa', async ({
      page,
    }) => {
      const articulo = await sembrarArticulo({
        titulo: nombreDePrueba('doc-servidor-distinto'),
        contenido: [parrafo('Texto MARCA-ORIGINAL')],
      });
      await abrirArticulo(page, articulo.id);
      // Un servidor que "normaliza": la respuesta de la acción de guardar trae otro texto del mismo largo.
      await page.route(`**/articulos/${articulo.id}`, async (ruta) => {
        const pedido = ruta.request();
        if (pedido.method() !== 'POST' || !pedido.headers()['next-action']) return ruta.continue();
        const respuesta = await ruta.fetch();
        const cuerpo = (await respuesta.text()).replaceAll('MARCA-ORIGINAL', 'MARCA-SERVIDOR');
        await ruta.fulfill({ response: respuesta, body: cuerpo });
      });
      await escribirEnElemento(page, primerParrafo(page), ' fin');

      await guardarYEsperar(page);

      await expect(primerParrafo(page)).toHaveText('Texto MARCA-SERVIDOR fin');
      await expect(regionDeEstado(page).filter({ hasText: /servidor|ajust/i })).toHaveCount(1);
      await expect(avisoSinGuardar(page)).toHaveCount(0);
      // El cursor sigue al final del párrafo.
      await lienzo(page).focus();
      await page.waitForTimeout(100);
      await page.keyboard.type('!');
      await expect(primerParrafo(page)).toHaveText('Texto MARCA-SERVIDOR fin!');
    });
  });

  test.describe('el servidor valida el documento (RF-022)', () => {
    /**
     * Agrega una marca que la lista permitida no admite al texto que termina en `marca`, dentro del cuerpo JSON del
     * pedido de la acción (con o sin comillas escapadas, por si el documento viaja como texto).
     */
    const conMarcaInventada = (cuerpo: string, marca: string) =>
      cuerpo.includes(`${marca}\\"`)
        ? cuerpo.replace(`${marca}\\"`, `${marca}\\",\\"marks\\":[{\\"type\\":\\"marca-inventada\\"}]`)
        : cuerpo.replace(`${marca}"`, `${marca}","marks":[{"type":"marca-inventada"}]`);

    test('H5-E1 / RF-022: un documento inválido que llega al servidor se rechaza sin guardarse y lo escrito se conserva', async ({
      page,
    }) => {
      const articulo = await sembrarArticulo({
        titulo: nombreDePrueba('doc-servidor-rechaza'),
        contenido: [parrafo('Texto inicial')],
      });
      await abrirArticulo(page, articulo.id);
      // El navegador valida antes de enviar: el documento inválido se arma en el pedido de la acción de guardar, para
      // comprobar que el servidor valida por su cuenta (no confía en el cliente).
      let alterado = false;
      await page.route(`**/articulos/${articulo.id}`, async (ruta) => {
        const pedido = ruta.request();
        const cuerpo = pedido.postData() ?? '';
        if (pedido.method() !== 'POST' || !pedido.headers()['next-action'] || !cuerpo.includes('MARCA-INVALIDA')) {
          return ruta.continue();
        }
        const nuevo = conMarcaInventada(cuerpo, 'MARCA-INVALIDA');
        alterado = nuevo !== cuerpo;
        await ruta.continue({ postData: nuevo });
      });
      await escribirEnElemento(page, primerParrafo(page), ' MARCA-INVALIDA');

      await botonGuardar(page).click();

      await expect(regionDeEstado(page).filter({ hasText: /Hay 1 error/ })).toHaveCount(1);
      expect(alterado, 'el pedido de guardar tendría que llevar el documento como JSON').toBe(true);
      const enBase = await articuloPorId(articulo.id);
      expect(enBase.version).toBe(articulo.version);
      expect(enBase.contenido).toEqual(articulo.contenido);
      await expect(primerParrafo(page)).toHaveText('Texto inicial MARCA-INVALIDA');
      await expect(avisoSinGuardar(page)).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: /guardad/i })).toHaveCount(0);
    });
  });

  test.describe('a 360 px (H5-E5)', () => {
    test.use({ viewport: { width: 360, height: 800 } });

    test('H5-E5: la barra se reacomoda sin cortes con «Más», «Insertar» a la vista y controles de 44 × 44 px', async ({
      page,
    }) => {
      const articulo = await sembrarCinco(nombreDePrueba('doc-360'));
      await abrirArticulo(page, articulo.id);
      await lienzo(page).getByText('Dos', { exact: true }).click();
      const barra = barraDeFormato(page);
      const insertar = barra.getByRole('button', { name: 'Insertar', exact: true });
      const mas = barra.getByRole('button', { name: 'Más acciones', exact: true });

      await expect(insertar).toBeVisible();
      await expect(mas).toBeVisible();
      const cortes = await barra.evaluate((el) => {
        const caja = el.getBoundingClientRect();
        const fuera = [...el.querySelectorAll<HTMLElement>('button')]
          .filter((b) => b.getClientRects().length > 0 && getComputedStyle(b).visibility !== 'hidden')
          .filter((b) => {
            const r = b.getBoundingClientRect();
            return r.left < caja.left - 1 || r.right > caja.right + 1;
          })
          .map((b) => b.getAttribute('aria-label') ?? b.textContent);
        const pagina = document.documentElement;
        return { fuera, desborda: el.scrollWidth > el.clientWidth + 1 || pagina.scrollWidth > pagina.clientWidth };
      });
      expect(cortes).toEqual({ fuera: [], desborda: false });
      const botones = barra.getByRole('button');
      for (let i = 0; i < (await botones.count()); i += 1) {
        const medida = await areaTactil(botones.nth(i));
        expect(medida.ok, `${await botones.nth(i).getAttribute('aria-label')}: ${medida.ancho} × ${medida.alto}`).toBe(
          true,
        );
      }

      // «Insertar» es alcanzable sin escribir «/» y lo que no entra está en «Más».
      await abrirMenuInsertar(page);
      await expect(opcionDeInsercion(page, 'Imagen')).toBeVisible();
      await page.keyboard.press('Escape');
      await mas.click();
      await expect(barra.getByRole('button', { name: 'Deshacer', exact: true })).toBeVisible();
    });
  });

  test('H5-E6: la barra se anuncia como barra de herramientas con su estado y el lienzo como área de edición', async ({
    page,
  }) => {
    const articulo = await sembrarCinco(nombreDePrueba('doc-lector'));
    await abrirArticulo(page, articulo.id);

    await expect(barraDeFormato(page)).toBeVisible();
    await expect(lienzo(page)).toHaveAttribute('contenteditable', 'true');
    await expect(lienzo(page)).toHaveAttribute('aria-multiline', 'true');
    const negrita = barraDeFormato(page).getByRole('button', { name: 'Negrita', exact: true });
    await lienzo(page).getByText('Dos', { exact: true }).click();
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+Home');
    await expect(negrita).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press(`${MOD}+b`);
    await expect(negrita).toHaveAttribute('aria-pressed', 'true');

    await guardarYEsperar(page);
    await expect(page.getByRole('status').filter({ hasText: /guardad/i })).toBeVisible();
  });

  test.describe('RF-018: la columna lateral, la barra de acciones y los permisos no cambian', () => {
    for (const rol of ['editor', 'admin'] as const) {
      test(`RF-018: con la pestaña «Elemento» activa, «Publicación» y la barra siguen a la vista y el ${rol} conserva sus permisos`, async ({
        page,
      }) => {
        const articulo = await sembrarConImagenGuardada(nombreDePrueba(`doc-rf018-${rol}`));
        await publicarComoServicio(articulo.id);
        await pasarAComoServicio(articulo.id, 'archivado');
        if (rol === 'admin') {
          await page.context().clearCookies();
          await ingresar(page, USUARIOS.admin);
        }
        await abrirArticulo(page, articulo.id);

        await isla(page, 'Imagen, 2 de 3').click();
        await expect(pestana(page, 'Elemento')).toHaveAttribute('aria-selected', 'true');
        await expect(panelDePropiedades(page)).toBeVisible();
        await expect(panelPublicacion(page)).toBeVisible();
        await expect(panelPublicacion(page)).toContainText(/Estado:\s*archivado/i);
        await expect(barraDelEditor(page)).toBeVisible();
        await expect(barraDelEditor(page).getByRole('button', { name: 'Guardar', exact: true })).toBeVisible();
        await expect(botonDeEstado(page, 'Volver a borrador')).toBeVisible();
        await expect(botonDeEstado(page, 'Eliminar')).toHaveCount(rol === 'admin' ? 1 : 0);
      });
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// T127 (spec 005, Fase 12, H6 esc. 1 a 5; RF-003, RF-009, RF-016, RF-020, RF-024 y RF-026; contracts/atajos.md;
// research D28 y D31 U9, U10, U11 y U16). FASE ROJA: el editor no tiene subrayado, tachado, resaltado, superíndice,
// subíndice ni alineación; «Código» todavía está en la barra.
// Supuestos de interfaz: ver "Ayudas de más formato y alineación" en ./ayudas/editor.ts. Además:
//   - El orden de «Más formato» es el de D28: Tachado, Resaltado, Código, Superíndice y Subíndice; el de «Alineación»:
//     Izquierda, Centro, Derecha y Justificado. Los dos menús se abren con Enter y ponen el foco en su primera opción;
//     Enter sobre una opción la aplica, cierra el menú y devuelve el foco al lienzo; Esc lo cierra y devuelve el foco
//     al botón.
//   - En el panel de propiedades de un párrafo o un título, la alineación es un grupo «Alineación» con cuatro opciones
//     de radio (las mismas etiquetas).
//   - La razón de un control no disponible se ve al enfocarlo como aviso (`role="tooltip"`, además del
//     `aria-describedby`) y `Esc` lo oculta sin mover el foco (WCAG 1.4.13).
// ---------------------------------------------------------------------------------------------------------------------

const RAZON_CODIGO = 'El código no admite otros formatos';
const RAZON_ALINEACION = 'La alineación es solo para párrafos y títulos';
/** Opción de «Más formato», etiqueta HTML en el lienzo y nombre en minúsculas para "Más formato, … activo". */
const MAS_FORMATO = [
  ['Tachado', 's', 'tachado'],
  ['Resaltado', 'mark', 'resaltado'],
  ['Código', 'code', 'código'],
  ['Superíndice', 'sup', 'superíndice'],
  ['Subíndice', 'sub', 'subíndice'],
] as const;
const ALINEACIONES = [
  ['Izquierda', 'izquierda', 'start'],
  ['Centro', 'centro', 'center'],
  ['Derecha', 'derecha', 'right'],
  ['Justificado', 'justificado', 'justify'],
] as const;

const alineacionDe = (localizador: Locator) => localizador.evaluate((el) => getComputedStyle(el).textAlign);
const parrafoDelLienzo = (page: Page, texto: string) => lienzo(page).locator('p').filter({ hasText: texto }).first();
/** El texto visible de una razón (aviso) en la pantalla. */
const razonVisible = (page: Page, razon: string) => page.getByRole('tooltip').filter({ hasText: razon });

/** Selecciona con el teclado `largo` caracteres desde la posición `desde` del párrafo del lienzo que contiene `texto`. */
async function seleccionarEnElParrafo(page: Page, texto: string, desde: number, largo: number) {
  await parrafoDelLienzo(page, texto).click();
  await page.waitForTimeout(100); // ProseMirror ignora la selección del navegador unos 50 ms después de escribir.
  await page.keyboard.press('Home');
  for (let i = 0; i < desde; i++) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < largo; i++) await page.keyboard.press('Shift+ArrowRight');
}

/** Estilos que hacen ver un formato: comparar el lienzo con la vista previa (que usa el renderer del sitio). */
const estilosDeFormato = (localizador: Locator) =>
  localizador.evaluate((el) => {
    const e = getComputedStyle(el);
    return {
      etiqueta: el.tagName.toLowerCase(),
      linea: e.textDecorationLine,
      colorDeLinea: e.textDecorationColor,
      grosor: e.textDecorationThickness,
      separacion: e.textUnderlineOffset,
      fondo: e.backgroundColor,
      color: e.color,
      vertical: e.verticalAlign,
      tamanio: e.fontSize,
      alineacion: e.textAlign,
      guiones: e.hyphens,
    };
  });

test.describe('Más formato y alineación (H6)', () => {
  test('H6-E1: «Subrayado» de la barra subraya el texto seleccionado, se marca activo y se quita', async ({ page }) => {
    await abrirNuevo(page);
    await escribirYSeleccionar(page, 'subrayado');

    await botonDeBarra(page, 'Subrayado').click();
    await expect(lienzo(page).locator('u')).toHaveText('subrayado');
    await expect(botonDeBarra(page, 'Subrayado')).toHaveAttribute('aria-pressed', 'true');

    await botonDeBarra(page, 'Subrayado').click();
    await expect(lienzo(page).locator('u')).toHaveCount(0);
    await expect(botonDeBarra(page, 'Subrayado')).toHaveAttribute('aria-pressed', 'false');
  });

  test('H6-E1: Mod+U subraya y el mismo atajo lo quita', async ({ page }) => {
    await abrirNuevo(page);
    await escribirYSeleccionar(page, 'palabra');

    await page.keyboard.press(`${MOD}+u`);
    await expect(lienzo(page).locator('u')).toHaveText('palabra');
    await page.keyboard.press(`${MOD}+u`);
    await expect(lienzo(page).locator('u')).toHaveCount(0);
  });

  for (const [opcion, etiqueta, nombre] of MAS_FORMATO) {
    test(`H6-E1: «Más formato» → «${opcion}» aplica <${etiqueta}>, lo marca activo y repetirlo lo quita`, async ({
      page,
    }) => {
      await abrirNuevo(page);
      await escribirYSeleccionar(page, 'formato');

      await elegirMasFormato(page, opcion);
      await expect(lienzo(page).locator(etiqueta)).toHaveText('formato');
      await expect(botonMasFormato(page)).toHaveAccessibleName(`Más formato, ${nombre} activo`);
      await abrirMasFormato(page);
      await expect(opcionDeFormato(page, opcion)).toHaveAttribute('aria-checked', 'true');

      await opcionDeFormato(page, opcion).click();
      await expect(lienzo(page).locator(etiqueta)).toHaveCount(0);
      await expect(botonMasFormato(page)).toHaveAccessibleName('Más formato');
    });
  }

  test('H6-E1: «Más formato» con el teclado: cinco opciones en orden, flechas, Enter aplica y Esc cierra', async ({
    page,
  }) => {
    await abrirNuevo(page);
    await escribirYSeleccionar(page, 'teclado');

    await botonMasFormato(page).focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitemcheckbox')).toHaveText(MAS_FORMATO.map(([opcion]) => opcion));
    await expect(opcionDeFormato(page, 'Tachado')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(opcionDeFormato(page, 'Resaltado')).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(menu).toHaveCount(0);
    await expect(lienzo(page).locator('mark')).toHaveText('teclado');
    expect(await lienzoTieneElFoco(page)).toBe(true);

    await botonMasFormato(page).focus();
    await page.keyboard.press('Enter');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(botonMasFormato(page)).toBeFocused();
  });

  test('H6-E1 / D31 U11: Ctrl+. es superíndice y Ctrl+, subíndice (fuera de macOS)', async ({ page }) => {
    test.skip(process.platform === 'darwin', 'En macOS el superíndice y el subíndice no tienen atajo');
    await abrirNuevo(page);
    await escribirEnLienzo(page, 'm2');
    await page.waitForTimeout(100);
    await page.keyboard.press('Shift+ArrowLeft');

    await page.keyboard.press('Control+Period');
    await expect(lienzo(page).locator('sup')).toHaveText('2');
    await page.keyboard.press('Control+Comma');
    await expect(lienzo(page).locator('sub')).toHaveText('2');
    await expect(lienzo(page).locator('sup')).toHaveCount(0);
    await page.keyboard.press('Control+Comma');
    await expect(lienzo(page).locator('sub')).toHaveCount(0);
    await expect(lienzo(page).locator('p').first()).toHaveText('m2');
  });

  test('H6-E2: aplicar subíndice a un superíndice lo reemplaza (no se combinan)', async ({ page }) => {
    await abrirNuevo(page);
    await escribirYSeleccionar(page, 'x');

    await elegirMasFormato(page, 'Superíndice');
    await expect(lienzo(page).locator('sup')).toHaveText('x');
    await elegirMasFormato(page, 'Subíndice');

    await expect(lienzo(page).locator('sub')).toHaveText('x');
    await expect(lienzo(page).locator('sup')).toHaveCount(0);
    await abrirMasFormato(page);
    await expect(opcionDeFormato(page, 'Superíndice')).toHaveAttribute('aria-checked', 'false');
    await expect(opcionDeFormato(page, 'Subíndice')).toHaveAttribute('aria-checked', 'true');
  });

  test('H6-E3: con código activo, los demás formatos y «Enlace» no están disponibles y lo explican; «Código» sí', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({
      titulo: nombreDePrueba('doc-h6-codigo'),
      contenido: [parrafo('Usa ', texto('npm install', MARCAS.codigo), ' y listo.')],
    });
    await abrirArticulo(page, articulo.id);
    await lienzo(page).locator('code').click();

    for (const nombre of ['Negrita', 'Cursiva', 'Subrayado', 'Enlace']) {
      await expect(botonDeBarra(page, nombre), nombre).toHaveAttribute('aria-disabled', 'true');
      expect(await razonDe(botonDeBarra(page, nombre)), nombre).toContain(RAZON_CODIGO);
    }
    await botonDeBarra(page, 'Negrita').click({ force: true }); // aria-disabled: Playwright no lo considera habilitado
    await expect(lienzo(page).locator('strong')).toHaveCount(0);
    await expect(page.getByLabel('URL del enlace')).toHaveCount(0);

    await expect(botonMasFormato(page)).not.toHaveAttribute('aria-disabled', 'true');
    await abrirMasFormato(page);
    for (const [opcion] of MAS_FORMATO.filter(([opcion]) => opcion !== 'Código')) {
      await expect(opcionDeFormato(page, opcion), opcion).toHaveAttribute('aria-disabled', 'true');
    }
    await expect(opcionDeFormato(page, 'Código')).not.toHaveAttribute('aria-disabled', 'true');
    await expect(opcionDeFormato(page, 'Código')).toHaveAttribute('aria-checked', 'true');
  });

  test('H6-E3 / WCAG 1.4.13: la razón se ve al enfocar el control no disponible y Esc la cierra sin mover el foco', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({
      titulo: nombreDePrueba('doc-h6-razon'),
      contenido: [parrafo('Usa ', texto('npm install', MARCAS.codigo), '.')],
    });
    await abrirArticulo(page, articulo.id);
    await lienzo(page).locator('code').click();
    // El lienzo ya leyó el cursor en el código (si el foco sale antes, ProseMirror no lo lee).
    await expect(botonDeBarra(page, 'Negrita')).toHaveAttribute('aria-disabled', 'true');
    await expect(razonVisible(page, RAZON_CODIGO)).toBeHidden();

    await botonDeBarra(page, 'Negrita').focus();
    await expect(razonVisible(page, RAZON_CODIGO).first()).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(razonVisible(page, RAZON_CODIGO)).toBeHidden();
    await expect(botonDeBarra(page, 'Negrita')).toBeFocused();
  });

  test('H6-E3: negrita, subrayado y enlace se combinan y se guardan en el orden canónico', async ({ page }) => {
    const nombre = nombreDePrueba('doc-h6-combinado');
    await abrirNuevo(page);
    await page.getByLabel('Título', { exact: true }).fill(nombre);
    await escribirYSeleccionar(page, 'combinado');

    await botonDeBarra(page, 'Subrayado').click();
    await botonDeBarra(page, 'Negrita').click();
    await botonDeBarra(page, 'Enlace').click();
    await page.getByLabel('URL del enlace').fill('/blog');
    await page.keyboard.press('Enter');
    // Un enlace subrayado se ve solo como enlace (RF-026), también en el lienzo.
    await expect(lienzo(page).locator('a strong')).toHaveText('combinado');
    await guardarYEsperar(page);

    expect(elementosDe(await articuloPorTitulo(nombre))[0]?.content).toEqual([
      {
        type: 'text',
        text: 'combinado',
        marks: [{ type: 'link', attrs: { href: '/blog' } }, { type: 'bold' }, { type: 'underline' }],
      },
    ]);
  });

  test('H6-E4: «Alineación» alinea el párrafo del cursor, dice la vigente y marca la opción', async ({ page }) => {
    await abrirNuevo(page);
    await escribirEnLienzo(page, 'Un párrafo para alinear');

    for (const [opcion, vigente, css] of [...ALINEACIONES.slice(1), ALINEACIONES[0]]) {
      await elegirAlineacion(page, opcion);
      await expect(botonAlineacion(page), opcion).toHaveAccessibleName(`Alineación: ${vigente}`);
      expect(await alineacionDe(parrafoDelLienzo(page, 'Un párrafo')), opcion).toBe(css);
    }

    await elegirAlineacion(page, 'Centro');
    await botonAlineacion(page).click();
    await expect(opcionDeAlineacion(page, 'Centro')).toHaveAttribute('aria-checked', 'true');
    await expect(opcionDeAlineacion(page, 'Izquierda')).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
  });

  test('H6-E4 / D31 U16: un título se puede centrar y justificar (con división de palabras)', async ({ page }) => {
    await abrirNuevo(page);
    await escribirEnLienzo(page, 'Un título alineado');
    await elegirEstilo(page, 'Título 2');

    await elegirAlineacion(page, 'Centro');
    expect(await alineacionDe(lienzo(page).locator('h2'))).toBe('center');
    await elegirAlineacion(page, 'Justificado');
    expect(await alineacionDe(lienzo(page).locator('h2'))).toBe('justify');
    expect(
      await lienzo(page)
        .locator('h2')
        .evaluate((el) => getComputedStyle(el).hyphens),
    ).toBe('auto');
  });

  test('H6-E4: «Alineación» con el teclado: cuatro opciones en orden y Enter aplica', async ({ page }) => {
    await abrirNuevo(page);
    await escribirEnLienzo(page, 'Con el teclado');

    await botonAlineacion(page).focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitemradio')).toHaveText(ALINEACIONES.map(([opcion]) => opcion));
    await expect(opcionDeAlineacion(page, 'Izquierda')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(opcionDeAlineacion(page, 'Derecha')).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(menu).toHaveCount(0);
    expect(await alineacionDe(parrafoDelLienzo(page, 'Con el teclado'))).toBe('right');
    expect(await lienzoTieneElFoco(page)).toBe(true);
  });

  test('H6-E4: en citas, listas, código y elementos especiales «Alineación» se ve pero no está disponible y lo explica', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({
      titulo: nombreDePrueba('doc-h6-sin-alineacion'),
      contenido: [
        cita('Una cita'),
        lista(['Un ítem']),
        codigo('const a = 1;'),
        cta({ titulo: 'Llamada', etiquetaBoton: 'Ir', url: '/contacto' }),
        parrafo('Un párrafo'),
      ],
    });
    await abrirArticulo(page, articulo.id);
    const lugares = [
      () => lienzo(page).getByText('Una cita', { exact: true }).click(),
      () => lienzo(page).getByText('Un ítem', { exact: true }).click(),
      () => lienzo(page).getByText('const a = 1;', { exact: true }).click(),
      () => isla(page, /^Llamada a la acción, \d+ de \d+$/).click(),
    ];

    for (const [i, ir] of lugares.entries()) {
      await ir();
      await expect(botonAlineacion(page), `lugar ${i}`).toBeVisible();
      await expect(botonAlineacion(page), `lugar ${i}`).toHaveAttribute('aria-disabled', 'true');
      expect(await razonDe(botonAlineacion(page)), `lugar ${i}`).toContain(RAZON_ALINEACION);
      await botonAlineacion(page).click({ force: true });
      await expect(page.getByRole('menuitemradio'), `lugar ${i}`).toHaveCount(0);
    }

    await botonAlineacion(page).focus();
    await expect(razonVisible(page, RAZON_ALINEACION).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(razonVisible(page, RAZON_ALINEACION)).toBeHidden();

    await lienzo(page).getByText('Un párrafo', { exact: true }).click();
    await expect(botonAlineacion(page)).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('RF-020: el panel de un párrafo ofrece la alineación y la aplica; el de una cita no', async ({ page }) => {
    const articulo = await sembrarArticulo({
      titulo: nombreDePrueba('doc-h6-panel'),
      contenido: [parrafo('Un párrafo del panel'), cita('Una cita del panel')],
    });
    await abrirArticulo(page, articulo.id);

    await entrarAlModo(page, 'Un párrafo del panel');
    await pestana(page, 'Elemento').click();
    const grupo = panelDePropiedades(page)
      .getByRole('group', { name: 'Alineación' })
      .or(panelDePropiedades(page).getByRole('radiogroup', { name: 'Alineación' }));
    await expect(grupo).toBeVisible();
    await expect(grupo.getByRole('radio')).toHaveCount(4);
    await expect(grupo.getByRole('radio', { name: 'Izquierda', exact: true })).toBeChecked();
    await grupo.getByRole('radio', { name: 'Derecha', exact: true }).check();
    expect(await alineacionDe(parrafoDelLienzo(page, 'Un párrafo del panel'))).toBe('right');

    await entrarAlModo(page, 'Una cita del panel');
    await pestana(page, 'Elemento').click();
    await expect(panelDePropiedades(page)).toBeVisible();
    await expect(panelDePropiedades(page).getByText('Alineación')).toHaveCount(0);
  });

  test('RF-016: convertir un párrafo centrado en cita avisa que se pierde la alineación', async ({ page }) => {
    const articulo = await sembrarArticulo({
      titulo: nombreDePrueba('doc-h6-convertir'),
      contenido: [alineado(parrafo('Centrado'), 'center')],
    });
    await abrirArticulo(page, articulo.id);
    await lienzo(page).getByText('Centrado', { exact: true }).click();

    await elegirAccion(page, 'Convertir en…');
    await menuItem(page, 'Cita').click();
    const aviso = page.getByRole('alertdialog');
    await expect(aviso).toContainText(/alineación/i);
    await aviso.getByRole('button', { name: 'Cancelar' }).click();
    expect(await alineacionDe(parrafoDelLienzo(page, 'Centrado'))).toBe('center');
  });

  test('H6-PI: subrayar, tachar, resaltar, «m2», centrar un título y justificar un párrafo; se guarda así', async ({
    page,
  }) => {
    const nombre = nombreDePrueba('doc-h6-prueba');
    await abrirNuevo(page);
    await page.getByLabel('Título', { exact: true }).fill(nombre);

    await escribirEnLienzo(page, 'Un título');
    await elegirEstilo(page, 'Título 2');
    await elegirAlineacion(page, 'Centro');
    await lienzo(page).locator('h2').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await escribirEnLienzo(page, 'uno dos tres m2');
    await elegirAlineacion(page, 'Justificado');
    // Las posiciones son del párrafo «uno dos tres m2».
    const PARRAFO_PI = 'uno dos tres m2';
    await seleccionarEnElParrafo(page, PARRAFO_PI, 0, 3);
    await botonDeBarra(page, 'Subrayado').click();
    await seleccionarEnElParrafo(page, PARRAFO_PI, 4, 3);
    await elegirMasFormato(page, 'Tachado');
    await seleccionarEnElParrafo(page, PARRAFO_PI, 8, 4);
    await elegirMasFormato(page, 'Resaltado');
    await seleccionarEnElParrafo(page, PARRAFO_PI, 14, 1);
    await elegirMasFormato(page, 'Superíndice');
    await guardarYEsperar(page);

    const [encabezado, cuerpo] = elementosDe(await articuloPorTitulo(nombre));
    expect(encabezado).toMatchObject({ type: 'heading', attrs: { level: 2, textAlign: 'center' } });
    expect(textoDe(encabezado)).toBe('Un título');
    expect(cuerpo?.attrs).toMatchObject({ textAlign: 'justify' });
    expect(cuerpo?.content).toEqual([
      { type: 'text', text: 'uno', marks: [{ type: 'underline' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'dos', marks: [{ type: 'strike' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'tres', marks: [{ type: 'highlight' }] },
      { type: 'text', text: ' m' },
      { type: 'text', text: '2', marks: [{ type: 'superscript' }] },
    ]);
  });

  test('H6-E5: la vista previa muestra los formatos y las alineaciones igual que el lienzo', async ({ page }) => {
    const articulo = await sembrarArticulo({
      titulo: nombreDePrueba('doc-h6-vista'),
      contenido: [
        { ...alineado(titulo(2, 'Título centrado'), 'center') },
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
            'O ',
            texto('enlace', MARCAS.enlace('/blog')),
          ),
          'justify',
        ),
        alineado(parrafo('A la derecha'), 'right'),
      ],
    });
    const casos = [
      ['u', 'subrayado'],
      ['s', 'tachado'],
      ['mark', 'resaltado'],
      ['sup', '2'],
      ['sub', '2'],
      ['a', 'enlace'],
      ['h2', 'Título centrado'],
      ['p', 'subrayado'],
      ['p', 'A la derecha'],
    ] as const;
    const estilos = async (contenedor: Locator) => {
      const salida = [];
      for (const [etiqueta, buscado] of casos) {
        salida.push(await estilosDeFormato(contenedor.locator(etiqueta).filter({ hasText: buscado }).first()));
      }
      return salida;
    };

    await page.goto(`/articulos/${articulo.id}/vista-previa`);
    const enLaVistaPrevia = await estilos(page.getByRole('main'));
    await abrirArticulo(page, articulo.id);
    const enElLienzo = await estilos(lienzo(page));

    expect(enElLienzo).toEqual(enLaVistaPrevia);
    // El subrayado usa el color del texto; el enlace, el de marca (RF-026, D31 U9): no se confunden.
    const [subrayado, , resaltado, superindice, subindice, enlace, encabezado, justificado, derecha] = enLaVistaPrevia;
    expect(subrayado?.linea).toContain('underline');
    expect(subrayado?.colorDeLinea).toBe(subrayado?.color);
    expect(enlace?.colorDeLinea).not.toBe(enlace?.color);
    expect(resaltado?.fondo).not.toBe('rgba(0, 0, 0, 0)');
    expect(parseFloat(superindice?.tamanio ?? '0')).toBeLessThan(parseFloat(justificado?.tamanio ?? '0'));
    expect(parseFloat(subindice?.tamanio ?? '0')).toBeLessThan(parseFloat(justificado?.tamanio ?? '0'));
    expect(encabezado?.alineacion).toBe('center');
    expect(justificado?.alineacion).toBe('justify');
    expect(justificado?.guiones).toBe('auto');
    expect(derecha?.alineacion).toBe('right');
  });
});
