// Ayudas de los E2E del editor de artículos (spec 003, H2). FASE ROJA: la interfaz no existe aún.
//
// CONTRATO DE INTERFAZ SUPUESTO (T056 a T062). Todo lo que los specs de H2 asumen de la pantalla vive aquí o en
// los comentarios de cada spec, así que si la interfaz real difiere, se ajusta en un solo lugar.
//   - /articulos/nuevo y /articulos/[id]: un único `h1`. Campos con etiqueta: "Título", "Slug", "Extracto",
//     "Categoría", "Título SEO", "Descripción SEO"; grupo "Imagen destacada" (role=group) con el selector de imagen.
//   - Botón "Guardar" (nombre exacto). Tras guardar, un `role="status"` con el texto "Guardado" ("Cambios guardados"...).
//     Al crear un artículo nuevo, navega a /articulos/<uuid>.
//   - Agregar un bloque: `<select>` con etiqueta "Tipo de bloque a agregar" (los `value` son los ids de tipo: parrafo,
//     titulo, imagen, cita, lista, galeria, cta, separador, codigo, video) y botón "Agregar bloque".
//   - Cada bloque es un `role="group"` con nombre "Bloque N: <tipo>" (N desde 1) y botones "Subir bloque N, <tipo>",
//     "Bajar bloque N, <tipo>", "Duplicar bloque N, <tipo>" y "Quitar bloque N, <tipo>" (T059).
//   - Etiquetas de los campos dentro del grupo de cada tipo (se buscan con `exact: true`, salvo las marcadas):
//       parrafo "Texto" · titulo "Nivel" (select 2/3/4) y "Texto" · imagen selector + "Texto alternativo",
//       casilla "Imagen decorativa" y "Leyenda" · cita "Texto", "Autor", "Fuente" (/^Fuente/) ·
//       lista "Lista ordenada" (casilla), botón "Agregar ítem" y campos "Ítem 1", "Ítem 2"… ·
//       galeria botón "Agregar imagen" (cada imagen con su "Texto alternativo") y "Columnas" (select 2/3/4) ·
//       cta "Título", "Texto", "Texto del botón", "URL" · codigo "Código" y "Lenguaje" ·
//       video "Proveedor" (select youtube/vimeo), "ID del video", "Título del video".
//   - Selector de imagen (T057): botón (o `input[type=file]`) "Elegir imagen" (en la galería, "Agregar imagen"); abre el
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

export type ArchivoDePrueba = { name: string; mimeType: string; buffer: Buffer };

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

export const grupoDeBloque = (page: Page, posicion: number, tipo: TipoDeBloque) =>
  page.getByRole('group', { name: `Bloque ${posicion}: ${NOMBRE_DE_TIPO[tipo]}` });

/** Guarda y espera el aviso de éxito (`role="status"`). */
export async function guardarYEsperar(page: Page) {
  await botonGuardar(page).click();
  await expect(page.getByRole('status').filter({ hasText: /guardad/i })).toBeVisible();
}

/** Agrega un bloque al final y devuelve su grupo. `posicion` es el lugar (desde 1) que va a ocupar. */
export async function agregarBloque(page: Page, tipo: TipoDeBloque, posicion: number): Promise<Locator> {
  await page.getByLabel('Tipo de bloque a agregar').selectOption({ value: tipo });
  await page.getByRole('button', { name: 'Agregar bloque' }).click();
  const grupo = grupoDeBloque(page, posicion, tipo);
  await expect(grupo).toBeVisible();
  return grupo;
}

/** Abre el selector de archivos desde el botón "Elegir imagen" (o "Agregar imagen") del ámbito y entrega el archivo. */
export async function elegirImagen(page: Page, ambito: Locator, archivo: ArchivoDePrueba) {
  const disparador = ambito
    .getByRole('button', { name: /^(Elegir|Agregar) imagen/ })
    .or(ambito.getByLabel(/^(Elegir|Agregar) imagen/))
    .last();
  const [selector] = await Promise.all([page.waitForEvent('filechooser'), disparador.click()]);
  await selector.setFiles(archivo);
}

