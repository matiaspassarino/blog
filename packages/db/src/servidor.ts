// Cliente con la sesión del miembro en cookies (research D1 de la spec 003). Subpath `@blog/db/servidor`,
// fuera del índice: `apps/web` depende de `@blog/db` y no debe cargar `@supabase/ssr`. La clave de
// servicio vive aparte, en `@blog/db/servicio` (constitucion.md §III.4).
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { ClienteBlog } from './cliente';
import type { Database } from './tipos';

export type CookieAEscribir = { name: string; value: string; options: CookieOptions };

/** Lo que el cliente necesita de `cookies()` de Next.js (o de la petición del proxy). */
export type AlmacenCookies = {
  getAll(): { name: string; value: string }[];
  setAll(cookies: CookieAEscribir[]): void;
};

type OpcionesClienteServidor = { url: string; claveAnon: string; cookies: AlmacenCookies };

/** Cliente con la sesión del miembro, guardada en cookies. Respeta RLS. */
export function crearClienteServidor({ url, claveAnon, cookies }: OpcionesClienteServidor): ClienteBlog {
  return createServerClient<Database>(url, claveAnon, {
    cookies: { getAll: () => cookies.getAll(), setAll: (lista) => cookies.setAll(lista) },
  });
}
