// Ayudas de los E2E del editor de artículos (spec 003, H2; adaptadas al editor de documento en la spec 005, T057).
//
// CONTRATO DE INTERFAZ SUPUESTO. Todo lo que los specs asumen de la pantalla vive aquí o en los comentarios de cada
// spec, así que si la interfaz real difiere, se ajusta en un solo lugar.
//   - /articulos/nuevo y /articulos/[id]: un único `h1`. Campos con etiqueta: "Título", "Slug", "Extracto",
//     "Categoría", "Título SEO", "Descripción SEO"; grupo "Imagen destacada" (role=group) con el selector de imagen.
//   - Botón "Guardar" (nombre exacto). Tras guardar, un `role="status"` con el texto "Guardado" ("Cambios guardados"...).
//     Al crear un artículo nuevo, la dirección pasa a /articulos/<uuid>.
//   - El cuerpo es el lienzo del editor de documento (spec 005; ver los encabezados de más abajo). Ya no hay «Agregar
//     bloque» ni un grupo por bloque:
//       * `agregarBloque` pone el cursor al final del documento y elige el elemento en «Insertar» de la barra (o con «/»
//         en una línea vacía). En una línea vacía la reemplaza; si no, lo pone después del elemento actual.
//       * `grupoDeBloque` ubica el elemento N (desde 1) en el lienzo: los especiales (imagen, galería, llamada a la acción,
//         video) por su nombre accesible "<Tipo>, N de T"; los de texto por su etiqueta HTML en la posición N (`p`,
//         `h2`–`h4`, `blockquote`, `ul`/`ol`, `pre`, `hr`).
//       * `completarBloque` escribe el texto en el lienzo (las marcas con Mod+B y Mod+I) y el resto de los campos en el
//         panel de propiedades (pestaña «Elemento» desde 1280 px u hoja por debajo, que se abre con «Propiedades»).
//       * `elegirImagen` y `subirImagenConAlt` con un elemento del lienzo como ámbito suben desde el panel de propiedades.
//   - Etiquetas de los campos del panel (las de los editores de campos de hoy, con `exact: true` salvo las marcadas):
//       imagen selector + "Texto alternativo", casilla "Imagen decorativa" y "Leyenda" · cita "Autor", "Fuente" (/^Fuente/)
//       · galeria botón "Agregar imagen" (cada imagen con su "Texto alternativo") y "Columnas" (select 2/3/4) · cta
//       "Título", "Texto", "Texto del botón", "URL" · codigo "Lenguaje" · video "Proveedor" (select youtube/vimeo),
//       "ID del video", "Título del video".
//   - Selector de imagen: botón (o `input[type=file]`) "Elegir imagen" (en la galería, "Agregar imagen"); abre el
//     selector de archivos del sistema; al subir, el foco va a "Texto alternativo"; botón "Quitar imagen";
//     errores en `role="alert"`.
import { expect, type Locator, type Page } from '@playwright/test';
import { avifMinimo, jpegMinimo, pngDecodificable, webpMinimo } from '../../../packages/db/src/pruebas/imagenes';

const NOMBRE_DE_TIPO = {
  parrafo: 'párrafo',
  titulo: 'título',
  imagen: 'imagen',
  cita: 'cita',
  lista: 'lista',
  galeria: 'galería',
  cta: 'llamada a la acción',
  separador: 'separador',
  codigo: 'código',
  video: 'video',
} as const;

export type TipoDeBloque = keyof typeof NOMBRE_DE_TIPO;
export const TIPOS: TipoDeBloque[] = Object.keys(NOMBRE_DE_TIPO) as TipoDeBloque[];

/** La opción de «Insertar» que crea cada tipo (la lista de `diezElementos` es numerada y el título, de nivel 2). */
const OPCION_DE_INSERCION: Record<TipoDeBloque, string> = {
  parrafo: 'Párrafo',
  titulo: 'Título 2',
  imagen: 'Imagen',
  cita: 'Cita',
  lista: 'Lista numerada',
  galeria: 'Galería',
  cta: 'Llamada a la acción',
  separador: 'Separador',
  codigo: 'Código',
  video: 'Video',
};

