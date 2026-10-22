// Cliente de servicio (`service_role`): salta RLS. Subpath `@blog/db/servicio`, fuera del índice y de
// `@blog/db/servidor`: solo lo importa `apps/admin/src/lib/servicio.ts`, y desde ahí las acciones del
// equipo (constitucion.md §III.4; research D6 de la spec 003). Nunca llega al navegador ni a `apps/web`.
import { createClient } from '@supabase/supabase-js';
import type { ClienteBlog } from './cliente';
import { ErrorDominio } from './errores';
import type { Database } from './tipos';

/** Cliente de servicio para las operaciones de Auth Admin. Sin sesión ni renovación de tokens. */
export function crearClienteAdmin(url: string, claveServicio: string): ClienteBlog {
  return createClient<Database>(url, claveServicio, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** La cuenta se creó pero no se pudo escribir el rol: queda inactiva y el admin la recupera con "Reactivar". */
export class InvitacionSinRol extends Error {
  constructor(causa: { message: string }) {
    super(`La invitación se envió pero el miembro quedó invitado sin rol: ${causa.message}`, { cause: causa });
    this.name = 'InvitacionSinRol';
  }
}

type RolInvitado = 'admin' | 'editor';

/** GoTrue responde 422 `email_exists` si la dirección ya tiene una cuenta confirmada. */
function esCorreoExistente(error: { code?: string; message: string }) {
  return error.code === 'email_exists' || /already.*registered/i.test(error.message);
}

/**
 * Invita a una persona por correo (research D6): crea la cuenta sin contraseña, que nace inactiva, y luego escribe
 * el rol en `app_metadata` (solo lo escribe el servidor), lo que activa el perfil. El estado "invitado" no se guarda:
 * lo deriva `listar_equipo`. Si el segundo paso falla la cuenta queda inactiva y sin rol: la lista la muestra como
 * "desactivado" y el admin la recupera con "Reactivar".
 */
export async function invitarMiembroPorCorreo(
  admin: ClienteBlog,
  entrada: { correo: string; nombre: string; rol: RolInvitado; redirectTo: string },
): Promise<{ id: string }> {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(entrada.correo, {
    data: { nombre: entrada.nombre },
    redirectTo: entrada.redirectTo,
  });
  if (error) {
    if (esCorreoExistente(error)) {
      throw new ErrorDominio('validacion', 'El correo ya pertenece a una cuenta', {
        detalle: 'Ese correo ya pertenece al equipo',
        cause: error,
      });
    }
    throw new Error(`No se pudo enviar la invitación: ${error.message}`, { cause: error });
  }

  const id = data.user.id;
  const { error: errorRol } = await admin.auth.admin.updateUserById(id, { app_metadata: { rol: entrada.rol } });
  if (errorRol) {
    throw new InvitacionSinRol(errorRol);
  }
  return { id };
}

/**
 * Repite la invitación de una cuenta sin confirmar (spike T086): mismo `id`, correo nuevo y el enlace anterior
 * deja de valer. Una cuenta que ya definió su contraseña no se reinvita.
 */
export async function reenviarInvitacionPorCorreo(
  admin: ClienteBlog,
  id: string,
  redirectTo: string,
): Promise<{ id: string }> {
  const { data, error } = await admin.auth.admin.getUserById(id);
  const usuario = data.user;
  if (error || !usuario?.email) throw new ErrorDominio('no_encontrado', 'La cuenta no existe', { cause: error });
  if (usuario.email_confirmed_at) {
    throw new ErrorDominio('validacion', 'La cuenta ya está confirmada', {
      detalle: 'Esa persona ya definió su contraseña',
    });
  }

  const nombre = (usuario.user_metadata as { nombre?: string } | null)?.nombre;
  const { error: errorEnvio } = await admin.auth.admin.inviteUserByEmail(usuario.email, {
    data: nombre ? { nombre } : undefined,
    redirectTo,
  });
  if (errorEnvio) throw new Error(`No se pudo reenviar la invitación: ${errorEnvio.message}`, { cause: errorEnvio });
  return { id };
}
