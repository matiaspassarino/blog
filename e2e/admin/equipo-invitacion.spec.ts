// T090 (spec 003, H6-E1 a E3, RF-026, RF-027, casos borde de enlaces). FASE ROJA: /equipo, el correo de invitación y el
// aviso de invitación inválida no existen aún. Supuestos de interfaz: ver ./ayudas/equipo.ts.
// Cada prueba invita a una cuenta nueva (correo único por corrida), lee el correo en Mailpit (research D22) y borra la
// cuenta al terminar. No se vacía la bandeja de Mailpit: otros specs corren en paralelo y usan sus propios correos.
import { expect, test } from '@playwright/test';
import {
  aceptarInvitacion,
  avisoDeError,
  avisoDeExito,
  botonDeFila,
  continuarConEnlace,
  correoUnico,
  estadoDeLaFila,
  filaDelMiembro,
  invitarPorLaInterfaz,
  MENSAJE_CORREO_EXISTENTE,
  perfilPorCorreo,
  selectorDeRol,
} from './ayudas/equipo';
import { nombreDePrueba } from './ayudas/datos';
import { enlaceDelCorreo, enOrigenLocal, esperarEnlaceDistinto } from './ayudas/mailpit';
import { eliminarPorCorreo } from './ayudas/servicio';
import { ingresar, USUARIOS } from './ayudas/sesion';

const MENSAJE_ENLACE_INVALIDO = 'Este enlace ya se usó o venció';
const MENSAJE_PEDIR_AL_ADMIN = /Pídele a un administrador que te envíe otra invitación/;

const correosCreados: string[] = [];
test.afterAll(async () => {
  for (const correo of correosCreados.splice(0)) await eliminarPorCorreo(correo);
});

test.beforeEach(async ({ page }) => {
  await ingresar(page, USUARIOS.admin, '/equipo');
});

/** Un correo nuevo, registrado para borrarlo al final. */
function correoDeInvitacion(etiqueta: string) {
  const correo = correoUnico(etiqueta);
  correosCreados.push(correo);
  return correo;
}

test.describe('Alta por invitación (H6-E1)', () => {
  test('H6-E1: el admin invita a un editor, llega el correo y, al definir la contraseña, queda activo y puede ingresar', async ({
    page,
    browser,
    baseURL,
  }) => {
    const correo = correoDeInvitacion('inv');
    const nombre = nombreDePrueba('invitada');
    const contrasenia = `nueva-${crypto.randomUUID()}`;

    await invitarPorLaInterfaz(page, { nombre, correo, rol: 'editor' });

    await expect(avisoDeExito(page, 'Invitación enviada')).toContainText(correo);
    const fila = filaDelMiembro(page, correo);
    await expect(fila).toContainText(nombre);
    await expect(estadoDeLaFila(fila)).toHaveText(/^invitado$/i);
    await expect(selectorDeRol(fila, nombre)).toHaveValue('editor');

    const enlace = await enlaceDelCorreo(correo);
    expect(enlace).toContain('/auth/confirmar');
    expect(enlace).toContain('type=invite');

    const invitada = await aceptarInvitacion(browser, baseURL!, enlace, contrasenia);
    await expect(invitada.page).toHaveURL(/\/articulos$/);
    await expect(invitada.page.getByRole('banner')).toContainText(nombre);
    await expect(invitada.page.getByRole('banner')).toContainText('Editor');
    await expect(
      invitada.page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Equipo' }),
    ).toHaveCount(0);

    // Tiene el rol pedido: un editor no entra a /equipo.
    await invitada.page.goto('/equipo');
    await expect(invitada.page.getByText('No tienes permiso para ver esta página')).toBeVisible();

    // La contraseña elegida sirve para volver a ingresar.
    await invitada.contexto.clearCookies();
    await ingresar(invitada.page, { correo, contrasenia });
    await invitada.contexto.close();

    // Y la lista del admin ya la muestra como activa.
    await page.reload();
    await expect(estadoDeLaFila(filaDelMiembro(page, correo))).toHaveText(/^activo$/i);
    expect(await perfilPorCorreo(correo)).toMatchObject({ rol: 'editor', activo: true });
  });

  test('H6-E1: se puede invitar a un administrador y la cuenta nace con ese rol', async ({ page }) => {
    const correo = correoDeInvitacion('inv-admin');
    const nombre = nombreDePrueba('invitada-admin');

    await invitarPorLaInterfaz(page, { nombre, correo, rol: 'admin' });

    await expect(avisoDeExito(page, 'Invitación enviada')).toBeVisible();
    await expect(selectorDeRol(filaDelMiembro(page, correo), nombre)).toHaveValue('admin');
    expect(await perfilPorCorreo(correo)).toMatchObject({ rol: 'admin' });
  });

  test('RF-027: sin nombre o con un correo inválido no se envía la invitación y se explica el problema', async ({
    page,
  }) => {
    const correo = correoUnico('inv-invalida');

    await invitarPorLaInterfaz(page, { nombre: '', correo });
    await expect(avisoDeError(page, /\S/)).toBeVisible();
    await expect(filaDelMiembro(page, correo)).toHaveCount(0);

    await invitarPorLaInterfaz(page, { nombre: 'Sin correo válido', correo: 'esto-no-es-un-correo' });
    await expect(avisoDeError(page, /\S/)).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Sin correo válido' })).toHaveCount(0);
  });
});

