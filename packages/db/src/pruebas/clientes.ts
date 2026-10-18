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