/** Lo que se escribe después de «/» para que la opción de cada tipo quede primera en el menú. */
const FILTRO_DE_BARRA: Record<TipoDeBloque, string> = {
  parrafo: 'parrafo',
  titulo: 'titulo',
  imagen: 'imagen',
  cita: 'cita',
  lista: 'numerada',
  galeria: 'galeria',
  cta: 'llamada',
  separador: 'separador',
  codigo: 'codigo',
  video: 'video',
};

/** Etiqueta HTML de los elementos de texto en el lienzo. */
const ETIQUETA_DE_TEXTO: Partial<Record<TipoDeBloque, string>> = {
  parrafo: 'p',
  titulo: ':is(h2, h3, h4)',
  cita: 'blockquote',
  lista: ':is(ul, ol)',
  codigo: 'pre',
  separador: 'hr',
};

export type ArchivoDePrueba = { name: string; mimeType: string; buffer: Buffer };

const MOD = 'ControlOrMeta';

const archivoPng = (name = 'foto.png', ancho = 4, alto = 3): ArchivoDePrueba => ({
  name,
  mimeType: 'image/png',
  buffer: Buffer.from(pngDecodificable(ancho, alto)),
});

/** Espera a que React haya hidratado el editor: antes, un campo rellenado puede perder su selección. */
export const esperarEditorListo = async (page: Page) => {
  await expect(page.locator('[data-editor="listo"]')).toBeVisible();
  // El lienzo se carga bajo demanda: hasta entonces solo hay un esqueleto.
  await expect(page.getByLabel('Contenido del artículo', { exact: true })).toBeVisible();
};

export const botonGuardar = (page: Page) => page.getByRole('button', { name: 'Guardar', exact: true });

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** El elemento N (desde 1) del lienzo, del tipo indicado. */
export const grupoDeBloque = (page: Page, posicion: number, tipo: TipoDeBloque): Locator => {
  const etiqueta = ETIQUETA_DE_TEXTO[tipo];
  if (etiqueta) return lienzo(page).locator(`:scope > ${etiqueta}:nth-child(${posicion})`);
  return isla(page, new RegExp(`^${conMayuscula(NOMBRE_DE_TIPO[tipo])}, ${posicion} de \\d+$`));
};

/** Guarda y espera el aviso de éxito (`role="status"`). */
export async function guardarYEsperar(page: Page) {
  await botonGuardar(page).click();
  await expect(page.getByRole('status').filter({ hasText: /guardad/i })).toBeVisible();
}

/**
 * Pone el cursor al final del documento. Con un clic en el último elemento (siempre es de texto: tras un elemento
 * especial queda un párrafo final) y Mod+Fin: con una isla seleccionada, Mod+Fin solo no mueve la selección y lo que
 * se escribiera la reemplazaría.
 */
export async function irAlFinalDelDocumento(page: Page) {
  await elementosDelLienzo(page).last().click();
  await page.keyboard.press(`${MOD}+End`);
  await page.waitForTimeout(50);
}

/**
 * Agrega un elemento al final del documento desde «Insertar» (o con «/» si `via` es 'barra-diagonal') y devuelve su
 * ubicación en el lienzo. `posicion` es el lugar (desde 1) que va a ocupar.
 */
export async function agregarBloque(
  page: Page,
  tipo: TipoDeBloque,
  posicion: number,
  via: 'insertar' | 'barra-diagonal' = 'insertar',
): Promise<Locator> {
  await irAlFinalDelDocumento(page);
  if (via === 'insertar') {
    await insertarDesdeBarra(page, OPCION_DE_INSERCION[tipo]);
  } else {
    const vacia = await page.evaluate(() => {
      const nodo = window.getSelection()?.anchorNode;
      const elemento = nodo instanceof Element ? nodo : nodo?.parentElement;
      return (elemento?.closest('[contenteditable] > *')?.textContent ?? '') === '';
    });
    if (!vacia) await page.keyboard.press('Enter');
    await page.keyboard.type(`/${FILTRO_DE_BARRA[tipo]}`);
    // La opción buscada queda primera (las que coinciden por nombre van antes) y Enter la inserta.
    await expect(page.getByRole('listbox').getByRole('option').first()).toHaveAccessibleName(
      new RegExp(`^${OPCION_DE_INSERCION[tipo]}`),
    );
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  }
  const grupo = grupoDeBloque(page, posicion, tipo);
  await expect(grupo).toBeVisible();
  return grupo;
}

