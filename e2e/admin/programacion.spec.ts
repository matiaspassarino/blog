// T068 (spec 003, H3-E3, E4, E5, RF-013, D18), adaptado en la spec 004 (T017; RF-018, aclaración 2): "Programar" abre un
// diálogo con el campo de fecha. FASE ROJA: hoy el campo está en el recuadro "Publicación" y no hay diálogo.
//
// Supuestos de interfaz: ver el encabezado de ./ayudas/estado.ts (barra "Acciones del artículo", diálogo "Programar la
// publicación" con el campo "Fecha y hora de publicación" de tipo datetime-local y su botón "Programar", botón
// "Cancelar programación", `<time datetime>` con la fecha programada en la hora local, errores con el texto de
// `mensajeDeError`).
// Publicación automática: el cron `publicar-programados` de pg_cron corre cada minuto también en la base local
// (migración 20261019120700_programacion.sql), así que el caso de "se publica solo" se prueba de verdad, sin fixme.
// Se programa a 2 minutos y no a 1: el campo datetime-local pierde los segundos, así que "ahora + 1 minuto" puede
// quedar en el pasado cuando llega el clic y la base lo rechazaría. Con 2 minutos hay al menos 60 s de margen, y la
// espera máxima es 2 minutos de plazo + 1 de cron + 60 s del sitio (CE-003). Es un caso lento: tiene su propio timeout.
import { expect, test } from '@playwright/test';
import { articuloPorId, limpiarArticulosE2E, sembrarArticulo } from './ayudas/articulos';
import { fechaFutura, nombreDePrueba } from './ayudas/datos';
import {
  abrirDialogoProgramar,
  botonDeEstado,
  campoFechaProgramada,
  dialogoProgramar,
  enlaceVerEnElSitio,
  errorDelPanel,
  esperarEnElSitio,
  esperarEstado,
  fechaMostrada,
  programarArticulo,
  urlDelArticulo,
} from './ayudas/estado';
import { ingresar, USUARIOS } from './ayudas/sesion';

const PREFIJO = 'e2e-prog-';
const titulo = (etiqueta: string) => nombreDePrueba(`prog-${etiqueta}`);

test.afterAll(() => limpiarArticulosE2E(PREFIJO));

test.beforeEach(async ({ page }) => {
  await ingresar(page, USUARIOS.editor);
});

test.describe('Programar (H3-E3, E4)', () => {
  test('H3-E3: programar con una fecha futura deja el artículo "programado" con la fecha visible en la hora local', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('futura') });
    await page.goto(urlDelArticulo(articulo.id));
    const valor = fechaFutura(60 * 24); // mañana a esta hora, en la hora local del navegador

    await programarArticulo(page, valor);

    await esperarEstado(page, 'programado');
    await expect(dialogoProgramar(page)).toHaveCount(0); // el diálogo se cierra al programar
    const esperadaIso = new Date(valor).toISOString();
    await expect(fechaMostrada(page)).toHaveAttribute('datetime', esperadaIso);
    await expect(fechaMostrada(page)).toContainText(valor.slice(11)); // "HH:MM" local
    await expect(enlaceVerEnElSitio(page)).toHaveCount(0);
    const guardado = await articuloPorId(articulo.id);
    expect(guardado.estado).toBe('programado');
    expect(new Date(guardado.programado_para!).toISOString()).toBe(esperadaIso);
  });

  test('H3-E3: el campo de fecha no deja elegir un momento anterior a ahora (atributo min)', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('minimo') });
    await page.goto(urlDelArticulo(articulo.id));

    await abrirDialogoProgramar(page); // el campo está en el diálogo
    await expect(campoFechaProgramada(page)).toBeFocused(); // RF-018: el foco empieza en el campo
    const minimo = await campoFechaProgramada(page).getAttribute('min');

    expect(minimo).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(new Date(minimo!).getTime()).toBeGreaterThan(Date.now() - 120_000);
    expect(new Date(minimo!).getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  test('H3-E4: una fecha pasada se rechaza con un mensaje claro y el artículo sigue en borrador', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('pasada') });
    await page.goto(urlDelArticulo(articulo.id));

    await programarArticulo(page, fechaFutura(-60));

    // RF-018: el diálogo no se cierra, el mensaje aparece junto al campo y el foco vuelve a él.
    await expect(dialogoProgramar(page)).toBeVisible();
    await expect(dialogoProgramar(page).getByRole('alert')).toContainText(
      'Elige una fecha y hora que todavía no hayan pasado.',
    );
    await expect(campoFechaProgramada(page)).toBeFocused();
    await expect(campoFechaProgramada(page)).toHaveAccessibleDescription(/Elige una fecha y hora/);
    // Con el diálogo abierto el resto de la página queda inerte: se cierra para leer el estado.
    await page.keyboard.press('Escape');
    await esperarEstado(page, 'borrador');
    expect(await articuloPorId(articulo.id)).toMatchObject({ estado: 'borrador', programado_para: null });
  });

  test('H3-E4: programar sin elegir fecha no cambia el estado y avisa', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('sin fecha') });
    await page.goto(urlDelArticulo(articulo.id));

    await programarArticulo(page); // confirma sin completar la fecha

    await expect(dialogoProgramar(page)).toBeVisible();
    await expect(dialogoProgramar(page).getByRole('alert')).toContainText('Elige la fecha y hora de publicación.');
    await expect(campoFechaProgramada(page)).toBeFocused();
    expect((await articuloPorId(articulo.id)).estado).toBe('borrador');
  });

  test('H3-E4: "Cancelar" cierra el diálogo sin cambiar nada y devuelve el foco a "Programar"', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('cancelar dialogo') });
    await page.goto(urlDelArticulo(articulo.id));
    await abrirDialogoProgramar(page);
    await campoFechaProgramada(page).fill(fechaFutura(60 * 24));

    await dialogoProgramar(page).getByRole('button', { name: 'Cancelar', exact: true }).click();

    await expect(dialogoProgramar(page)).toHaveCount(0);
    await expect(botonDeEstado(page, 'Programar')).toBeFocused();
    await esperarEstado(page, 'borrador');
    expect((await articuloPorId(articulo.id)).estado).toBe('borrador');
  });

  test('H3-E4: con cambios sin guardar, "Programar" avisa que hay que guardar antes y no abre el diálogo', async ({
    page,
  }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('programar sucio') });
    await page.goto(urlDelArticulo(articulo.id));
    await page.getByLabel('Título', { exact: true }).fill(`${articulo.titulo} cambiado`);

    await botonDeEstado(page, 'Programar').click();

    await expect(errorDelPanel(page)).toContainText(/guarda.*antes/i);
    await expect(dialogoProgramar(page)).toHaveCount(0);
    expect((await articuloPorId(articulo.id)).estado).toBe('borrador');
  });
});

