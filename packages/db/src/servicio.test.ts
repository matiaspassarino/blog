// T087 (spec 003, H6-E1, H6-E2, H6-E3, research D6): invitaciones por correo con la clave de servicio, contra
// Supabase local. FASE ROJA: `invitarMiembroPorCorreo` y `reenviarInvitacionPorCorreo` no existen aún en ./servicio (T094).
//
// Firmas supuestas (subpath `@blog/db/servicio`):
//   invitarMiembroPorCorreo(admin: ClienteBlog, { correo, nombre, rol, redirectTo }): Promise<{ id: string }>
//     1) `inviteUserByEmail(correo, { data: { nombre }, redirectTo })`  2) `updateUserById(id, { app_metadata: { rol } })`.
//     Correo que ya pertenece a una cuenta confirmada -> ErrorDominio('validacion').
//     Si el segundo paso falla -> lanza un Error cuyo mensaje dice que el miembro quedó invitado "sin rol".
//   reenviarInvitacionPorCorreo(admin: ClienteBlog, id: string, redirectTo: string): Promise<{ id: string }>
//     Repite la invitación de una cuenta sin confirmar: mismo id, un correo nuevo (spike T086). id inexistente ->
//     ErrorDominio('no_encontrado'); cuenta ya confirmada -> ErrorDominio('validacion').
// El estado "invitado" no se guarda: lo deriva `listar_equipo` (acceso = 'invitado').
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type { ClienteBlog } from './cliente';
import { listarEquipo } from './consultas/panel';
import { rechazoDe } from './pruebas/afirmaciones';
import { sesionAdminDemo, sinSupabase } from './pruebas/clientes';
import type {} from './pruebas/entorno'; // declara el contexto `supabase` que provee globalSetup
import { crearClienteAdmin, invitarMiembroPorCorreo, reenviarInvitacionPorCorreo } from './servicio';

const entorno = inject('supabase');
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:56324';
const REDIRECT = 'http://localhost:3100/auth/confirmar';
const sufijo = crypto.randomUUID().slice(0, 8);
const PREFIJO_CORREO = `t087-${sufijo}`;

/** Cuántos correos recibió una dirección en Mailpit (espera hasta que lleguen `esperados`). */
async function correosRecibidos(correo: string, esperados: number): Promise<number> {
  let cantidad = 0;
  for (let intento = 0; intento < 20; intento += 1) {
    const respuesta = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${correo}`)}`);
    cantidad = ((await respuesta.json()) as { messages_count?: number }).messages_count ?? 0;
    if (cantidad >= esperados) return cantidad;
    await new Promise((resolver) => setTimeout(resolver, 500));
  }
  return cantidad;
}

