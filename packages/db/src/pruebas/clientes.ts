// Clientes Supabase para tests de integración. Solo para tests.
import { inject } from 'vitest';
import { crearClientePublico } from '../cliente';

const entorno = inject('supabase');

/** `describe.skipIf(sinSupabase)` para suites que necesitan la base local. */
export const sinSupabase = entorno === null;

function requerirEntorno() {
  if (!entorno) throw new Error('Supabase local no disponible');
  return entorno;
}

export function clienteAnon() {
  const { url, claveAnon } = requerirEntorno();
  return crearClientePublico(url, claveAnon);
}

/** Cliente con la sesión de un usuario demo (ver quickstart.md, "Usuarios de demo"). */
export async function clienteComo(email: string, contrasenia: string) {
  const cliente = clienteAnon();
  const { error } = await cliente.auth.signInWithPassword({ email, password: contrasenia });
  if (error) throw new Error(`No se pudo iniciar sesión como ${email}: ${error.message}`);
  return cliente;
}

/** Sesiones de los usuarios demo del seed (editor y admin) y el id del editor. */
export async function sesionesDemo() {
  const editor = await clienteComo('editor@demo.local', 'demo-editor-2026');
  const admin = await clienteComo('admin@demo.local', 'demo-admin-2026');
  const { data, error } = await editor.auth.getUser();
  if (error || !data.user) throw new Error('No se pudo obtener el usuario editor');
  return { editor, admin, idEditor: data.user.id };
}
