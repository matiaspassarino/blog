import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './tipos';

export type ClienteBlog = SupabaseClient<Database>;

/** Cliente sin sesión con la clave anon (apps/web, build e ISR). */
export function crearClientePublico(url: string, claveAnon: string): ClienteBlog {
  return createClient<Database>(url, claveAnon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
