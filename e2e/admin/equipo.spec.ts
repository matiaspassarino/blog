// T091 (spec 003, H6-E4 a E6, RF-021, RF-024). FASE ROJA: /equipo no existe aún. Supuestos de interfaz: ver ./ayudas/equipo.ts.
// Los miembros de prueba se crean y se borran con la clave de servicio (ayudas/servicio.ts); el único admin es el del seed,
// así que `afterEach` lo restaura por si una prueba lo degradara por error.
import { expect, test, type Browser } from '@playwright/test';
import { nombreDePrueba } from './ayudas/datos';
import {
  avisoDeError,
  avisoDeExito,
  botonDeFila,
  esperarUnicoAdmin,
  estadoDeLaFila,
  filaDelMiembro,
  ID_ADMIN_DEMO,
  MENSAJE_ULTIMO_ADMIN,
  perfilPorId,
  restaurarAdminDemo,
  selectorDeRol,
} from './ayudas/equipo';
import { crearMiembro, type MiembroDePrueba } from './ayudas/servicio';
import { ingresar, USUARIOS } from './ayudas/sesion';

const miembros: MiembroDePrueba[] = [];

test.afterEach(async () => {
  await restaurarAdminDemo();
  for (const miembro of miembros.splice(0)) await miembro.eliminar();
});

async function nuevoMiembro(etiqueta: string) {
  const nombre = nombreDePrueba(etiqueta);
  const miembro = await crearMiembro(nombre);
  miembros.push(miembro);
  return { ...miembro, nombre };
}

/** El miembro, en su propio navegador, ya con sesión: así se ve "lo que puede hacer desde su siguiente acción". */
async function sesionDelMiembro(browser: Browser, baseURL: string, miembro: { correo: string; contrasenia: string }) {
  const contexto = await browser.newContext({ baseURL });
  const page = await contexto.newPage();
  await ingresar(page, miembro);
  return { page, contexto };
}

test.describe('Cambio de rol (H6-E4)', () => {
  test('H6-E4: el admin cambia el rol de un editor a admin y de vuelta, y el miembro lo nota en su siguiente acción', async ({
    page,
    browser,
    baseURL,
  }) => {
    const miembro = await nuevoMiembro('rol');
    const suya = await sesionDelMiembro(browser, baseURL!, miembro);
    await suya.page.goto('/equipo');
    await expect(suya.page.getByText('No tienes permiso para ver esta página')).toBeVisible();
    await ingresar(page, USUARIOS.admin, '/equipo');
    const fila = filaDelMiembro(page, miembro.correo);

    await selectorDeRol(fila, miembro.nombre).selectOption({ value: 'admin' });

    await expect(avisoDeExito(page, 'Rol actualizado')).toBeVisible();
    expect((await perfilPorId(miembro.id))?.rol).toBe('admin');
    await page.reload();
    await expect(selectorDeRol(filaDelMiembro(page, miembro.correo), miembro.nombre)).toHaveValue('admin');
    await suya.page.goto('/equipo');
    await expect(suya.page.getByRole('heading', { level: 1, name: 'Equipo', exact: true })).toBeVisible();

    await selectorDeRol(filaDelMiembro(page, miembro.correo), miembro.nombre).selectOption({ value: 'editor' });

    await expect(avisoDeExito(page, 'Rol actualizado')).toBeVisible();
    expect((await perfilPorId(miembro.id))?.rol).toBe('editor');
    await suya.page.goto('/equipo');
    await expect(suya.page.getByText('No tienes permiso para ver esta página')).toBeVisible();
    await suya.contexto.close();
  });
});

