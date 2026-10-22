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
  const respuesta = await fetch(`${URL_API}/rest/v1/articulos?id=eq.${id}&select=id`, {
    method: 'DELETE',
    headers: { apikey: claveAnon(), Authorization: `Bearer ${token}`, Prefer: 'return=representation' },
  });
  if (!respuesta.ok) throw new Error(`La API respondió ${respuesta.status} al eliminar ${id}`);
  return (await respuesta.json()) as { id: string }[];
}

/**
 * `PATCH /rest/v1/perfiles?id=eq.<id>` con la sesión del token: el intento de saltarse la interfaz para cambiar rol o
 * estado. Devuelve el estado HTTP y las filas modificadas (con RLS y los triggers, un editor no modifica ninguna).
 */
export async function actualizarPerfilPorApi(
  token: string,
  id: string,
  cambios: Record<string, unknown>,
): Promise<{ estado: number; filas: unknown[] }> {
  const respuesta = await fetch(`${URL_API}/rest/v1/perfiles?id=eq.${id}&select=id`, {
    method: 'PATCH',
    headers: {
      apikey: claveAnon(),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(cambios),
  });
  const cuerpo: unknown = await respuesta.json().catch(() => []);
  return { estado: respuesta.status, filas: Array.isArray(cuerpo) ? cuerpo : [] };
}

export type RespuestaApi = { estado: number; cuerpo: unknown };

/**
 * Llamada genérica a la API de Supabase (PostgREST, Storage o Auth) con la sesión del `token`, o como anónimo si es
 * `null` (solo la clave anon). Devuelve el estado y el cuerpo ya leído; no lanza ante un 4xx: lo decide cada prueba.
 * `cuerpo` se envía como JSON salvo que sea un `Uint8Array` (se envía tal cual, con `tipoDeContenido`).
 */
export async function llamarApi(
  token: string | null,
  metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  ruta: string,
  opciones: { cuerpo?: unknown; tipoDeContenido?: string; prefer?: string } = {},
): Promise<RespuestaApi> {
  const { cuerpo, tipoDeContenido, prefer = 'return=representation' } = opciones;
  const crudo = cuerpo instanceof Uint8Array;
  const respuesta = await fetch(`${URL_API}${ruta}`, {
    method: metodo,
    headers: {
      apikey: claveAnon(),
      Authorization: `Bearer ${token ?? claveAnon()}`,
      Prefer: prefer,
      ...(cuerpo !== undefined && {
        'Content-Type': crudo ? (tipoDeContenido ?? 'application/octet-stream') : 'application/json',
      }),
    },
    body: cuerpo === undefined ? undefined : crudo ? Buffer.from(cuerpo) : JSON.stringify(cuerpo),
  });
  const texto = await respuesta.text();
  let parseado: unknown = texto;
  try {
    parseado = texto === '' ? null : JSON.parse(texto);
  } catch {
    // cuerpo que no es JSON: se devuelve el texto
  }
  return { estado: respuesta.status, cuerpo: parseado };
}
