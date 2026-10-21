// T067 (spec 003, H3-E1, E2, E6, E7, CE-003). FASE ROJA: AccionesEstado (T072) no existe aún en /articulos/[id].
//
// Supuestos de interfaz: ver el encabezado de ./ayudas/estado.ts (grupo "Publicación", botones, `<time>`, enlace
// "Ver en el sitio", alertas con el texto de `mensajeDeError`). El editor usa los campos de ./ayudas/editor.ts.
// Requiere el sitio público en :4321 leyendo la misma base local (playwright.config.ts lo levanta) y, para el plazo
// de 60 s de CE-003, que los triggers de la base emitan el aviso de revalidación.
// Transiciones (RF-009 de la spec 001, trigger a40): borrador -> publicado | programado; programado -> borrador |
// publicado; publicado -> archivado | borrador; archivado -> borrador. Solo se archiva desde publicado.
import { expect, test } from '@playwright/test';
import {
  articuloPorId,
  limpiarArticulosE2E,
  parrafo,
  pasarAComoServicio,
  publicarComoServicio,
  quitarCategoriaComoServicio,
  sembrarArticulo,
} from './ayudas/articulos';
import { nombreDePrueba } from './ayudas/datos';
import { guardarYEsperar } from './ayudas/editor';
import {
  accionesVisibles,
  botonDeEstado,
  enlaceVerEnElSitio,
  errorDelPanel,
  esperarEnElSitio,
  esperarEstado,
  fechaMostrada,
  panelPublicacion,
  URL_SITIO,
  urlDelArticulo,
  type AccionDeEstado,
  type EstadoVisible,
} from './ayudas/estado';
import { ingresar, USUARIOS } from './ayudas/sesion';

const PREFIJO = 'e2e-pub-';
const titulo = (etiqueta: string) => nombreDePrueba(`pub-${etiqueta}`);

test.afterAll(() => limpiarArticulosE2E(PREFIJO));

test.beforeEach(async ({ page }) => {
  await ingresar(page, USUARIOS.editor);
});

test.describe('Publicar (H3-E1, CE-003)', () => {
  test('H3-E1: el editor publica un borrador completo, ve el estado con fecha y enlace, y aparece en el sitio en menos de 60 s', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('publicar') });
    await page.goto(urlDelArticulo(articulo.id));
    await esperarEstado(page, 'borrador');
    await esperarEnElSitio(page, articulo.slug, false, 5_000);

    await botonDeEstado(page, 'Publicar').click();

    await esperarEstado(page, 'publicado');
    await expect(fechaMostrada(page)).toBeVisible();
    const enlace = enlaceVerEnElSitio(page);
    await expect(enlace).toHaveAttribute('href', `${URL_SITIO}/blog/${articulo.slug}`);
    expect((await articuloPorId(articulo.id)).estado).toBe('publicado');
    await esperarEnElSitio(page, articulo.slug, true);
    await page.goto(`${URL_SITIO}/blog`);
    await expect(page.locator(`a[href="/blog/${articulo.slug}"]`).first()).toBeAttached();
  });

  test('H3-E1: la fecha mostrada es la de publicación (cercana a ahora, en la hora local)', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('fecha publicada') });
    await page.goto(urlDelArticulo(articulo.id));

    await botonDeEstado(page, 'Publicar').click();

    await esperarEstado(page, 'publicado');
    const iso = await fechaMostrada(page).getAttribute('datetime');
    expect(Math.abs(Date.now() - new Date(iso!).getTime())).toBeLessThan(120_000);
  });

  test('H3-E1: con cambios sin guardar pide guardar antes y no cambia el estado', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('sucio') });
    await page.goto(urlDelArticulo(articulo.id));
    await page.getByLabel('Título', { exact: true }).fill(`${articulo.titulo} cambiado`);

    await botonDeEstado(page, 'Publicar').click();

    await expect(errorDelPanel(page)).toContainText(/guarda.*antes/i);
    expect((await articuloPorId(articulo.id)).estado).toBe('borrador');

    await guardarYEsperar(page);
    await botonDeEstado(page, 'Publicar').click();
    await esperarEstado(page, 'publicado');
  });
});

test.describe('Requisitos de publicación (H3-E2)', () => {
  test('H3-E2: un borrador sin categoría no se publica y el panel dice que falta la categoría', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('sin categoria') });
    await quitarCategoriaComoServicio(articulo.id);
    await page.goto(urlDelArticulo(articulo.id));

    await botonDeEstado(page, 'Publicar').click();

    await expect(errorDelPanel(page)).toContainText('Para publicar falta: sin categoría.');
    await esperarEstado(page, 'borrador');
    expect((await articuloPorId(articulo.id)).estado).toBe('borrador');
  });

  test('H3-E2: un borrador sin bloques no se publica y el panel dice que faltan los bloques', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('sin bloques'), contenido: [] });
    await page.goto(urlDelArticulo(articulo.id));

    await botonDeEstado(page, 'Publicar').click();

    await expect(errorDelPanel(page)).toContainText('Para publicar falta: sin bloques.');
    expect((await articuloPorId(articulo.id)).estado).toBe('borrador');
  });

  test('H3-E2: programar un borrador incompleto también se rechaza con lo que falta', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('programar incompleto'), contenido: [] });
    await page.goto(urlDelArticulo(articulo.id));

    await page.getByLabel('Fecha y hora de publicación', { exact: true }).fill('2099-01-01T10:00');
    await botonDeEstado(page, 'Programar').click();

    await expect(errorDelPanel(page)).toContainText('Para publicar falta: sin bloques.');
    expect((await articuloPorId(articulo.id)).estado).toBe('borrador');
  });
});

