// T068 (spec 003, H3-E3, E4, E5, RF-013, D18). FASE ROJA: AccionesEstado (T072) no existe aún en /articulos/[id].
//
// Supuestos de interfaz: ver el encabezado de ./ayudas/estado.ts (campo "Fecha y hora de publicación" de tipo
// datetime-local, botones "Programar" y "Cancelar programación", `<time datetime>` con la fecha programada en la hora
// local, errores con el texto de `mensajeDeError`).
// Publicación automática: el cron `publicar-programados` de pg_cron corre cada minuto también en la base local
// (migración 20261019120700_programacion.sql), así que el caso de "se publica solo" se prueba de verdad, sin fixme.
// Se programa a 2 minutos y no a 1: el campo datetime-local pierde los segundos, así que "ahora + 1 minuto" puede
// quedar en el pasado cuando llega el clic y la base lo rechazaría. Con 2 minutos hay al menos 60 s de margen, y la
// espera máxima es 2 minutos de plazo + 1 de cron + 60 s del sitio (CE-003). Es un caso lento: tiene su propio timeout.
import { expect, test } from '@playwright/test';
import { articuloPorId, limpiarArticulosE2E, sembrarArticulo } from './ayudas/articulos';
import { fechaFutura, nombreDePrueba } from './ayudas/datos';
import {
  botonDeEstado,
  campoFechaProgramada,
  enlaceVerEnElSitio,
  errorDelPanel,
  esperarEnElSitio,
  esperarEstado,
  fechaMostrada,
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

    await campoFechaProgramada(page).fill(valor);
    await botonDeEstado(page, 'Programar').click();

    await esperarEstado(page, 'programado');
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

    const minimo = await campoFechaProgramada(page).getAttribute('min');

    expect(minimo).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(new Date(minimo!).getTime()).toBeGreaterThan(Date.now() - 120_000);
    expect(new Date(minimo!).getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  test('H3-E4: una fecha pasada se rechaza con un mensaje claro y el artículo sigue en borrador', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('pasada') });
    await page.goto(urlDelArticulo(articulo.id));

    await campoFechaProgramada(page).fill(fechaFutura(-60));
    await botonDeEstado(page, 'Programar').click();

    await expect(errorDelPanel(page)).toContainText('Elige una fecha y hora que todavía no hayan pasado.');
    await esperarEstado(page, 'borrador');
    expect(await articuloPorId(articulo.id)).toMatchObject({ estado: 'borrador', programado_para: null });
  });

  test('H3-E4: programar sin elegir fecha no cambia el estado y avisa', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('sin fecha') });
    await page.goto(urlDelArticulo(articulo.id));

    await botonDeEstado(page, 'Programar').click();

    await expect(errorDelPanel(page)).toBeVisible();
    expect((await articuloPorId(articulo.id)).estado).toBe('borrador');
  });
});

test.describe('Cancelar la programación (H3-E5)', () => {
  test('H3-E5: cancelar vuelve el artículo a borrador, sin fecha, y no se publica', async ({ page }) => {
    const articulo = await sembrarArticulo({ titulo: titulo('cancelar') });
    await page.goto(urlDelArticulo(articulo.id));
    await campoFechaProgramada(page).fill(fechaFutura(60 * 24));
    await botonDeEstado(page, 'Programar').click();
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
    await campoFechaProgramada(page).fill(fechaFutura(60 * 24));
    await botonDeEstado(page, 'Programar').click();
    await esperarEstado(page, 'programado');
    await botonDeEstado(page, 'Cancelar programación').click();
    await esperarEstado(page, 'borrador');

    const otra = fechaFutura(60 * 48);
    await campoFechaProgramada(page).fill(otra);
    await botonDeEstado(page, 'Programar').click();

    await esperarEstado(page, 'programado');
    await expect(fechaMostrada(page)).toHaveAttribute('datetime', new Date(otra).toISOString());
  });
});

test.describe('Publicación automática (H3-E3, CE-003)', () => {
  test('H3-E3: un artículo programado a 2 minutos se publica solo y aparece en el sitio', async ({ page }) => {
    test.setTimeout(6 * 60_000);
    const articulo = await sembrarArticulo({ titulo: titulo('se publica solo') });
    await page.goto(urlDelArticulo(articulo.id));
    await campoFechaProgramada(page).fill(fechaFutura(2));
    await botonDeEstado(page, 'Programar').click();
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