/** Pone el cursor al final del elemento (con un clic y Fin) y escribe. */
export async function escribirEnElemento(page: Page, grupo: Locator, texto: string) {
  await grupo.click();
  await page.keyboard.press('End');
  await page.keyboard.type(texto);
}

/** Reemplaza el texto de un elemento de una sola línea (párrafo, título…) por `texto`. */
export async function reemplazarTextoDe(page: Page, grupo: Locator, texto: string) {
  await grupo.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.type(texto);
}

const estaVisible = (localizador: Locator, timeout = 1_500) =>
  localizador.waitFor({ state: 'visible', timeout }).then(
    () => true,
    () => false,
  );

/**
 * Los campos de un elemento del lienzo viven en el panel de propiedades: si no está a la vista, se selecciona el
 * elemento y se abre con «Propiedades». Cualquier otro ámbito (la imagen destacada, el perfil) se devuelve tal cual.
 */
export async function camposDe(page: Page, ambito: Locator): Promise<Locator> {
  const enElLienzo = await ambito.evaluate((el) => el.closest('[aria-label="Contenido del artículo"]') !== null);
  if (!enElLienzo) return ambito;
  const panel = panelDePropiedades(page);
  if (await estaVisible(panel, 800)) return panel;
  if (!(await estaVisible(botonPropiedades(page), 300))) await ambito.click();
  if (await estaVisible(panel, 800)) return panel;
  await botonPropiedades(page).click();
  await expect(panel).toBeVisible();
  return panel;
}

/** Abre el selector de archivos desde el botón "Elegir imagen" (o "Agregar imagen") del ámbito y entrega el archivo. */
export async function elegirImagen(page: Page, ambito: Locator, archivo: ArchivoDePrueba) {
  const campos = await camposDe(page, ambito);
  const disparador = campos
    .getByRole('button', { name: /^(Elegir|Agregar) imagen/ })
    .or(campos.getByLabel(/^(Elegir|Agregar) imagen/))
    .last();
  const [selector] = await Promise.all([page.waitForEvent('filechooser'), disparador.click()]);
  await selector.setFiles(archivo);
}

/** Sube una imagen válida y completa su texto alternativo (el campo recibe el foco al terminar la subida). */
export async function subirImagenConAlt(page: Page, ambito: Locator, alt: string, archivo = archivoPng()) {
  const campos = await camposDe(page, ambito);
  await elegirImagen(page, campos, archivo);
  const campoAlt = campos.getByLabel('Texto alternativo', { exact: true }).last();
  await expect(campoAlt).toBeVisible();
  await campoAlt.fill(alt);
}

/**
 * Completa un elemento recién agregado con los mismos valores que `diezElementos` de ayudas/articulos.ts: el texto en
 * el lienzo y el resto de los campos en el panel de propiedades.
 */