test.describe('Reenvío de la invitación (H6-E2)', () => {
  test('H6-E2: reenviar manda un correo nuevo, el enlace anterior ya no sirve y el nuevo sí', async ({
    page,
    browser,
    baseURL,
  }) => {
    const correo = correoDeInvitacion('reenvio');
    const nombre = nombreDePrueba('reenviada');
    const contrasenia = `nueva-${crypto.randomUUID()}`;
    await invitarPorLaInterfaz(page, { nombre, correo });
    await expect(avisoDeExito(page, 'Invitación enviada')).toBeVisible();
    const anterior = await enlaceDelCorreo(correo);

    await botonDeFila(filaDelMiembro(page, correo), 'Reenviar invitación a', nombre).click();

    await expect(avisoDeExito(page, 'Invitación reenviada')).toContainText(correo);
    await expect(estadoDeLaFila(filaDelMiembro(page, correo))).toHaveText(/^invitado$/i);
    const nuevo = await esperarEnlaceDistinto(correo, anterior);

    const viejo = await continuarConEnlace(browser, baseURL!, anterior);
    await expect(viejo.page.getByText(MENSAJE_ENLACE_INVALIDO)).toBeVisible();
    await viejo.contexto.close();

    const aceptada = await aceptarInvitacion(browser, baseURL!, nuevo, contrasenia);
    await expect(aceptada.page).toHaveURL(/\/articulos$/);
    await aceptada.contexto.close();
  });

  test('H6-E2: a quien ya definió su contraseña no se le ofrece reenviar la invitación', async ({ page }) => {
    const fila = filaDelMiembro(page, USUARIOS.editor.correo);

    await expect(estadoDeLaFila(fila)).toHaveText(/^activo$/i);
    await expect(fila.getByRole('button', { name: /^Reenviar invitación/ })).toHaveCount(0);
  });
});

test.describe('Correo repetido (H6-E3)', () => {
  test('H6-E3: invitar un correo que ya pertenece a un miembro se rechaza con un mensaje claro', async ({ page }) => {
    await invitarPorLaInterfaz(page, { nombre: 'Repetido', correo: USUARIOS.editor.correo });

    await expect(avisoDeError(page, MENSAJE_CORREO_EXISTENTE)).toBeVisible();
    await expect(filaDelMiembro(page, USUARIOS.editor.correo)).toHaveCount(1);
    await expect(page.getByRole('row').filter({ hasText: 'Repetido' })).toHaveCount(0);
  });

  test('H6-E3: invitar dos veces el mismo correo (la primera sigue pendiente) también se rechaza', async ({ page }) => {
    const correo = correoDeInvitacion('doble');
    const nombre = nombreDePrueba('doble');
    await invitarPorLaInterfaz(page, { nombre, correo });
    await expect(avisoDeExito(page, 'Invitación enviada')).toBeVisible();

    await invitarPorLaInterfaz(page, { nombre: 'Otra vez', correo });

    await expect(avisoDeError(page, MENSAJE_CORREO_EXISTENTE)).toBeVisible();
    await expect(filaDelMiembro(page, correo)).toHaveCount(1);
  });
});

