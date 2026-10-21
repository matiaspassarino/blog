// Ayudas de los E2E del equipo (spec 003, H6). FASE ROJA: /equipo (T096, T097) y el correo de invitación (T093) no existen aún.
//
// CONTRATO DE INTERFAZ SUPUESTO (T096/T097). Si la interfaz real difiere, se ajusta aquí, en un solo lugar.
//   - `/equipo` (solo admin): `h1` "Equipo".
//   - Invitación: un formulario con nombre accesible "Invitar a una persona" (`role="form"`, por `aria-label`), con los campos
//     "Nombre", "Correo" y "Rol" (`<select>` con los valores `editor` y `admin`) y el botón "Enviar invitación". Con éxito
//     aparece un `role="status"` "Invitación enviada a <correo>" y el formulario se vacía; los errores salen en `role="alert"`
//     con el texto de la acción ("Ese correo ya pertenece al equipo").
//   - Tabla (`role="table"`) con columnas "Nombre", "Correo", "Rol", "Estado" y "Acciones". Cada fila se ubica por su correo.
//     El estado es el texto visible de un `Badge`: "Invitado", "Activo" o "Desactivado".
//   - Cambio de rol: un `<select>` con etiqueta "Rol de <nombre>" (valores `editor` y `admin`) que aplica el cambio al elegir
//     (sin botón aparte); éxito en `role="status"` ("Rol actualizado"), error en `role="alert"` y, si falla, el selector
//     vuelve al valor guardado.
//   - Botones de fila (nombre accesible exacto): "Desactivar <nombre>" (abre un `alertdialog` con "Cancelar" y el botón de
//     confirmación "Desactivar"), "Reactivar <nombre>" (sin confirmación) y "Reenviar invitación a <nombre>" (solo si el estado
//     es "Invitado"; éxito en `role="status"`: "Invitación reenviada a <correo>").
//   - Navegación (`nav` "Principal"): el enlace "Equipo" solo existe para el admin; "Mi perfil" para todos.
//   - Un editor que abre `/equipo` ve "No tienes permiso para ver esta página" (`forbidden()`), no la lista.
//   - `/auth/confirmar` con una invitación inválida (usada o vencida): "Este enlace ya se usó o venció" y "Pídele a un
//     administrador que te envíe otra invitación", sin el formulario de recuperación (campo "Correo").
//   - Cabecera (`banner`): nombre y rol del miembro ("Administrador" | "Editor").
import { expect, type Browser, type Locator, type Page } from '@playwright/test';
import { enOrigenLocal } from './mailpit';
import { servicio } from './servicio';

export const ID_ADMIN_DEMO = '00000000-0000-4000-a000-000000000001';
export const MENSAJE_ULTIMO_ADMIN = 'Siempre tiene que quedar al menos un administrador activo.';
export const MENSAJE_CORREO_EXISTENTE = 'Ese correo ya pertenece al equipo';

export type RolDeEquipo = 'editor' | 'admin';

/** Correo único por corrida: las invitaciones crean cuentas reales en Auth y cada spec las borra al terminar. */
export const correoUnico = (etiqueta: string) => `e2e-${etiqueta}-${crypto.randomUUID().slice(0, 8)}@demo.local`;

export const formularioDeInvitacion = (page: Page) =>
  page.getByRole('form', { name: 'Invitar a una persona', exact: true });

export async function invitarPorLaInterfaz(page: Page, datos: { nombre: string; correo: string; rol?: RolDeEquipo }) {
  const formulario = formularioDeInvitacion(page);
  await formulario.getByLabel('Nombre', { exact: true }).fill(datos.nombre);
  await formulario.getByLabel('Correo', { exact: true }).fill(datos.correo);
  await formulario.getByLabel('Rol', { exact: true }).selectOption({ value: datos.rol ?? 'editor' });
  await formulario.getByRole('button', { name: 'Enviar invitación', exact: true }).click();
}

export const filaDelMiembro = (page: Page, correo: string): Locator =>
  page.getByRole('row').filter({ has: page.getByText(correo, { exact: true }) });

/** Texto del `Badge` de acceso de una fila: "Invitado", "Activo" o "Desactivado". */
export const estadoDeLaFila = (fila: Locator): Locator => fila.getByText(/^(invitado|activo|desactivado)$/i);

export const selectorDeRol = (fila: Locator, nombre: string): Locator =>
  fila.getByLabel(`Rol de ${nombre}`, { exact: true });

export const botonDeFila = (
  fila: Locator,
  accion: 'Desactivar' | 'Reactivar' | 'Reenviar invitación a',
  nombre: string,
) => fila.getByRole('button', { name: `${accion} ${nombre}`, exact: true });

export const avisoDeExito = (page: Page, texto: string | RegExp) => page.getByRole('status').filter({ hasText: texto });
export const avisoDeError = (page: Page, texto: string | RegExp) => page.getByRole('alert').filter({ hasText: texto });

/**
 * Abre el enlace del correo en un navegador aparte (la persona invitada no comparte cookies con el admin), pulsa
 * "Continuar", define la contraseña y devuelve la página. No comprueba adónde llega: lo hace cada prueba.
 */
export async function aceptarInvitacion(browser: Browser, baseURL: string, enlace: string, contrasenia: string) {
  const contexto = await browser.newContext({ baseURL });
  const page = await contexto.newPage();
  await page.goto(enOrigenLocal(enlace, baseURL));
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/definir-contrasena/);
  await page.getByLabel(/nueva/i).fill(contrasenia);
  await page.getByLabel(/repit/i).fill(contrasenia);
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  return { page, contexto };
}

/** Abre un enlace de invitación en un navegador aparte y pulsa "Continuar" (para los enlaces usados o vencidos). */
export async function continuarConEnlace(browser: Browser, baseURL: string, enlace: string) {
  const contexto = await browser.newContext({ baseURL });
  const page = await contexto.newPage();
  await page.goto(enOrigenLocal(enlace, baseURL));
  await page.getByRole('button', { name: 'Continuar' }).click();
  return { page, contexto };
}

/** Red de seguridad: si una prueba del único admin aplicó el cambio por error, el seed quedaría sin admin. */
export async function restaurarAdminDemo() {
  await servicio().from('perfiles').update({ rol: 'admin', activo: true }).eq('id', ID_ADMIN_DEMO);
}

export async function perfilPorId(id: string) {
  const { data } = await servicio().from('perfiles').select('*').eq('id', id).maybeSingle();
  return data;
}

export async function perfilPorCorreo(correo: string) {
  const s = servicio();
  const { data } = await s.auth.admin.listUsers({ perPage: 200 });
  const usuario = data.users.find((u) => u.email === correo);
  return usuario ? perfilPorId(usuario.id) : null;
}

/**
 * Espera (hasta 15 s) a que el admin demo sea el único admin activo. Otro spec puede estar invitando a un admin en
 * paralelo; mientras exista, "quitarle el rol al único admin" no es el caso que estas pruebas quieren comprobar.
 */
export async function esperarUnicoAdmin(timeout = 15_000) {
  await expect
    .poll(
      async () => {
        const { data } = await servicio()
          .from('perfiles')
          .select('id')
          .eq('rol', 'admin')
          .eq('activo', true)
          .neq('id', ID_ADMIN_DEMO);
        return data?.length ?? 0;
      },
      { timeout, message: 'otro admin activo impide probar el caso del único admin' },
    )
    .toBe(0);
}