export async function completarBloque(page: Page, grupo: Locator, tipo: TipoDeBloque) {
  const campo = async (etiqueta: string | RegExp) =>
    (await camposDe(page, grupo)).getByLabel(etiqueta, { exact: typeof etiqueta === 'string' });
  switch (tipo) {
    case 'parrafo':
      await escribirEnElemento(page, grupo, 'Primer párrafo con ');
      await page.keyboard.press(`${MOD}+b`);
      await page.keyboard.type('negrita');
      await page.keyboard.press(`${MOD}+b`);
      await page.keyboard.type(' y ');
      await page.keyboard.press(`${MOD}+i`);
      await page.keyboard.type('cursiva');
      await page.keyboard.press(`${MOD}+i`);
      await page.keyboard.type('.');
      break;
    case 'titulo':
      await escribirEnElemento(page, grupo, 'Un subtítulo de nivel dos');
      break;
    case 'imagen':
      await subirImagenConAlt(page, grupo, 'Imagen de prueba');
      await (await campo('Leyenda')).fill('Leyenda de la imagen');
      break;
    case 'cita':
      await escribirEnElemento(page, grupo, 'Una cita memorable');
      await (await campo('Autor')).fill('Alguien');
      await (await campo(/^Fuente/)).fill('https://example.com/fuente');
      break;
    case 'lista':
      await escribirEnElemento(page, grupo, 'Primero');
      for (const texto of ['Segundo', 'Tercero']) {
        await page.keyboard.press('Enter');
        await page.keyboard.type(texto);
      }
      break;
    case 'galeria': {
      const campos = await camposDe(page, grupo);
      await campos.getByLabel('Columnas', { exact: true }).selectOption('2');
      await elegirImagen(page, campos, archivoPng('uno.png'));
      await elegirImagen(page, campos, archivoPng('dos.png'));
      await expect(campos.getByLabel('Texto alternativo', { exact: true })).toHaveCount(2);
      await campos.getByLabel('Texto alternativo', { exact: true }).nth(0).fill('Imagen de prueba');
      await campos.getByLabel('Texto alternativo', { exact: true }).nth(1).fill('Otra imagen');
      break;
    }
    case 'cta':
      await (await campo('Título')).fill('Llamada a la acción');
      await (await campo('Texto')).fill('Un texto de apoyo');
      await (await campo('Texto del botón')).fill('Ir al sitio');
      await (await campo('URL')).fill('https://example.com/destino');
      break;
    case 'separador':
      break;
    case 'codigo':
      await escribirEnElemento(page, grupo, 'const x = 1;');
      await (await campo('Lenguaje')).fill('ts');
      break;
    case 'video':
      await (await campo('Proveedor')).selectOption('youtube');
      await (await campo('ID del video')).fill('dQw4w9WgXcQ');
      await (await campo('Título del video')).fill('Un video de prueba');
      break;
  }
}

/** Vacía el documento con Mod+A y Supr (sin imágenes ya guardadas no pide confirmación). */
export async function vaciarDocumento(page: Page) {
  await lienzo(page).focus();
  await page.keyboard.press(`${MOD}+a`);
  await page.keyboard.press('Delete');
}

/** El botón «Propiedades» de la barra (aparece con un elemento con propiedades seleccionado). */
export const botonPropiedades = (page: Page) =>
  barraDeFormato(page).getByRole('button', { name: 'Propiedades', exact: true });

/** El botón «Deshacer» de la barra (por debajo de cierto ancho vive en «Más acciones»: se busca aunque esté oculto). */
export const botonDeshacer = (page: Page) =>
  barraDeFormato(page).getByRole('button', { name: 'Deshacer', exact: true, includeHidden: true });

/** El botón «Rehacer» de la barra. */
export const botonRehacer = (page: Page) =>
  barraDeFormato(page).getByRole('button', { name: 'Rehacer', exact: true, includeHidden: true });

