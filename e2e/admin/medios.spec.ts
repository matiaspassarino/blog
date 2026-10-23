// T051 (spec 003, H2-E4, RF-007, casos borde de imágenes). FASE ROJA: el editor y el selector de imagen no existen aún.
//
// Supuestos de interfaz (T057), además del contrato de ./ayudas/editor.ts:
//   - La imagen destacada es un `role="group"` con nombre "Imagen destacada" que contiene el selector de imagen.
//   - Tras subir una imagen válida aparecen "Texto alternativo" (con el foco) y la casilla "Imagen decorativa", y el
//     botón "Quitar imagen". La casilla deshabilita y limpia el texto alternativo.
//   - Un archivo rechazado se explica en un `role="alert"`: "Solo se aceptan imágenes JPEG, PNG, WebP o AVIF de hasta
//     5 MB" (el de más de 5 MB lo rechaza el cliente nombrando el límite); el bloque queda sin imagen (sin "Quitar
//     imagen" ni "Texto alternativo") y el resto del formulario no se toca.
//   - "Quitar imagen" de una imagen ya guardada pide confirmación en un `alertdialog` con un botón que empieza con "Quitar".
//   - Spec 005 (T058): la imagen de un elemento se elige en su panel de propiedades (la isla del lienzo no tiene campos);
//     mientras sube, «Guardar» queda con `aria-disabled="true"` igual que con la imagen destacada.
// Los archivos se arman en memoria (packages/db/src/pruebas/imagenes.ts): no hay binarios en el repo.
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  avifMinimo,
  gifMinimo,
  jpegMinimo,
  pngDecodificable,
  svgMinimo,
  textoPlanoComoArchivo,
  webpMinimo,
} from '../../packages/db/src/pruebas/imagenes';
import {
  ID_EDITORA,
  articuloPorId,
  articuloPorTitulo,
  existeObjeto,
  imagenSemilla,
  limpiarArticulosE2E,
  parrafo,
  sembrarArticulo,
  subirObjeto,
  elementosDe,
} from './ayudas/articulos';
import { nombreDePrueba } from './ayudas/datos';
import {
  agregarBloque,
  elegirImagen,
  escribirEnElemento,
  esperarEditorListo,
  grupoDeBloque,
  guardarYEsperar,
  panelDePropiedades,
  type ArchivoDePrueba,
} from './ayudas/editor';
import { ingresar, USUARIOS } from './ayudas/sesion';

const PREFIJO = 'e2e-me-';
const titulo = (etiqueta: string) => nombreDePrueba(`me-${etiqueta}`);

test.afterAll(() => limpiarArticulosE2E(PREFIJO));

test.beforeEach(async ({ page }) => {
  await ingresar(page, USUARIOS.editor);
});

const archivo = (name: string, mimeType: string, bytes: Uint8Array): ArchivoDePrueba => ({
  name,
  mimeType,
  buffer: Buffer.from(bytes),
});

const destacada = (page: Page) => page.getByRole('group', { name: 'Imagen destacada' });

async function abrirNuevo(page: Page, tituloArticulo: string) {
  await page.goto('/articulos/nuevo');
  await esperarEditorListo(page);
  await page.getByLabel('Título', { exact: true }).fill(tituloArticulo);
}

/** Retarda la subida directa a Storage para poder observar el estado intermedio. */
const demorarSubidas = (page: Page) =>
  page.route('**/storage/v1/object/upload/sign/**', async (ruta) => {
    await new Promise((resolver) => setTimeout(resolver, 1500));
    await ruta.continue();
  });

async function esperarGuardarBloqueadoMientrasSube(page: Page) {
  const guardar = page.getByRole('button', { name: 'Guardar', exact: true });
  await expect(guardar).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'Subiendo imagen' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Imagen subida' })).toBeVisible();
  await expect(guardar).not.toHaveAttribute('aria-disabled', 'true');
}

const FORMATOS = [
  { nombre: 'JPEG', archivo: archivo('foto.jpg', 'image/jpeg', jpegMinimo(40, 30)), ancho: 40, alto: 30 },
  { nombre: 'PNG', archivo: archivo('foto.png', 'image/png', pngDecodificable(7, 5)), ancho: 7, alto: 5 },
  { nombre: 'WebP', archivo: archivo('foto.webp', 'image/webp', webpMinimo(16, 12)), ancho: 16, alto: 12 },
  { nombre: 'AVIF', archivo: archivo('foto.avif', 'image/avif', avifMinimo(20, 10)), ancho: 20, alto: 10 },
];

