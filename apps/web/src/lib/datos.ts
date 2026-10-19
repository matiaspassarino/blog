// Única instancia del cliente de datos de apps/web (constitucion.md §III.2 y §III.3):
// solo la clave pública y solo lectura de lo publicado.
import { crearClientePublico } from '@blog/db';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from 'astro:env/server';

export const datos = crearClientePublico(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