// ---------------------------------------------------------------------------------------------------------------------
// Ayudas del editor estilo documento (spec 005, T039). FASE ROJA: el lienzo y la barra no existen aún.
//
// CONTRATO DE INTERFAZ SUPUESTO (contracts/atajos.md y contracts/componentes.md):
//   - Lienzo: `contenteditable` con nombre accesible "Contenido del artículo" (`aria-label`), `aria-multiline="true"`, sin
//     `role="textbox"` forzado. Cada elemento de texto es un nodo real (`p`, `h2`, `h3`, `h4`, `blockquote`, `ul`/`ol`
//     con `li`, `pre`). Con el menú «/» abierto declara `aria-haspopup="listbox"`, `aria-controls` y
//     `aria-activedescendant` (id de la opción activa).
//   - Barra: `role="toolbar"` con nombre "Formato del texto"; botones "Negrita", "Cursiva", "Subrayado", "Enlace" (los de
//     estado con `aria-pressed`), "Más formato" (con "Código" adentro desde la Fase 12), "Alineación", "Lista con
//     viñetas", "Lista numerada", "Insertar", "Deshacer" y "Rehacer".
//   - Selector de estilo de párrafo: botón de la barra cuyo nombre empieza con "Estilo de párrafo" y cuyo texto visible
//     es el estilo vigente (Párrafo, Título 2, Título 3, Título 4, Cita); abre un menú con `menuitem` u `option` por estilo.
//   - Campo de enlace: `input` con etiqueta "URL del enlace" (Enter aplica, Esc cierra y devuelve el foco al lienzo;
//     una URL no permitida marca `aria-invalid="true"`).
//   - Menú de inserción («/» e «Insertar»): `role="listbox"` con `role="option"` (nombre que empieza con el del elemento:
//     "Título 2", "Cita", "Imagen"…); sin coincidencias, un `role="status"` con "Sin resultados".
// ---------------------------------------------------------------------------------------------------------------------

/** El lienzo del documento (el `contenteditable` de ProseMirror). */
export const lienzo = (page: Page) => page.getByLabel('Contenido del artículo', { exact: true });

/** La barra de herramientas de formato. */
export const barraDeFormato = (page: Page) => page.getByRole('toolbar', { name: 'Formato del texto', exact: true });

/** Escribe en el lienzo (le da el foco con un clic solo si todavía no lo tiene, para no mover el cursor). */
export async function escribirEnLienzo(page: Page, texto: string) {
  const area = lienzo(page);
  const conFoco = await area.evaluate((el) => el.contains(document.activeElement));
  if (!conFoco) await area.click();
  await page.keyboard.type(texto);
}

/** Abre «Insertar» de la barra y devuelve el listbox (con el foco ya dentro). */
export async function abrirMenuInsertar(page: Page): Promise<Locator> {
  await barraDeFormato(page).getByRole('button', { name: 'Insertar', exact: true }).click();
  const menu = page.getByRole('listbox');
  await expect(menu).toBeVisible();
  return menu;
}

/** Una opción del menú de inserción por el comienzo de su nombre (el nombre accesible puede sumar la descripción). */
export const opcionDeInsercion = (page: Page, nombre: string) =>
  page.getByRole('option', { name: new RegExp(`^${nombre}`) });

/** El selector de estilo de párrafo de la barra. */
export const selectorDeEstilo = (page: Page) =>
  barraDeFormato(page).getByRole('button', { name: /^Estilo de párrafo/ });

/** Elige un estilo de párrafo ("Título 2", "Cita"…) desde el selector de la barra. */
export async function elegirEstilo(page: Page, estilo: string) {
  await selectorDeEstilo(page).click();
  await page
    .getByRole('menuitem', { name: estilo, exact: true })
    .or(page.getByRole('menuitemradio', { name: estilo, exact: true }))
    .or(page.getByRole('option', { name: estilo, exact: true }))
    .click();
}

// ---------------------------------------------------------------------------------------------------------------------
// Ayudas de más formato y alineación (spec 005, Fase 12, T127). FASE ROJA: no existen aún.
//
// CONTRATO DE INTERFAZ SUPUESTO (contracts/atajos.md "Roles y nombres", contracts/componentes.md y research D28 y D31
// U10):
//   - En la barra: "Negrita", "Cursiva", "Subrayado" (con `aria-pressed`) y "Enlace". «Código» deja la barra.
//   - «Más formato»: botón de la barra (nombre "Más formato" o "Más formato, resaltado activo") con `aria-haspopup="menu"`
//     que abre un `role="menu"` con `menuitemcheckbox` "Tachado", "Resaltado", "Código", "Superíndice" y "Subíndice"
//     (`aria-checked`, con ícono de verificación). Elegir uno aplica o quita el formato y cierra el menú.
//   - «Alineación»: botón con nombre "Alineación: <vigente>" (izquierda, centro, derecha, justificado o varias) y
//     `aria-haspopup="menu"`; abre `menuitemradio` "Izquierda", "Centro", "Derecha" y "Justificado".
//   - Un control no disponible lleva `aria-disabled="true"` y la razón por `aria-describedby`; al enfocarlo, la razón
//     se ve como aviso (`role="tooltip"` o texto visible) y `Esc` lo cierra (WCAG 1.4.13).
// ---------------------------------------------------------------------------------------------------------------------