test.describe('Subida de imágenes válidas (H2-E4)', () => {
  for (const formato of FORMATOS) {
    test(`H2-E4 / H5: un ${formato.nombre} sirve como imagen destacada y en un elemento de imagen; se registran ancho y alto`, async ({
      page,
    }) => {
      const nombre = titulo(`valida-${formato.nombre}`);
      await abrirNuevo(page, nombre);

      await elegirImagen(page, destacada(page), formato.archivo);
      await expect(destacada(page).getByLabel('Texto alternativo', { exact: true })).toBeFocused();
      await expect(destacada(page).getByLabel('Imagen decorativa')).toBeVisible();
      await destacada(page).getByLabel('Texto alternativo', { exact: true }).fill('Imagen destacada de prueba');

      const elemento = await agregarBloque(page, 'imagen', 1);
      await elegirImagen(page, elemento, formato.archivo);
      await panelDePropiedades(page).getByLabel('Texto alternativo', { exact: true }).fill('Imagen del elemento');
      await expect(elemento.locator('img')).toBeVisible();
      await guardarYEsperar(page);

      const guardado = await articuloPorTitulo(nombre);
      expect(guardado?.imagen_destacada).toMatchObject({
        ancho: formato.ancho,
        alto: formato.alto,
        alt: 'Imagen destacada de prueba',
      });
      const imagenDelBloque = elementosDe(guardado)[0]?.attrs.imagen as
        | { ruta: string; ancho: number; alto: number }
        | undefined;
      expect(imagenDelBloque).toMatchObject({ ancho: formato.ancho, alto: formato.alto });
      expect(imagenDelBloque?.ruta).toMatch(/^articulos\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.\w+$/);
      expect(await existeObjeto(imagenDelBloque!.ruta)).toBe(true);
    });
  }

  test('H2-E4: marcar "Imagen decorativa" deshabilita y limpia el texto alternativo', async ({ page }) => {
    await abrirNuevo(page, titulo('decorativa'));
    await elegirImagen(page, destacada(page), FORMATOS[1]!.archivo);
    const alt = destacada(page).getByLabel('Texto alternativo', { exact: true });
    await alt.fill('Algo');

    await destacada(page).getByLabel('Imagen decorativa').check();

    await expect(alt).toBeDisabled();
    await expect(alt).toHaveValue('');
  });

  test('H2-E4: mientras sube, el botón de guardar queda deshabilitado con aviso', async ({ page }) => {
    await abrirNuevo(page, titulo('subiendo'));
    await demorarSubidas(page);

    await elegirImagen(page, destacada(page), FORMATOS[1]!.archivo);

    await esperarGuardarBloqueadoMientrasSube(page);
  });

  test('H5 / RF-013: mientras sube la imagen de un elemento desde el panel, guardar queda deshabilitado con aviso', async ({
    page,
  }) => {
    await abrirNuevo(page, titulo('subiendo-elemento'));
    await demorarSubidas(page);
    const elemento = await agregarBloque(page, 'imagen', 1);

    await elegirImagen(page, elemento, FORMATOS[1]!.archivo);

    await esperarGuardarBloqueadoMientrasSube(page);
    await expect(elemento.locator('img')).toBeVisible();
  });
});

