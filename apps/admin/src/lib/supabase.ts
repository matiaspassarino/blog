// Cliente de Supabase con la sesión del miembro, guardada en cookies (research D1 de la spec 003).
// Se crea una vez por petición del servidor; el acceso a datos sigue pasando por @blog/db (§III.2).
import { crearClienteServidor } from '@blog/db/servidor';
import { cookies } from 'next/headers';
import { entornoSupabase } from './entorno';

export async function crearClienteDeSesion() {
  const almacen = await cookies();
  return crearClienteServidor({
    ...entornoSupabase(),
    cookies: {
      getAll: () => almacen.getAll(),
      setAll(lista) {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch {
          // En un Server Component las cookies no se pueden escribir; el proxy ya renueva los tokens.
        }
      },
    },
  });
}