test.describe('Casos borde de las invitaciones', () => {
  test('Casos borde: desactivar a un invitado antes de que acepte lo deja definir la contraseña, pero no entrar', async ({
    page,
    browser,
    baseURL,
  }) => {
    const correo = correoDeInvitacion('desactivado');
    const nombre = nombreDePrueba('desactivada');
    await invitarPorLaInterfaz(page, { nombre, correo });
    await expect(avisoDeExito(page, 'Invitación enviada')).toBeVisible();
    const enlace = await enlaceDelCorreo(correo);

    await botonDeFila(filaDelMiembro(page, correo), 'Desactivar', nombre).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Desactivar', exact: true }).click();
    await expect(estadoDeLaFila(filaDelMiembro(page, correo))).toHaveText(/^desactivado$/i);

    const invitada = await aceptarInvitacion(browser, baseURL!, enlace, `nueva-${crypto.randomUUID()}`);

    await expect(invitada.page).toHaveURL(/\/ingreso\?motivo=desactivada$/);
    await expect(invitada.page.getByText(/cuenta está desactivada/i)).toBeVisible();
    await invitada.page.goto('/articulos');
    await expect(invitada.page).toHaveURL(/\/ingreso/);
    await invitada.contexto.close();
  });

  test('Casos borde: un enlace de invitación ya usado indica pedirle al admin que reenvíe la invitación', async ({
    page,
    browser,
    baseURL,
  }) => {
    const correo = correoDeInvitacion('usado');
    await invitarPorLaInterfaz(page, { nombre: nombreDePrueba('usada'), correo });
    await expect(avisoDeExito(page, 'Invitación enviada')).toBeVisible();
    const enlace = await enlaceDelCorreo(correo);
    const aceptada = await aceptarInvitacion(browser, baseURL!, enlace, `nueva-${crypto.randomUUID()}`);
    await expect(aceptada.page).toHaveURL(/\/articulos$/);
    await aceptada.contexto.close();

    const segunda = await continuarConEnlace(browser, baseURL!, enlace);

    await expect(segunda.page.getByText(MENSAJE_ENLACE_INVALIDO)).toBeVisible();
    await expect(segunda.page.getByText(MENSAJE_PEDIR_AL_ADMIN)).toBeVisible();
    // Es una invitación: no se ofrece el formulario de recuperación de contraseña.
    await expect(segunda.page.getByLabel('Correo')).toHaveCount(0);
    await segunda.contexto.close();
  });

  test('Casos borde: abrir el enlace de la invitación sin pulsar Continuar no gasta el token', async ({
    page,
    browser,
    baseURL,
  }) => {
    const correo = correoDeInvitacion('previa');
    await invitarPorLaInterfaz(page, { nombre: nombreDePrueba('previa'), correo });
    await expect(avisoDeExito(page, 'Invitación enviada')).toBeVisible();
    const enlace = await enlaceDelCorreo(correo);

    const contexto = await browser.newContext({ baseURL: baseURL! });
    const visita = await contexto.newPage();
    await visita.goto(enOrigenLocal(enlace, baseURL!));
    await visita.goto(enOrigenLocal(enlace, baseURL!));
    await expect(visita.getByRole('button', { name: 'Continuar' })).toBeVisible();
    await contexto.close();

    const aceptada = await aceptarInvitacion(browser, baseURL!, enlace, `nueva-${crypto.randomUUID()}`);
    await expect(aceptada.page).toHaveURL(/\/articulos$/);
    await aceptada.contexto.close();
  });
});