test.describe('Archivos rechazados (H2-E4, casos borde)', () => {
  const grande = new Uint8Array(5 * 1024 * 1024 + 1);
  grande.set(pngDecodificable());

  const RECHAZADOS = [
    { nombre: 'un .gif', archivo: archivo('animada.gif', 'image/gif', gifMinimo()), motivo: /JPEG, PNG, WebP o AVIF/ },
    {
      nombre: 'un .svg',
      archivo: archivo('vector.svg', 'image/svg+xml', svgMinimo()),
      motivo: /JPEG, PNG, WebP o AVIF/,
    },
    {
      nombre: 'un .jpg que en realidad es texto',
      archivo: archivo('falsa.jpg', 'image/jpeg', textoPlanoComoArchivo()),
      motivo: /JPEG, PNG, WebP o AVIF/,
    },
    { nombre: 'un archivo de más de 5 MB', archivo: archivo('enorme.png', 'image/png', grande), motivo: /5 MB/ },
  ];

  for (const { nombre, archivo: rechazado, motivo } of RECHAZADOS) {
    test(`H2-E4: ${nombre} se rechaza con su motivo, el elemento queda sin imagen y el resto no se afecta`, async ({
      page,
    }) => {
      const nombreArticulo = titulo('rechazo');
      await abrirNuevo(page, nombreArticulo);
      const primero = await agregarBloque(page, 'parrafo', 1);
      await escribirEnElemento(page, primero, 'Este texto no se pierde');
      const elemento = await agregarBloque(page, 'imagen', 2);

      await elegirImagen(page, elemento, rechazado);

      const panel = panelDePropiedades(page);
      await expectAlertaDeImagen(panel, motivo);
      await expect(panel.getByRole('button', { name: /Quitar imagen/ })).toHaveCount(0);
      await expect(panel.getByLabel('Texto alternativo', { exact: true })).toHaveCount(0);
      await expect(panel.getByRole('button', { name: /Elegir imagen/ })).toBeFocused();
      await expect(elemento.locator('img')).toHaveCount(0);
      await expect(page.getByLabel('Título', { exact: true })).toHaveValue(nombreArticulo);
      await expect(grupoDeBloque(page, 1, 'parrafo')).toHaveText('Este texto no se pierde');
    });
  }
});

async function expectAlertaDeImagen(ambito: Locator, motivo: RegExp) {
  await expect(ambito.getByRole('alert').filter({ hasText: motivo })).toBeVisible();
}

test.describe('Imágenes quitadas del almacenamiento (RF-007, D11)', () => {
  async function conImagenDestacada(etiqueta: string, ruta: string) {
    await subirObjeto(ruta, pngDecodificable());
    return sembrarArticulo({
      titulo: titulo(etiqueta),
      contenido: [parrafo('Con imagen destacada')],
      imagen_destacada: imagenSemilla(ruta),
    });
  }

  async function quitarDestacadaYGuardar(page: Page, id: string) {
    await page.goto(`/articulos/${id}`);
    await destacada(page)
      .getByRole('button', { name: /Quitar imagen/ })
      .click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /^Quitar/ })
      .click();
    await expect(destacada(page).getByRole('button', { name: /Quitar imagen/ })).toHaveCount(0);
    await guardarYEsperar(page);
  }

  test('H2-E4: quitar la imagen y guardar la borra del almacenamiento si ningún otro contenido la usa', async ({
    page,
  }) => {
    const ruta = `pruebas-e2e/${crypto.randomUUID()}.png`;
    const articulo = await conImagenDestacada('quita-libre', ruta);
    expect(await existeObjeto(ruta)).toBe(true);

    await quitarDestacadaYGuardar(page, articulo.id);

    expect((await articuloPorId(articulo.id)).imagen_destacada).toBeNull();
    await expect.poll(() => existeObjeto(ruta)).toBe(false);
  });

  test('H2-E4: la conserva si otro artículo la sigue usando', async ({ page }) => {
    const ruta = `pruebas-e2e/${crypto.randomUUID()}.png`;
    const articulo = await conImagenDestacada('quita-compartida', ruta);
    await sembrarArticulo({
      titulo: titulo('usa-compartida'),
      autorId: ID_EDITORA,
      imagen_destacada: imagenSemilla(ruta),
    });

    await quitarDestacadaYGuardar(page, articulo.id);

    expect((await articuloPorId(articulo.id)).imagen_destacada).toBeNull();
    await page.waitForTimeout(1000); // margen para un borrado que no debería ocurrir
    expect(await existeObjeto(ruta)).toBe(true);
  });

  test('H2-E4: quitar una imagen ya guardada pide confirmación; cancelar la conserva', async ({ page }) => {
    const ruta = `pruebas-e2e/${crypto.randomUUID()}.png`;
    const articulo = await conImagenDestacada('quita-cancela', ruta);
    await page.goto(`/articulos/${articulo.id}`);

    await destacada(page)
      .getByRole('button', { name: /Quitar imagen/ })
      .click();
    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();

    await expect(destacada(page).getByRole('button', { name: /Quitar imagen/ })).toBeVisible();
    expect(await existeObjeto(ruta)).toBe(true);
  });
});