/** Sube una imagen válida y completa su texto alternativo (el campo recibe el foco al terminar la subida). */
export async function subirImagenConAlt(page: Page, ambito: Locator, alt: string, archivo = archivoPng()) {
  await elegirImagen(page, ambito, archivo);
  const campoAlt = ambito.getByLabel('Texto alternativo', { exact: true }).last();
  await expect(campoAlt).toBeVisible();
  await campoAlt.fill(alt);
}

/** Completa un bloque recién agregado con los mismos valores que `diezBloques` de ayudas/articulos.ts. */
export async function completarBloque(page: Page, grupo: Locator, tipo: TipoDeBloque) {
  const campo = (etiqueta: string | RegExp) => grupo.getByLabel(etiqueta, { exact: typeof etiqueta === 'string' });
  switch (tipo) {
    case 'parrafo':
      await campo('Texto').fill('Primer párrafo con **negrita** y _cursiva_.');
      break;
    case 'titulo':
      await campo('Nivel').selectOption('2');
      await campo('Texto').fill('Un subtítulo de nivel dos');
      break;
    case 'imagen':
      await subirImagenConAlt(page, grupo, 'Imagen de prueba');
      await campo('Leyenda').fill('Leyenda de la imagen');
      break;
    case 'cita':
      await campo('Texto').fill('Una cita memorable');
      await campo('Autor').fill('Alguien');
      await campo(/^Fuente/).fill('https://example.com/fuente');
      break;
    case 'lista':
      await campo('Lista ordenada').check();
      for (const [i, texto] of ['Primero', 'Segundo', 'Tercero'].entries()) {
        await grupo.getByRole('button', { name: /^Agregar ítem/ }).click();
        await campo(`Ítem ${i + 1}`).fill(texto);
      }
      break;
    case 'galeria':
      await campo('Columnas').selectOption('2');
      await elegirImagen(page, grupo, archivoPng('uno.png'));
      await elegirImagen(page, grupo, archivoPng('dos.png'));
      await expect(grupo.getByLabel('Texto alternativo', { exact: true })).toHaveCount(2);
      await grupo.getByLabel('Texto alternativo', { exact: true }).nth(0).fill('Imagen de prueba');
      await grupo.getByLabel('Texto alternativo', { exact: true }).nth(1).fill('Otra imagen');
      break;
    case 'cta':
      await campo('Título').fill('Llamada a la acción');
      await campo('Texto').fill('Un texto de apoyo');
      await campo('Texto del botón').fill('Ir al sitio');
      await campo('URL').fill('https://example.com/destino');
      break;
    case 'separador':
      break;
    case 'codigo':
      await campo('Código').fill('const x = 1;');
      await campo('Lenguaje').fill('ts');
      break;
    case 'video':
      await campo('Proveedor').selectOption('youtube');
      await campo('ID del video').fill('dQw4w9WgXcQ');
      await campo('Título del video').fill('Un video de prueba');
      break;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Ayudas del editor estilo documento (spec 005, T039). FASE ROJA: el lienzo y la barra no existen aún.
//
// CONTRATO DE INTERFAZ SUPUESTO (contracts/atajos.md y contracts/componentes.md):
//   - Lienzo: `contenteditable` con nombre accesible "Contenido del artículo" (`aria-label`), `aria-multiline="true"`, sin
//     `role="textbox"` forzado. Cada elemento de texto es un nodo real (`p`, `h2`, `h3`, `h4`, `blockquote`, `ul`/`ol`
//     con `li`, `pre`). Con el menú «/» abierto declara `aria-haspopup="listbox"`, `aria-controls` y
//     `aria-activedescendant` (id de la opción activa).
//   - Barra: `role="toolbar"` con nombre "Formato del texto"; botones "Negrita", "Cursiva", "Código", "Enlace" (los de
//     estado con `aria-pressed`), "Lista con viñetas", "Lista numerada", "Insertar", "Deshacer" y "Rehacer".
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
