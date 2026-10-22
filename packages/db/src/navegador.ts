// Cliente del navegador, solo para subir archivos con una URL firmada (research D9 de la spec 003).
// Subpath `@blog/db/navegador`, fuera del índice: arrastra `@supabase/ssr`.
import { createBrowserClient } from '@supabase/ssr';
import type { ClienteBlog } from './cliente';
import type { Database } from './tipos';

export function crearClienteNavegador(url: string, claveAnon: string): ClienteBlog {
  return createBrowserClient<Database>(url, claveAnon);
}
