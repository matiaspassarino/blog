// Llamadas directas a la API de Supabase con la sesión de un miembro, por fuera de la interfaz (CE-002: lo que
// no se ve tampoco se puede hacer). Solo para E2E; usa fetch, sin dependencias nuevas.
import type { UsuarioDemo } from './sesion';

const URL_API = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:56321';

function claveAnon() {
  const clave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!clave) throw new Error('Falta NEXT_PUBLIC_SUPABASE_ANON_KEY (apps/admin/.env.local) para los E2E de permisos');
  return clave;
}

/** Abre una sesión con correo y contraseña y devuelve el token de acceso (JWT) del miembro. */
export async function tokenDe(usuario: UsuarioDemo): Promise<string> {
  const respuesta = await fetch(`${URL_API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: claveAnon(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: usuario.correo, password: usuario.contrasenia }),
  });
  if (!respuesta.ok) throw new Error(`No se pudo ingresar como ${usuario.correo}: ${respuesta.status}`);
  return ((await respuesta.json()) as { access_token: string }).access_token;
}

/**
 * `DELETE /rest/v1/articulos?id=eq.<id>` con la sesión del token. Devuelve las filas que la base dejó borrar:
 * con RLS, quien no tiene permiso recibe una lista vacía (la base filtra en silencio), no un error.
 */
export async function eliminarArticuloPorApi(token: string, id: string): Promise<{ id: string }[]> {
  const respuesta = await fetch(`${URL_API}/rest/v1/articulos?id=eq.${id}`, {
    method: 'DELETE',
    headers: { apikey: claveAnon(), Authorization: `Bearer ${token}`, Prefer: 'return=representation' },
  });
  if (!respuesta.ok) throw new Error(`La API respondió ${respuesta.status} al eliminar ${id}`);
  return (await respuesta.json()) as { id: string }[];
}
