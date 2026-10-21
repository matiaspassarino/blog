// T041 (spec 003, H1-E1 a E7 y casos borde de enlaces). FASE ROJA: /ingreso y sus pantallas no existen aún.
//
// Supuestos de interfaz (T045/T046), a confirmar al implementar:
//   - /ingreso: h1 "Ingresar al panel"; campos "Correo" y "Contraseña"; botón "Ingresar"; enlace "¿Olvidaste tu contraseña?".
//     Errores en un elemento `role="alert"`:
//       credenciales: "Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo"
//       desactivada:  "Tu cuenta está desactivada. Contacta a una persona administradora"
//     Con error se conserva el correo y se vacía la contraseña.
//   - Cabecera del panel (`banner`): muestra el nombre del miembro y su rol ("Administrador" | "Editor") y un
//     botón "Cerrar sesión".
//   - /olvide-contrasena: campo "Correo", botón "Enviar enlace"; respuesta en `role="status"`:
//       "Si el correo pertenece al equipo, te enviamos un enlace. Revisa también la carpeta de spam".
//   - /auth/confirmar: botón "Continuar". Enlace usado o vencido: texto "Este enlace ya se usó o venció" y, para
//     recuperación, un formulario con el campo "Correo" para pedir uno nuevo.
//   - /definir-contrasena: campos "Nueva contraseña" y "Repite la contraseña" (se buscan por /nueva/ y /repit/),
//     regla visible "Al menos 8 caracteres", botón "Guardar contraseña"; el error de largo en `role="alert"`.
// Limitación: la recuperación envía correos reales a Mailpit y `[auth.rate_limit] email_sent = 2` por hora
// puede cortar la repetición de la suite: subirlo en supabase/config.toml (solo local) junto con T043.
import { expect, test, type Page } from '@playwright/test';
import { cantidadDeCorreos, enlaceDelCorreo } from './ayudas/mailpit';
import { crearMiembro, type MiembroDePrueba } from './ayudas/servicio';
import { ingresar, USUARIOS } from './ayudas/sesion';

const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo';
const MENSAJE_DESACTIVADA = 'Tu cuenta está desactivada. Contacta a una persona administradora';
const MENSAJE_RECUPERACION =
  'Si el correo pertenece al equipo, te enviamos un enlace. Revisa también la carpeta de spam';

const miembros: MiembroDePrueba[] = [];
test.afterEach(async () => {
  for (const miembro of miembros.splice(0)) await miembro.eliminar();
});

async function nuevoMiembro(nombre: string) {
  const miembro = await crearMiembro(nombre);
  miembros.push(miembro);
  return miembro;
}

