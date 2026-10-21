// Único lugar del panel donde se crea el cliente de servicio (`service_role`, constitución §III.4): solo lo usan
// las acciones del equipo, después de comprobar el permiso. La clave es del servidor y nunca llega al navegador.
import { crearClienteAdmin } from '@blog/db/servicio';
import { entornoUrlAdmin } from './entorno';

/** Cliente de servicio para las invitaciones. Falla con un mensaje claro si falta una variable. */
export function crearClienteDeServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Falta la variable de entorno NEXT_PUBLIC_SUPABASE_URL (ver .env.example)');
  if (!clave) throw new Error('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY (ver .env.example)');
  return crearClienteAdmin(url, clave);
}

/** A dónde vuelve la persona desde el correo: la página que canjea el token. */
export const urlConfirmacion = () => `${entornoUrlAdmin()}/auth/confirmar`;
