// Cliente de servicio (`service_role`): salta RLS. Subpath `@blog/db/servicio`, fuera del índice y de
// `@blog/db/servidor`: solo lo importa `apps/admin/src/lib/servicio.ts`, y desde ahí las acciones del
// equipo (constitucion.md §III.4; research D6 de la spec 003). Nunca llega al navegador ni a `apps/web`.
import { createClient } from '@supabase/supabase-js';
import type { ClienteBlog } from './cliente';
import type { Database } from './tipos';

/** Cliente de servicio para las operaciones de Auth Admin. Sin sesión ni renovación de tokens. */
export function crearClienteAdmin(url: string, claveServicio: string): ClienteBlog {
  return createClient<Database>(url, claveServicio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
