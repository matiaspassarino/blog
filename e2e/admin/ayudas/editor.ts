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
import { pngDecodificable } from '../../../packages/db/src/pruebas/imagenes';

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
