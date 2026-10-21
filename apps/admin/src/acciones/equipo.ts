'use server';

// Acciones del equipo (Historia 6, contracts/acciones.md, "Equipo"): solo admin. Invitar y reenviar usan el
// cliente de servicio, creado acá dentro después de `conPermiso`; cambiar rol y estado usan la sesión y la base
// aplica "siempre queda un admin activo". Ningún resultado incluye datos de la cuenta de Auth.
import { cambiarActivo, cambiarRol, listarEquipo } from '@blog/db';
import { InvitacionSinRol, invitarMiembroPorCorreo, reenviarInvitacionPorCorreo } from '@blog/db/servicio';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { conPermiso } from '../lib/accion';
import { exito, fallo, type ResultadoAccion } from '../lib/resultado';
import { crearClienteDeServicio, urlConfirmacion } from '../lib/servicio';

const ROLES = ['admin', 'editor'] as const;
const MENSAJE_CORREO_EXISTENTE = 'Ese correo ya pertenece al equipo';

const esquemaInvitar = z.object({
  nombre: z.string().trim().min(1).max(80),
  correo: z
    .email()
    .max(254)
    .transform((correo) => correo.toLowerCase()),
  rol: z.enum(ROLES),
});

export async function invitarMiembro(entrada: unknown): Promise<ResultadoAccion<{ id: string }>> {
  return conPermiso('equipo.gestionar', async ({ cliente }) => {
    const datos = esquemaInvitar.safeParse(entrada);
    if (!datos.success) {
      return fallo('validacion', { detalle: 'Revisa el nombre (hasta 80 caracteres), el correo y el rol.' });
    }
    const { nombre, correo, rol } = datos.data;

    // Invitar a una cuenta que sigue sin confirmar la reenviaría (spike T086): acá se rechaza, para eso está "Reenviar".
    const equipo = await listarEquipo(cliente);
    if (equipo.some((fila) => fila.correo.toLowerCase() === correo)) {
      return fallo('validacion', { detalle: MENSAJE_CORREO_EXISTENTE });
    }

    try {
      const { id } = await invitarMiembroPorCorreo(crearClienteDeServicio(), {
        correo,
        nombre,
        rol,
        redirectTo: urlConfirmacion(),
      });
      revalidatePath('/equipo');
      return exito({ id });
    } catch (error) {
      if (!(error instanceof InvitacionSinRol)) throw error;
      revalidatePath('/equipo');
      return fallo('validacion', {
        detalle: 'La invitación se envió, pero la cuenta quedó sin rol. Búscala en la lista y usa "Reactivar".',
      });
    }
  });
}

export async function reenviarInvitacion(entrada: unknown): Promise<ResultadoAccion<void>> {
  return conPermiso('equipo.gestionar', async ({ cliente }) => {
    const datos = z.object({ id: z.uuid() }).safeParse(entrada);
    if (!datos.success) return fallo('validacion');
    const { id } = datos.data;

    const miembro = (await listarEquipo(cliente)).find((fila) => fila.id === id);
    if (!miembro) return fallo('no_encontrado');
    if (miembro.acceso !== 'invitado') {
      return fallo('validacion', { detalle: 'Esa persona ya definió su contraseña' });
    }

    await reenviarInvitacionPorCorreo(crearClienteDeServicio(), id, urlConfirmacion());
    revalidatePath('/equipo');
    return exito(undefined);
  });
}

export async function cambiarRolAccion(entrada: unknown): Promise<ResultadoAccion<void>> {
  return conPermiso('equipo.gestionar', async ({ miembro, cliente }) => {
    const datos = z.object({ id: z.uuid(), rol: z.enum(ROLES) }).safeParse(entrada);
    if (!datos.success) return fallo('validacion');
    await cambiarRol(cliente, datos.data.id, datos.data.rol);
    // Quien se quita el rol de admin ya no puede ver /equipo: revalidarla dejaría la pantalla en 403 y sin aviso.
    if (!(miembro.id === datos.data.id && datos.data.rol !== 'admin')) revalidatePath('/equipo');
    return exito(undefined);
  });
}

export async function cambiarActivoAccion(entrada: unknown): Promise<ResultadoAccion<void>> {
  return conPermiso('equipo.gestionar', async ({ cliente }) => {
    const datos = z.object({ id: z.uuid(), activo: z.boolean() }).safeParse(entrada);
    if (!datos.success) return fallo('validacion');
    await cambiarActivo(cliente, datos.data.id, datos.data.activo);
    revalidatePath('/equipo');
    return exito(undefined);
  });
}