export const botonMasFormato = (page: Page) => barraDeFormato(page).getByRole('button', { name: /^Más formato/ });
export const botonAlineacion = (page: Page) => barraDeFormato(page).getByRole('button', { name: /^Alineación/ });

/** Abre «Más formato» y devuelve su menú. */
export async function abrirMasFormato(page: Page): Promise<Locator> {
  await botonMasFormato(page).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  return menu;
}

/** Una opción de «Más formato» ("Tachado", "Resaltado", "Código", "Superíndice", "Subíndice"). */
export const opcionDeFormato = (page: Page, nombre: string) =>
  page.getByRole('menuitemcheckbox', { name: nombre, exact: true });

/** Aplica o quita un formato de «Más formato» con el ratón. */
export async function elegirMasFormato(page: Page, nombre: string) {
  await abrirMasFormato(page);
  await opcionDeFormato(page, nombre).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
}

/** Una opción del menú «Alineación» ("Izquierda", "Centro", "Derecha", "Justificado"). */
export const opcionDeAlineacion = (page: Page, nombre: string) =>
  page.getByRole('menuitemradio', { name: nombre, exact: true });

/** Elige una alineación con el ratón. */
export async function elegirAlineacion(page: Page, nombre: 'Izquierda' | 'Centro' | 'Derecha' | 'Justificado') {
  await botonAlineacion(page).click();
  await opcionDeAlineacion(page, nombre).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
}

/** El texto del elemento que nombra el `aria-describedby` del control (la razón de un control no disponible). */
export async function razonDe(control: Locator) {
  const ids = ((await control.getAttribute('aria-describedby')) ?? '').split(/\s+/).filter(Boolean);
  const textos: string[] = [];
  for (const id of ids) {
    textos.push(((await control.page().locator(`[id="${id}"]`).first().textContent()) ?? '').trim());
  }
  return textos.join(' ');
}

// ---------------------------------------------------------------------------------------------------------------------
// Ayudas de los elementos especiales y el panel de propiedades (spec 005, T049). FASE ROJA: no existen aún.
//
// CONTRATO DE INTERFAZ SUPUESTO (contracts/componentes.md y contracts/atajos.md):
//   - Isla de un elemento especial dentro del lienzo: nombre accesible "<Tipo>, <posición> de <total>" ("Imagen, 3 de 8",
//     "Galería, 2 de 5", "Llamada a la acción…", "Video…"); es un nodo no editable, sin botones tabulables.
//   - Panel de propiedades: `aside` (rol `complementary`) con nombre "Propiedades del elemento N, <tipo>". Desde 1280 px
//     vive en la pestaña «Elemento» (`role="tab"`) de la columna lateral, junto a la pestaña «Artículo»; **Publicación**
//     (grupo/región con nombre "Publicación") nunca está dentro de una pestaña. Por debajo de 1280 px es la hoja: el
//     mismo `aside`, con botón «Cerrar», que solo existe mientras está abierta.
//   - Botón «Propiedades» en la barra de herramientas (aparece con un elemento seleccionado).
//   - Texto de error en la isla: contiene "error" o el mensaje de validación, visible sin color (no solo color).
//   - Insertar imagen o galería deja el foco en el primer campo del panel (el selector «Elegir imagen» / «Agregar imagen»).
// ---------------------------------------------------------------------------------------------------------------------

export const panelDePropiedades = (page: Page) =>
  page.getByRole('complementary', { name: /^Propiedades del elemento/ });

export const pestana = (page: Page, nombre: 'Artículo' | 'Elemento') =>
  page.getByRole('tab', { name: nombre, exact: true });

