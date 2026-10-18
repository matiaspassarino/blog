// Clientes Supabase para tests de integración. Solo para tests.
import { createClient } from '@supabase/supabase-js';
import { inject } from 'vitest';
import type { Database } from '../tipos';

export const entorno = inject('supabase');

/** `describe.skipIf(sinSupabase)` para suites que necesitan la base local. */
export const sinSupabase = entorno === null;

function requerirEntorno() {
  if (!entorno) throw new Error('Supabase local no disponible');
  return entorno;
}

const opciones = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function clienteAnon() {
  const { url, claveAnon } = requerirEntorno();
  return createClient<Database>(url, claveAnon, opciones);
}

/** Cliente con la sesión de un usuario demo (ver quickstart.md, "Usuarios de demo"). */
export async function clienteComo(email: string, contrasenia: string) {
  const cliente = clienteAnon();
  const { error } = await cliente.auth.signInWithPassword({ email, password: contrasenia });
  if (error) throw new Error(`No se pudo iniciar sesión como ${email}: ${error.message}`);
  return cliente;
}