test.describe('Retirar del sitio (H3-E6, CE-003)', () => {
  test('H3-E6: archivar un publicado lo retira del sitio en menos de 60 s, y volver a borrador lo mantiene fuera', async ({
    page,
  }) => {
    const articulo = await publicarComoServicio((await sembrarArticulo({ titulo: titulo('archivar') })).id);
    await esperarEnElSitio(page, articulo.slug, true);
    await page.goto(urlDelArticulo(articulo.id));
    await esperarEstado(page, 'publicado');

    await botonDeEstado(page, 'Archivar').click();

    await esperarEstado(page, 'archivado');
    await expect(enlaceVerEnElSitio(page)).toHaveCount(0);
    await esperarEnElSitio(page, articulo.slug, false);

    await botonDeEstado(page, 'Volver a borrador').click();
    await esperarEstado(page, 'borrador');
    expect((await articuloPorId(articulo.id)).estado).toBe('borrador');
    await esperarEnElSitio(page, articulo.slug, false, 10_000);
  });

  test('H3-E6: volver a borrador un publicado lo retira del sitio en menos de 60 s', async ({ page }) => {
    const articulo = await publicarComoServicio((await sembrarArticulo({ titulo: titulo('a borrador') })).id);
    await esperarEnElSitio(page, articulo.slug, true);
    await page.goto(urlDelArticulo(articulo.id));

    await botonDeEstado(page, 'Volver a borrador').click();

    await esperarEstado(page, 'borrador');
    await esperarEnElSitio(page, articulo.slug, false);
  });
});

test.describe('Solo las transiciones del estado (H3-E7, RF-012)', () => {
  const casos: { estado: EstadoVisible; acciones: AccionDeEstado[] }[] = [
    { estado: 'borrador', acciones: ['Publicar', 'Programar'] },
    // El orden es el de TODAS_LAS_ACCIONES (ayudas/estado.ts), no el de la pantalla.
    { estado: 'programado', acciones: ['Publicar', 'Cancelar programación'] },
    { estado: 'publicado', acciones: ['Volver a borrador', 'Archivar'] },
    { estado: 'archivado', acciones: ['Volver a borrador'] },
  ];

  for (const { estado, acciones } of casos) {
    test(`H3-E7: un ${estado} ofrece exactamente ${acciones.join(', ')} (y "Eliminar" no, para el editor)`, async ({
      page,
    }) => {
      const articulo = await sembrarArticulo({ titulo: titulo(`acciones ${estado}`) });
      if (estado === 'programado')
        await pasarAComoServicio(articulo.id, 'programado', new Date(Date.now() + 86_400_000));
      if (estado === 'publicado' || estado === 'archivado') await pasarAComoServicio(articulo.id, 'publicado');
      if (estado === 'archivado') await pasarAComoServicio(articulo.id, 'archivado');
      await page.goto(urlDelArticulo(articulo.id));

      await esperarEstado(page, estado);

      expect(await accionesVisibles(page)).toEqual(acciones);
    });
  }

  test('H3-E7: el estado programado muestra la fecha programada y ningún enlace al sitio', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('programado fecha') });
    const fecha = new Date(Date.now() + 86_400_000);
    await pasarAComoServicio(articulo.id, 'programado', fecha);
    await page.goto(urlDelArticulo(articulo.id));

    await esperarEstado(page, 'programado');

    await expect(fechaMostrada(page)).toHaveAttribute('datetime', new RegExp(`^${fecha.toISOString().slice(0, 16)}`));
    await expect(enlaceVerEnElSitio(page)).toHaveCount(0);
  });

  test('H3-E7: un borrador no muestra fecha ni enlace al sitio', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('borrador sin fecha') });
    await page.goto(urlDelArticulo(articulo.id));

    await esperarEstado(page, 'borrador');

    await expect(fechaMostrada(page)).toHaveCount(0);
    await expect(enlaceVerEnElSitio(page)).toHaveCount(0);
    await expect(panelPublicacion(page)).toBeVisible();
  });
});

test.describe('Editar un publicado (CE-003)', () => {
  test('CE-003: editar el título de un publicado actualiza el sitio en menos de 60 s', async ({ page }) => {
    const articulo = await publicarComoServicio(
      (await sembrarArticulo({ titulo: titulo('editar publicado'), contenido: [parrafo('Texto inicial')] })).id,
    );
    await esperarEnElSitio(page, articulo.slug, true);
    await page.goto(urlDelArticulo(articulo.id));
    const nuevoTitulo = `${articulo.titulo} corregido`;

    await page.getByLabel('Título', { exact: true }).fill(nuevoTitulo);
    await guardarYEsperar(page);

    await expect
      .poll(async () => (await page.request.get(`${URL_SITIO}/blog/${articulo.slug}`)).text(), { timeout: 60_000 })
      .toContain(nuevoTitulo);
    await esperarEstado(page, 'publicado');
  });
});