test.describe('Cancelar la programación (H3-E5)', () => {
  test('H3-E5: cancelar vuelve el artículo a borrador, sin fecha, y no se publica', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('cancelar') });
    await page.goto(urlDelArticulo(articulo.id));
    await programarArticulo(page, fechaFutura(60 * 24));
    await esperarEstado(page, 'programado');

    await botonDeEstado(page, 'Cancelar programación').click();

    await esperarEstado(page, 'borrador');
    await expect(fechaMostrada(page)).toHaveCount(0);
    await expect(botonDeEstado(page, 'Publicar')).toBeVisible();
    expect(await articuloPorId(articulo.id)).toMatchObject({ estado: 'borrador', programado_para: null });
    await esperarEnElSitio(page, articulo.slug, false, 5_000);
  });

  test('H3-E5: tras cancelar se puede programar de nuevo con otra fecha', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('reprogramar') });
    await page.goto(urlDelArticulo(articulo.id));
    await programarArticulo(page, fechaFutura(60 * 24));
    await esperarEstado(page, 'programado');
    await botonDeEstado(page, 'Cancelar programación').click();
    await esperarEstado(page, 'borrador');

    const otra = fechaFutura(60 * 48);
    await programarArticulo(page, otra);

    await esperarEstado(page, 'programado');
    await expect(fechaMostrada(page)).toHaveAttribute('datetime', new Date(otra).toISOString());
  });
});

test.describe('Publicación automática (H3-E3, CE-003)', () => {
  test('H3-E3: un artículo programado a 2 minutos se publica solo y aparece en el sitio', async ({ page }) => {
    test.setTimeout(6 * 60_000);
    const articulo = await sembrarArticulo({ titulo: titulo('se publica solo') });
    await page.goto(urlDelArticulo(articulo.id));
    await programarArticulo(page, fechaFutura(2));
    await esperarEstado(page, 'programado');
    await esperarEnElSitio(page, articulo.slug, false, 5_000);

    // El cron corre cada minuto: publica a lo sumo 60 s después de la hora elegida.
    await expect
      .poll(async () => (await articuloPorId(articulo.id)).estado, { timeout: 4 * 60_000, intervals: [5_000] })
      .toBe('publicado');
    await esperarEnElSitio(page, articulo.slug, true);

    await page.reload();
    await esperarEstado(page, 'publicado');
    await expect(enlaceVerEnElSitio(page)).toBeVisible();
    expect((await articuloPorId(articulo.id)).programado_para).toBeNull();
  });
});