test.describe('Desactivar y reactivar (H6-E4)', () => {
  test('H6-E4: desactivar pide confirmación; al confirmar, el miembro es expulsado en su siguiente acción y al reactivar vuelve a entrar', async ({
    page,
    browser,
    baseURL,
  }) => {
    const miembro = await nuevoMiembro('baja');
    const suya = await sesionDelMiembro(browser, baseURL!, miembro);
    await ingresar(page, USUARIOS.admin, '/equipo');
    const fila = filaDelMiembro(page, miembro.correo);
    await expect(estadoDeLaFila(fila)).toHaveText(/^activo$/i);

    await test.step('cancelar la confirmación no cambia nada', async () => {
      await botonDeFila(fila, 'Desactivar', miembro.nombre).click();
      const confirmacion = page.getByRole('alertdialog');
      await expect(confirmacion).toBeVisible();
      await expect(confirmacion).toContainText(miembro.nombre);
      await expect(confirmacion.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
      await confirmacion.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(confirmacion).toHaveCount(0);
      await expect(estadoDeLaFila(fila)).toHaveText(/^activo$/i);
      expect((await perfilPorId(miembro.id))?.activo).toBe(true);
    });

    await test.step('confirmar desactiva al miembro y se ve en la lista', async () => {
      await botonDeFila(fila, 'Desactivar', miembro.nombre).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Desactivar', exact: true }).click();

      await expect(estadoDeLaFila(fila)).toHaveText(/^desactivado$/i);
      expect((await perfilPorId(miembro.id))?.activo).toBe(false);
      await expect(botonDeFila(fila, 'Reactivar', miembro.nombre)).toBeVisible();
    });

    await test.step('el miembro, con la sesión abierta, es expulsado en su siguiente acción', async () => {
      await suya.page.goto('/articulos');
      await expect(suya.page).toHaveURL(/\/ingreso\?motivo=desactivada$/);
      await expect(suya.page.getByText(/cuenta está desactivada/i)).toBeVisible();
    });

    await test.step('reactivar no pide confirmación y devuelve el acceso', async () => {
      await botonDeFila(fila, 'Reactivar', miembro.nombre).click();

      await expect(estadoDeLaFila(fila)).toHaveText(/^activo$/i);
      expect((await perfilPorId(miembro.id))?.activo).toBe(true);
      await ingresar(suya.page, miembro);
    });
    await suya.contexto.close();
  });
});

test.describe('El único admin (H6-E5)', () => {
  test.beforeEach(async ({ page }) => {
    await esperarUnicoAdmin();
    await ingresar(page, USUARIOS.admin, '/equipo');
  });

  test('H6-E5: quitarse el rol siendo el único admin se rechaza y el selector vuelve a "admin"', async ({ page }) => {
    const fila = filaDelMiembro(page, USUARIOS.admin.correo);

    await selectorDeRol(fila, USUARIOS.admin.nombre).selectOption({ value: 'editor' });

    await expect(avisoDeError(page, MENSAJE_ULTIMO_ADMIN)).toBeVisible();
    await expect(selectorDeRol(fila, USUARIOS.admin.nombre)).toHaveValue('admin');
    expect(await perfilPorId(ID_ADMIN_DEMO)).toMatchObject({ rol: 'admin', activo: true });
    await page.reload();
    await expect(selectorDeRol(filaDelMiembro(page, USUARIOS.admin.correo), USUARIOS.admin.nombre)).toHaveValue(
      'admin',
    );
  });

  test('H6-E5: desactivarse siendo el único admin se rechaza aunque se confirme, y sigue activo', async ({ page }) => {
    const fila = filaDelMiembro(page, USUARIOS.admin.correo);

    await botonDeFila(fila, 'Desactivar', USUARIOS.admin.nombre).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Desactivar', exact: true }).click();

    await expect(avisoDeError(page, MENSAJE_ULTIMO_ADMIN)).toBeVisible();
    await expect(estadoDeLaFila(fila)).toHaveText(/^activo$/i);
    expect(await perfilPorId(ID_ADMIN_DEMO)).toMatchObject({ rol: 'admin', activo: true });
    // Su sesión sigue en pie: puede seguir usando el panel.
    await page.goto('/articulos');
    await expect(page).toHaveURL(/\/articulos$/);
  });

  test('H6-E5: con otro admin activo, el primero sí puede dejar de serlo', async ({ page }) => {
    const miembro = await nuevoMiembro('segundo-admin');
    const fila = filaDelMiembro(page, miembro.correo);
    await selectorDeRol(fila, miembro.nombre).selectOption({ value: 'admin' });
    await expect(avisoDeExito(page, 'Rol actualizado')).toBeVisible();

    await selectorDeRol(filaDelMiembro(page, USUARIOS.admin.correo), USUARIOS.admin.nombre).selectOption({
      value: 'editor',
    });

    await expect(avisoDeExito(page, 'Rol actualizado')).toBeVisible();
    expect((await perfilPorId(ID_ADMIN_DEMO))?.rol).toBe('editor');
    // `afterEach` restaura al admin demo.
  });
});

test.describe('Quién ve el equipo (H6-E6)', () => {
  test('H6-E6: un editor no ve "Equipo" en la navegación y /equipo le responde "No tienes permiso"', async ({
    page,
  }) => {
    await ingresar(page, USUARIOS.editor);

    const navegacion = page.getByRole('navigation', { name: 'Principal' });
    await expect(navegacion.getByRole('link', { name: 'Mi perfil' })).toBeVisible();
    await expect(navegacion.getByRole('link', { name: 'Equipo' })).toHaveCount(0);

    const respuesta = await page.goto('/equipo');
    expect(respuesta?.status()).toBe(403);
    await expect(page.getByText('No tienes permiso para ver esta página')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByText(USUARIOS.admin.correo)).toHaveCount(0);
  });

  test('H6-E6: el admin ve "Equipo" en la navegación y la lista con nombre, correo, rol y estado', async ({ page }) => {
    await ingresar(page, USUARIOS.admin);

    await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Equipo' }).click();

    await expect(page).toHaveURL(/\/equipo$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Equipo', exact: true })).toBeVisible();
    for (const columna of ['Nombre', 'Correo', 'Rol', 'Estado', 'Acciones']) {
      await expect(page.getByRole('columnheader', { name: columna, exact: true })).toBeVisible();
    }
    for (const demo of [USUARIOS.admin, USUARIOS.editora, USUARIOS.editor]) {
      const fila = filaDelMiembro(page, demo.correo);
      await expect(fila).toContainText(demo.nombre);
      await expect(estadoDeLaFila(fila)).toHaveText(/^activo$/i);
    }
    await expect(selectorDeRol(filaDelMiembro(page, USUARIOS.admin.correo), USUARIOS.admin.nombre)).toHaveValue(
      'admin',
    );
    await expect(selectorDeRol(filaDelMiembro(page, USUARIOS.editor.correo), USUARIOS.editor.nombre)).toHaveValue(
      'editor',
    );
  });

  test('H6-E6: sin sesión, /equipo lleva al ingreso con la ruta para volver', async ({ page }) => {
    await page.goto('/equipo');

    await expect(page).toHaveURL(/\/ingreso\?volver=%2Fequipo/);
  });
});
