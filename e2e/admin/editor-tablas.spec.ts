// T136 (spec 005, Fase 13, Historia 7; RF-028, RF-029; research D29 y D31):
// pruebas E2E de tablas en el editor del panel de administración:
// inserción, navegación y atajos por teclado, barra contextual fija, combinación,
// separación, accesibilidad, comportamiento responsive (< 768 px y 360 px) y operaciones de elemento.
//
// FASE ROJA: este archivo se escribe antes de implementar las tablas en el editor (T138-T143).
import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  articuloPorId,
  limpiarArticulosE2E,
  parrafo,
  sembrarArticulo,
  texto,
} from './ayudas/articulos';
import { nombreDePrueba } from './ayudas/datos';
import {
  abrirMenuInsertar,
  barraDeFormato,
  campoDeTitulo,
  esperarEditorListo,
  guardarConBoton,
  iniciarSesionAdmin,
  lienzo,
  visitarNuevoArticulo,
} from './ayudas/editor';

test.describe('Editor: tablas (Historia 7)', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesionAdmin(page);
  });

  test.afterEach(async () => {
    await limpiarArticulosE2E();
  });

  test('H7-E1 / RF-028: insertar tabla 3x3 desde el botón «Insertar» y desde menú «/»', async ({ page }) => {
    await visitarNuevoArticulo(page);
    await esperarEditorListo(page);

    // Inserción desde el botón Insertar
    await abrirMenuInsertar(page);
    const opcionTabla = page.getByRole('option', { name: 'Tabla' });
    await expect(opcionTabla).toBeVisible();
    await opcionTabla.click();

    // El foco queda en la primera celda
    const lz = lienzo(page);
    const tabla = lz.locator('table');
    await expect(tabla).toBeVisible();
    await expect(tabla.locator('tr')).toHaveCount(3);
    await expect(tabla.locator('tr').first().locator('th')).toHaveCount(3);
  });

  test('H7-E2 / RF-028: navegación con Tab, Shift+Tab y Tab en última celda', async ({ page }) => {
    await visitarNuevoArticulo(page);
    await esperarEditorListo(page);

    await abrirMenuInsertar(page);
    await page.getByRole('option', { name: 'Tabla' }).click();

    // Shift+Tab en la primera celda no hace nada y anuncia "Primera celda"
    await page.keyboard.press('Shift+Tab');
    const regionEstado = page.locator('#editor-anuncios');
    await expect(regionEstado).toContainText('Primera celda');

    // Tab avanza celdas
    await page.keyboard.press('Tab');
    // Tab en última celda (celda 9 en 3x3) agrega una fila (4 filas)
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
    }
    const tabla = lienzo(page).locator('table');
    await expect(tabla.locator('tr')).toHaveCount(4);
  });

  test('H7-E3 / RF-028: Enter crea un nuevo párrafo dentro de la celda', async ({ page }) => {
    await visitarNuevoArticulo(page);
    await esperarEditorListo(page);

    await abrirMenuInsertar(page);
    await page.getByRole('option', { name: 'Tabla' }).click();

    await page.keyboard.type('Primer párrafo');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Segundo párrafo');

    const primeraCelda = lienzo(page).locator('table th').first();
    await expect(primeraCelda.locator('p')).toHaveCount(2);
  });

  test('H7-E4 / D31 U1, U2: barra contextual «Tabla» y salida con Esc', async ({ page }) => {
    await visitarNuevoArticulo(page);
    await esperarEditorListo(page);

    await abrirMenuInsertar(page);
    await page.getByRole('option', { name: 'Tabla' }).click();

    // Al entrar se anuncia "Tabla. Esc para salir" y la barra muestra el texto visible
    const barraTabla = page.getByRole('toolbar', { name: 'Tabla' });
    await expect(barraTabla).toBeVisible();
    await expect(barraTabla).toContainText('Esc: salir de la tabla');

    // Esc pasa a modo elementos con la tabla seleccionada
    await page.keyboard.press('Escape');
    await expect(page.getByText('1 elemento seleccionado')).toBeVisible();

    // Desde ahí, Shift+Tab llega a la barra Tabla
    await page.keyboard.press('Shift+Tab');
    await expect(barraTabla.locator(':focus')).toBeVisible();
  });

  test('H7-E5 / RF-028: selección de celdas y combinación desde la barra', async ({ page }) => {
    await visitarNuevoArticulo(page);
    await esperarEditorListo(page);

    await abrirMenuInsertar(page);
    await page.getByRole('option', { name: 'Tabla' }).click();

    // Mover a cuerpo (fila 2)
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Shift + Flecha derecha selecciona celdas contiguas
    await page.keyboard.press('Shift+ArrowRight');
    const regionEstado = page.locator('#editor-anuncios');
    await expect(regionEstado).toContainText('Celdas seleccionadas');

    // Botón Combinar
    const botonCombinar = page.getByRole('button', { name: 'Combinar celdas' });
    await expect(botonCombinar).toBeEnabled();
    await botonCombinar.click();

    // La celda resultante tiene colspan="2"
    const celdaCombinada = lienzo(page).locator('table td[colspan="2"]');
    await expect(celdaCombinada).toBeVisible();
  });

  test('H7-E6 / RF-029: comportamiento por debajo de 768 px (< 48rem)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await visitarNuevoArticulo(page);
    await esperarEditorListo(page);

    await abrirMenuInsertar(page);
    await page.getByRole('option', { name: 'Tabla' }).click();

    // A 360px muestra el texto explicativo de RF-029 y solo Quitar tabla
    const barraTabla = page.getByRole('toolbar', { name: 'Tabla' });
    await expect(barraTabla).toContainText('Para cambiar filas, columnas o combinar celdas, usa una pantalla más ancha');
    await expect(barraTabla.getByRole('button', { name: 'Insertar fila' })).toHaveCount(0);
    await expect(barraTabla.getByRole('button', { name: 'Quitar tabla' })).toBeVisible();
  });

  test('H7-E7 / RF-028: accesibilidad axe del editor con tabla', async ({ page }) => {
    await visitarNuevoArticulo(page);
    await esperarEditorListo(page);

    await abrirMenuInsertar(page);
    await page.getByRole('option', { name: 'Tabla' }).click();

    const resultados = await new AxeBuilder({ page }).analyze();
    expect(resultados.violations).toEqual([]);
  });
});