async function enviarFormularioDeIngreso(page: Page, correo: string, contrasenia: string) {
  await page.getByLabel('Correo').fill(correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(contrasenia);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

const alerta = (page: Page, texto: string) => page.getByRole('alert').filter({ hasText: texto });

/** El enlace del correo trae el origen de `site_url` (127.0.0.1); se usa el del navegador para compartir cookies. */
function enOrigenLocal(enlace: string, page: Page) {
  const destino = new URL(enlace);
  const base = new URL(page.url());
  return `${base.origin}${destino.pathname}${destino.search}`;
}

test.describe('Ingreso al panel (H1)', () => {
  test('H1-E1: la editora ingresa y ve su nombre y su rol', async ({ page }) => {
    await ingresar(page, USUARIOS.editora);
    const cabecera = page.getByRole('banner');
    await expect(cabecera).toContainText(USUARIOS.editora.nombre);
    await expect(cabecera).toContainText('Editor');
  });

  test('H1-E1: la admin ingresa y ve su nombre y su rol', async ({ page }) => {
    await ingresar(page, USUARIOS.admin);
    const cabecera = page.getByRole('banner');
    await expect(cabecera).toContainText(USUARIOS.admin.nombre);
    await expect(cabecera).toContainText('Administrador');
  });

  test('H1-E2: una contraseña incorrecta muestra el mensaje genérico y conserva el correo', async ({ page }) => {
    await page.goto('/ingreso');
    await enviarFormularioDeIngreso(page, USUARIOS.editor.correo, 'contrasenia-equivocada');

    await expect(alerta(page, MENSAJE_CREDENCIALES)).toBeVisible();
    await expect(page.getByLabel('Correo')).toHaveValue(USUARIOS.editor.correo);
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('');
    await expect(page).toHaveURL(/\/ingreso/);
  });

  test('H1-E2: un correo inexistente muestra exactamente el mismo mensaje', async ({ page }) => {
    await page.goto('/ingreso');
    await enviarFormularioDeIngreso(page, 'nadie@demo.local', 'contrasenia-equivocada');

    await expect(alerta(page, MENSAJE_CREDENCIALES)).toBeVisible();
    await expect(page.getByLabel('Correo')).toHaveValue('nadie@demo.local');
  });

  test('H1-E3: un miembro desactivado ve el aviso de cuenta desactivada y no accede a ninguna pantalla', async ({
    page,
  }) => {
    const miembro = await nuevoMiembro('e2e-desactivado');
    await miembro.desactivar();

    await page.goto('/ingreso');
    await enviarFormularioDeIngreso(page, miembro.correo, miembro.contrasenia);

    await expect(alerta(page, MENSAJE_DESACTIVADA)).toBeVisible();
    await expect(page).toHaveURL(/\/ingreso/);
    for (const ruta of ['/articulos', '/articulos/nuevo', '/perfil']) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/ingreso/);
    }
  });

  test('H1-E4: abrir /articulos sin sesión lleva a /ingreso?volver=/articulos y, al ingresar, vuelve ahí', async ({
    page,
  }) => {
    await page.goto('/articulos');
    await expect(page).toHaveURL(/\/ingreso\?/);
    expect(new URL(page.url()).searchParams.get('volver')).toBe('/articulos');

    await enviarFormularioDeIngreso(page, USUARIOS.editor.correo, USUARIOS.editor.contrasenia);
    await expect(page).toHaveURL(/\/articulos$/);
  });

  test('H1-E4: una ruta con consulta también se recupera al ingresar', async ({ page }) => {
    await page.goto('/articulos?estado=borrador');
    expect(new URL(page.url()).searchParams.get('volver')).toBe('/articulos?estado=borrador');

    await enviarFormularioDeIngreso(page, USUARIOS.editor.correo, USUARIOS.editor.contrasenia);
    await expect(page).toHaveURL(/\/articulos\?estado=borrador$/);
  });

  test('H1-E4: ?volver=//evil.com no redirige fuera del panel', async ({ page }) => {
    await page.goto('/ingreso?volver=' + encodeURIComponent('//evil.com'));
    await enviarFormularioDeIngreso(page, USUARIOS.editor.correo, USUARIOS.editor.contrasenia);

    await expect(page).toHaveURL(/\/articulos$/);
    expect(new URL(page.url()).origin).toBe(new URL(test.info().project.use.baseURL!).origin);
  });

  test('H1-E5: cerrar sesión vuelve al ingreso y /articulos pide ingresar de nuevo', async ({ page }) => {
    await ingresar(page, USUARIOS.editor);

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/ingreso/);

    await page.goto('/articulos');
    await expect(page).toHaveURL(/\/ingreso\?/);
    expect(new URL(page.url()).searchParams.get('volver')).toBe('/articulos');
  });

  test('H1-E6: desactivar a un editor con sesión abierta lo saca en su siguiente acción', async ({ page, context }) => {
    const miembro = await nuevoMiembro('e2e-expulsado');
    await ingresar(page, miembro);
    expect((await context.cookies()).some((c) => c.name === 'blog_actividad')).toBe(true);

    await miembro.desactivar();
    const visitadas: string[] = [];
    page.on('request', (peticion) => visitadas.push(new URL(peticion.url()).pathname + new URL(peticion.url()).search));

    await page.goto('/articulos');

    await expect(page).toHaveURL(/\/ingreso\?motivo=desactivada$/);
    expect(visitadas).toContain('/salir?motivo=desactivada');
    await expect(page.getByText(/cuenta está desactivada/i)).toBeVisible();
    const cookies = await context.cookies();
    expect(cookies.filter((c) => /auth-token/.test(c.name))).toEqual([]);
    expect(cookies.some((c) => c.name === 'blog_actividad')).toBe(false);
  });

  test('H1-E7: recuperación completa con un correo existente y enlace de un solo uso', async ({ page, context }) => {
    const miembro = await nuevoMiembro('e2e-recupera');
    const nueva = `nueva-${crypto.randomUUID()}`;
    let enlace = '';

    await test.step('pedir el enlace desde la pantalla de ingreso', async () => {
      await page.goto('/ingreso');
      await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
      await expect(page).toHaveURL(/\/olvide-contrasena/);
      await page.getByLabel('Correo').fill(miembro.correo);
      await page.getByRole('button', { name: 'Enviar enlace' }).click();
      await expect(page.getByRole('status').filter({ hasText: MENSAJE_RECUPERACION })).toBeVisible();
      enlace = enOrigenLocal(await enlaceDelCorreo(miembro.correo), page);
    });

    await test.step('abrir el enlace sin hacer clic en Continuar no consume el token', async () => {
      await page.goto(enlace);
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
      await page.goto(enlace);
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
      await expect(page.getByText('Este enlace ya se usó o venció')).toHaveCount(0);
    });

    await test.step('Continuar lleva a definir la contraseña, que explica la regla y exige 8 caracteres', async () => {
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page).toHaveURL(/\/definir-contrasena/);
      await expect(page.getByText('Al menos 8 caracteres')).toBeVisible();

      await page.getByLabel(/nueva/i).fill('corta12');
      await page.getByLabel(/repit/i).fill('corta12');
      await page.getByRole('button', { name: 'Guardar contraseña' }).click();
      await expect(page.getByRole('alert').filter({ hasText: /8 caracteres/ })).toBeVisible();
    });

    await test.step('con una contraseña válida entra al panel', async () => {
      await page.getByLabel(/nueva/i).fill(nueva);
      await page.getByLabel(/repit/i).fill(nueva);
      await page.getByRole('button', { name: 'Guardar contraseña' }).click();
      await expect(page).toHaveURL(/\/articulos$/);
    });

    await test.step('reutilizar el enlace ya usado ofrece pedir uno nuevo', async () => {
      await context.clearCookies();
      await page.goto(enlace);
      await page.getByRole('button', { name: 'Continuar' }).click();
      await expect(page.getByText('Este enlace ya se usó o venció')).toBeVisible();
      await expect(page.getByLabel('Correo')).toBeVisible();
    });

    await test.step('la contraseña nueva sirve para ingresar', async () => {
      await ingresar(page, { correo: miembro.correo, contrasenia: nueva });
    });
  });

  test('H1-E7: con un correo inexistente muestra el mismo mensaje y no envía ningún correo', async ({ page }) => {
    const inexistente = `e2e-nadie-${crypto.randomUUID().slice(0, 8)}@demo.local`;
    await page.goto('/olvide-contrasena');
    await page.getByLabel('Correo').fill(inexistente);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();

    await expect(page.getByRole('status').filter({ hasText: MENSAJE_RECUPERACION })).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await cantidadDeCorreos(inexistente)).toBe(0);
  });

  test('Casos borde: un enlace con un token inventado explica que ya se usó o venció', async ({ page }) => {
    await page.goto('/auth/confirmar?token_hash=inventado&type=recovery');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText('Este enlace ya se usó o venció')).toBeVisible();
    await expect(page.getByLabel('Correo')).toBeVisible();
  });

  test('Casos borde: una invitación inválida indica pedirle al administrador que la reenvíe', async ({ page }) => {
    await page.goto('/auth/confirmar?token_hash=inventado&type=invite');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(page.getByText('Este enlace ya se usó o venció')).toBeVisible();
    await expect(page.getByText(/administrador/i)).toBeVisible();
    await expect(page.getByLabel('Correo')).toHaveCount(0);
  });
});