/** La isla de un elemento especial en el lienzo, por su nombre accesible ("Imagen, 3 de 8"). */
export const isla = (page: Page, nombre: string | RegExp) =>
  lienzo(page).getByLabel(nombre, { exact: typeof nombre === 'string' });

/** Inserta un elemento desde «Insertar» de la barra (por el comienzo de su nombre en el menú). */
export async function insertarDesdeBarra(page: Page, nombre: string) {
  await abrirMenuInsertar(page);
  await opcionDeInsercion(page, nombre).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

/** Inserta un elemento escribiendo «/» y el filtro en una línea vacía, y Enter sobre la opción activa. */
export async function insertarConBarra(page: Page, filtro: string) {
  await escribirEnLienzo(page, `/${filtro}`);
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

export type FormatoDeImagen = 'png' | 'jpeg' | 'webp' | 'avif';

/** Archivo de imagen válido del formato pedido (bytes mínimos y decodificables por el validador del cliente). */
export function archivoDeImagen(
  formato: FormatoDeImagen,
  nombre = `foto.${formato === 'jpeg' ? 'jpg' : formato}`,
): ArchivoDePrueba {
  const bytes = {
    png: () => pngDecodificable(4, 3),
    jpeg: () => jpegMinimo(40, 30),
    webp: () => webpMinimo(16, 12),
    avif: () => avifMinimo(20, 10),
  }[formato]();
  return { name: nombre, mimeType: `image/${formato}`, buffer: Buffer.from(bytes) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Ayudas de mover, duplicar, quitar y seleccionar varios elementos (spec 005, T064). FASE ROJA: no existen aún.
//
// CONTRATO DE INTERFAZ SUPUESTO (contracts/atajos.md y contracts/componentes.md, "AsaDeElemento", "MenuAcciones"):
//   - Botón «Acciones» de la barra: `aria-haspopup="menu"` y `aria-expanded`; su nombre empieza con "Acciones" y, con un
//     elemento activo, dice a cuál actúa ("Acciones del elemento 3, párrafo"). Abre un `role="menu"` con `menuitem`:
//     "Subir", "Bajar", "Duplicar", "Convertir en…", "Quitar", "Seleccionar", "Propiedades" y "Atajos". Los no disponibles
//     (extremos, varios elementos, subida en curso) llevan `aria-disabled="true"`; «Convertir en…» con varios elementos
//     seleccionados no se ofrece (no existe). «Convertir en…» abre un submenú con los estilos de texto ("Párrafo", "Título 2"…).
//   - Asa flotante: un `button` con nombre "Acciones del elemento N, <tipo>" que NO está en la barra; aparece al pasar el
//     puntero por un elemento (o con el elemento activo) y va después de la barra en el DOM. Al arrastrarla muestra un
//     texto de destino "Soltar aquí: posición 3 de 8".
//   - Modo elementos: texto fijo "N elementos seleccionados" (o "1 elemento seleccionado") y botón «Salir de la selección»;
//     cada elemento seleccionado lleva `data-seleccionado="true"`, un borde izquierdo de 2 px y un ícono (`svg`) de
//     verificación (la marca que no depende del color).
//   - Confirmaciones de quitar una imagen guardada: `role="alertdialog"` con botón de confirmar «Quitar…» y «Cancelar».
//     El aviso de conversión con pérdida es otro `alertdialog` con botones «Convertir» y «Cancelar» que nombra lo perdido.
//   - Diálogo «Atajos de teclado»: `role="dialog"` con ese nombre; el foco inicial va a su título (`heading`).
//   - Anuncios: `role="status"` (región persistente de `ContextoEditor`) con los textos de anuncios.ts.
// ---------------------------------------------------------------------------------------------------------------------

/** El botón «Acciones» de la barra de herramientas. */
export const botonAcciones = (page: Page) => barraDeFormato(page).getByRole('button', { name: /^Acciones/ });

/** El asa flotante del elemento activo (para ratón y toque; va después de la barra en el DOM). */
export const asaDeElemento = (page: Page) => page.getByRole('button', { name: /^Acciones del elemento \d+, / }).last();

export const menuDeAcciones = (page: Page) => page.getByRole('menu');

/** Una entrada del menú de acciones por el comienzo de su nombre ("Subir", "Convertir en…", "Atajos"…). */
export const accionDelMenu = (page: Page, nombre: string) =>
  menuDeAcciones(page).getByRole('menuitem', { name: new RegExp(`^${nombre}`) });

/** Abre el menú de acciones de la barra y elige una entrada con el ratón. */
export async function elegirAccion(page: Page, nombre: string) {
  await botonAcciones(page).click();
  await accionDelMenu(page, nombre).click();
}

/** Los elementos de primer nivel del lienzo (párrafos, títulos, listas, citas, islas…). */
export const elementosDelLienzo = (page: Page) => lienzo(page).locator(':scope > *');

/** Los textos de los elementos de primer nivel que son párrafos, títulos, citas o listas, en orden. */
export const textosDelLienzo = (page: Page) =>
  elementosDelLienzo(page).evaluateAll((els) =>
    els
      .filter((el) => !el.matches('[data-elemento]'))
      .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter((texto) => texto !== ''),
  );

/** El texto fijo del modo elementos ("3 elementos seleccionados"). */
export const textoDeSeleccion = (page: Page) => page.getByText(/^\d+ elementos? seleccionados?$/).first();

/** Los elementos del lienzo marcados como seleccionados en modo elementos. */
export const elementosSeleccionados = (page: Page) => lienzo(page).locator('[data-seleccionado="true"]');

export const regionDeEstado = (page: Page) => page.getByRole('status');

/** Pone el cursor en el elemento que contiene `texto` y pulsa `Esc`: queda seleccionado ese elemento (modo elementos). */
export async function entrarAlModo(page: Page, texto: string | RegExp) {
  await lienzo(page)
    .getByText(texto, { exact: typeof texto === 'string' })
    .first()
    .click();
  await page.keyboard.press('Escape');
  await expect(textoDeSeleccion(page)).toBeVisible();
}

/** Anota (en `window.__anuncios`) cada texto de "N elementos seleccionados" que aparezca en la página. */
export async function observarAnunciosDeSeleccion(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __anuncios: string[] };
    w.__anuncios = [];
    const anotar = (texto: string | null) => {
      const coincide = texto?.match(/\d+ elementos? seleccionados?/g);
      if (coincide) w.__anuncios.push(...coincide);
    };
    new MutationObserver((cambios) => {
      for (const cambio of cambios) {
        if (cambio.target.parentElement?.closest('[role="status"]')) anotar(cambio.target.textContent);
        cambio.addedNodes.forEach((nodo) => {
          if ((nodo as Element).closest?.('[role="status"]') ?? nodo.parentElement?.closest('[role="status"]'))
            anotar(nodo.textContent);
        });
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
}
export const anunciosDeSeleccion = (page: Page) =>
  page.evaluate(() => (window as unknown as { __anuncios: string[] }).__anuncios);

type Punto = { x: number; y: number };
export const centroDe = async (localizador: Locator): Promise<Punto> => {
  const caja = (await localizador.boundingBox())!;
  return { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 };
};

/** Arrastra con el ratón desde `desde` hasta `hasta` en pasos (sin soltar si `soltar` es false). */
export async function arrastrarConRaton(page: Page, desde: Punto, hasta: Punto, soltar = true) {
  await page.mouse.move(desde.x, desde.y);
  await page.mouse.down();
  await page.mouse.move(desde.x + 2, desde.y + 4, { steps: 3 });
  await page.mouse.move(hasta.x, hasta.y, { steps: 12 });
  if (soltar) await page.mouse.up();
}

/** Un toque con el dedo (eventos táctiles reales por CDP: Chromium). `mover` son los puntos intermedios y final. */
export async function gestoTactil(page: Page, inicio: Punto, mover: Punto[], soltar = true) {
  const sesion = await page.context().newCDPSession(page);
  await sesion.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [inicio] });
  for (const punto of mover) await sesion.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [punto] });
  if (soltar) await sesion.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return sesion;
}
