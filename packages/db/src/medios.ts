// Imágenes del bucket público `medios`: URL, ruta relativa y operaciones de Storage del panel
// (constitución §III.2: todo acceso a datos pasa por @blog/db; spec 003, research D9 y D11).
import type { ClienteBlog } from './cliente';
import { ErrorDominio, type CodigoError } from './errores';

const BUCKET = 'medios';
const PREFIJO_PUBLICO = `/storage/v1/object/public/${BUCKET}/`;

/** Ruta absoluta tal cual; relativa, al bucket público `medios` de Supabase Storage. */
export function urlImagen(ruta: string, supabaseUrl: string): string {
  if (/^https?:\/\//.test(ruta)) return ruta;
  return `${supabaseUrl}${PREFIJO_PUBLICO}${ruta.replace(/^\/+/, '')}`;
}

/** Inversa de `urlImagen` para una URL pública del bucket `medios`; `null` si la URL es de otra cosa. */
export function rutaDeMedio(url: string): string | null {
  const indice = url.indexOf(PREFIJO_PUBLICO);
  if (!/^https?:\/\//.test(url) || indice === -1) return null;
  const ruta = url.slice(indice + PREFIJO_PUBLICO.length);
  return ruta === '' ? null : ruta;
}

type ErrorStorage = { message: string; status?: number | string; statusCode?: number | string };

/** Storage no usa los códigos de Postgres: se traduce por estado HTTP o por el texto del error. */
function errorDeStorage(error: ErrorStorage): ErrorDominio {
  const estado = Number(error.statusCode ?? error.status);
  const texto = error.message.toLowerCase();
  let codigo: CodigoError = 'desconocido';
  if (estado === 404 || texto.includes('not found')) codigo = 'no_encontrado';
  else if (estado === 401 || estado === 403 || texto.includes('security') || texto.includes('unauthorized'))
    codigo = 'sin_permiso';
  return new ErrorDominio(codigo, error.message, { cause: error });
}

/** URL firmada para subir un archivo directo a Storage desde el navegador (D9). */
export async function crearSubidaFirmada(
  c: ClienteBlog,
  ruta: string,
): Promise<{ ruta: string; token: string; urlFirmada: string }> {
  const { data, error } = await c.storage.from(BUCKET).createSignedUploadUrl(ruta);
  if (error) throw errorDeStorage(error as ErrorStorage);
  return { ruta: data.path, token: data.token, urlFirmada: data.signedUrl };
}

/** Bytes de un objeto del bucket, con la sesión de quien llama (D10). */
export async function descargarMedio(c: ClienteBlog, ruta: string): Promise<Uint8Array> {
  const { data, error } = await c.storage.from(BUCKET).download(ruta);
  if (error) throw errorDeStorage(error as ErrorStorage);
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Borra objetos del bucket (D11). Mejor esfuerzo: nunca lanza y devuelve las rutas que no pudo
 * borrar, incluidas las que RLS impide borrar sin dar error.
 */
export async function borrarMedios(c: ClienteBlog, rutas: string[]): Promise<string[]> {
  if (rutas.length === 0) return [];
  try {
    const { data, error } = await c.storage.from(BUCKET).remove(rutas);
    if (error) return rutas;
    const borradas = new Set(data.map((objeto) => objeto.name));
    return rutas.filter((ruta) => !borradas.has(ruta));
  } catch {
    return rutas;
  }
}