describe.skipIf(sinSupabase)('invitaciones por correo (integración, H6)', () => {
  let servicio: ClienteBlog;
  let admin: ClienteBlog;
  let contador = 0;

  const correoNuevo = () => `${PREFIJO_CORREO}-${(contador += 1)}@prueba.local`;

  beforeAll(async () => {
    if (!entorno?.claveServicio) throw new Error('Falta la clave de servicio de Supabase local');
    servicio = crearClienteAdmin(entorno.url, entorno.claveServicio);
    ({ admin } = await sesionAdminDemo());
  });

  afterAll(async () => {
    if (!servicio) return;
    const { data } = await servicio.auth.admin.listUsers({ perPage: 200 });
    for (const usuario of data.users.filter((u) => u.email?.startsWith(PREFIJO_CORREO))) {
      await servicio.from('perfiles').delete().eq('id', usuario.id);
      await servicio.auth.admin.deleteUser(usuario.id);
    }
  });

  async function filaDelEquipo(correo: string) {
    return (await listarEquipo(admin)).find((fila) => fila.correo === correo);
  }

  describe('invitarMiembroPorCorreo', () => {
    it('H6-E1: crea al miembro como invitado, con el rol y el nombre pedidos', async () => {
      const correo = correoNuevo();

      const { id } = await invitarMiembroPorCorreo(servicio, {
        correo,
        nombre: 'Persona Invitada',
        rol: 'editor',
        redirectTo: REDIRECT,
      });

      expect(await filaDelEquipo(correo)).toMatchObject({
        id,
        nombre: 'Persona Invitada',
        rol: 'editor',
        activo: true,
        acceso: 'invitado',
      });
    });

    it('H6-E1: el rol viaja en app_metadata (el servidor lo escribe) y no en user_metadata', async () => {
      const correo = correoNuevo();

      const { id } = await invitarMiembroPorCorreo(servicio, {
        correo,
        nombre: 'Futura Admin',
        rol: 'admin',
        redirectTo: REDIRECT,
      });

      const { data } = await servicio.auth.admin.getUserById(id);
      expect(data.user?.app_metadata).toMatchObject({ rol: 'admin' });
      expect(data.user?.user_metadata).toMatchObject({ nombre: 'Futura Admin' });
      expect(data.user?.user_metadata).not.toHaveProperty('rol');
      expect(await filaDelEquipo(correo)).toMatchObject({ rol: 'admin', acceso: 'invitado' });
    });

    it('H6-E1: envía un correo de invitación a la dirección', async () => {
      const correo = correoNuevo();

      await invitarMiembroPorCorreo(servicio, { correo, nombre: 'Con Correo', rol: 'editor', redirectTo: REDIRECT });

      expect(await correosRecibidos(correo, 1)).toBe(1);
    });

    it('H6-E3: un correo que ya pertenece a un miembro confirmado se rechaza con validacion', async () => {
      const error = await rechazoDe(
        invitarMiembroPorCorreo(servicio, {
          correo: 'editor@demo.local',
          nombre: 'Repetido',
          rol: 'editor',
          redirectTo: REDIRECT,
        }),
      );

      expect(error.codigo).toBe('validacion');
      const filas = (await listarEquipo(admin)).filter((fila) => fila.correo === 'editor@demo.local');
      expect(filas).toHaveLength(1);
      expect(filas[0]?.nombre).toBe('Edu Editor');
    });

    it('si el segundo paso falla, avisa que el miembro quedó invitado sin rol', async () => {
      const correo = correoNuevo();
      // Cliente que delega todo en el real, salvo `updateUserById`, que falla.
      const conFalloEnElRol = {
        ...servicio,
        auth: {
          ...servicio.auth,
          admin: {
            inviteUserByEmail: servicio.auth.admin.inviteUserByEmail.bind(servicio.auth.admin),
            getUserById: servicio.auth.admin.getUserById.bind(servicio.auth.admin),
            listUsers: servicio.auth.admin.listUsers.bind(servicio.auth.admin),
            updateUserById: async () => ({ data: { user: null }, error: { message: 'falla simulada', status: 500 } }),
          },
        },
      } as unknown as ClienteBlog;

      const motivo = await invitarMiembroPorCorreo(conFalloEnElRol, {
        correo,
        nombre: 'Sin Rol',
        rol: 'editor',
        redirectTo: REDIRECT,
      }).then(
        () => null,
        (error: unknown) => error,
      );

      expect(motivo).toBeInstanceOf(Error);
      expect((motivo as Error).message).toMatch(/sin rol/i);
      // La cuenta existe: el admin la ve en la lista y puede reintentar con "Reenviar".
      expect(await filaDelEquipo(correo)).toMatchObject({ acceso: 'invitado' });
    });
  });

  describe('reenviarInvitacionPorCorreo', () => {
    it('H6-E2: sobre un invitado devuelve el mismo id, envía un correo nuevo y sigue invitado', async () => {
      const correo = correoNuevo();
      const { id } = await invitarMiembroPorCorreo(servicio, {
        correo,
        nombre: 'Reinvitado',
        rol: 'editor',
        redirectTo: REDIRECT,
      });
      expect(await correosRecibidos(correo, 1)).toBe(1);

      const reenviada = await reenviarInvitacionPorCorreo(servicio, id, REDIRECT);

      expect(reenviada.id).toBe(id);
      expect(await correosRecibidos(correo, 2)).toBe(2);
      expect(await filaDelEquipo(correo)).toMatchObject({ id, rol: 'editor', acceso: 'invitado' });
    });

    it('H6-E2: un id que no existe se rechaza con no_encontrado', async () => {
      const error = await rechazoDe(reenviarInvitacionPorCorreo(servicio, crypto.randomUUID(), REDIRECT));

      expect(error.codigo).toBe('no_encontrado');
    });

    it('H6-E2: una cuenta que ya definió su contraseña se rechaza con validacion y no recibe correo', async () => {
      const { data } = await servicio.auth.admin.getUserById('00000000-0000-4000-a000-000000000003');
      const antes = await correosRecibidos(data.user?.email ?? 'editor@demo.local', 0);

      const error = await rechazoDe(
        reenviarInvitacionPorCorreo(servicio, '00000000-0000-4000-a000-000000000003', REDIRECT),
      );

      expect(error.codigo).toBe('validacion');
      expect(await correosRecibidos('editor@demo.local', 0)).toBe(antes);
    });
  });
});
