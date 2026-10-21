// T087 (spec 003, H6-E1 a E5, RF-021, RF-024, RF-027): Server Actions del equipo, contra Supabase local.
// FASE ROJA: `./equipo` no existe aún (T094).
//
// Firmas supuestas, exportadas desde './equipo' (`'use server'`). Reciben UN OBJETO y devuelven `ResultadoAccion<T>`:
//   invitarMiembro({ nombre, correo, rol: 'editor' | 'admin' }): ResultadoAccion<{ id: string }>
//     Crea la cuenta como "invitado" (`listar_equipo.acceso = 'invitado'`) con el rol pedido y manda el correo.
//     Un correo que ya pertenece al equipo (confirmado O ya invitado) -> 'validacion' con detalle y mensaje
//     "Ese correo ya pertenece al equipo". Nombre vacío o de más de 80, correo inválido o rol desconocido -> 'validacion'.
//   reenviarInvitacion({ id }): ResultadoAccion<void>
//     Solo si el miembro está 'invitado'; si no -> 'validacion' "Esa persona ya definió su contraseña". Id que no está
//     en la lista -> 'no_encontrado'.
//   cambiarRolAccion({ id, rol }): ResultadoAccion<void>        'ultimo_admin' si deja al equipo sin admin activo.
//   cambiarActivoAccion({ id, activo }): ResultadoAccion<void>  ídem.
// Todas: solo admin ('equipo.gestionar'): un editor recibe 'sin_permiso'; sin sesión, 'no_autenticado'/'sin_sesion'; con la
// cuenta desactivada, 'no_autenticado'/'desactivada'. Cada acción exitosa llama a revalidatePath('/equipo'). Ningún
// resultado devuelto contiene la clave de servicio (§III.4).
import type { ClienteBlog } from '@blog/db';
import { listarEquipo } from '@blog/db';
import { restaurarAdminDemo, sesionAdminDemo, sinSupabase } from '@blog/db/pruebas';
import type {} from '@blog/db/pruebas/entorno'; // declara el contexto `supabase` que provee globalSetup
import { crearClienteAdmin } from '@blog/db/servicio';
import { revalidatePath } from 'next/cache';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { almacenCookies, correr, formulario } from '../test/next-simulado';
import { cambiarActivoAccion, cambiarRolAccion, invitarMiembro, reenviarInvitacion } from './equipo';

vi.mock('next/headers', async () => (await import('../test/next-simulado')).moduloHeaders);
vi.mock('next/navigation', async () => (await import('../test/next-simulado')).moduloNavegacion);
vi.mock('next/cache', async () => (await import('../test/next-simulado')).moduloCache);

const entorno = inject('supabase');
const ID_EDITOR_DEMO = '00000000-0000-4000-a000-000000000003';
const MENSAJE_ULTIMO_ADMIN = 'Siempre tiene que quedar al menos un administrador activo.';
const MENSAJE_CORREO_EXISTENTE = 'Ese correo ya pertenece al equipo';

const sufijo = crypto.randomUUID().slice(0, 8);
const PREFIJO_CORREO = `t087a-${sufijo}`;

describe.skipIf(sinSupabase)('Server Actions del equipo (H6)', () => {
  let servicio: ClienteBlog;
  let admin: ClienteBlog;
  let idAdmin: string;
  let contador = 0;

  beforeAll(async () => {
    if (!entorno?.claveServicio) throw new Error('Falta la clave de servicio de Supabase local');
    process.env.NEXT_PUBLIC_SUPABASE_URL = entorno.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = entorno.claveAnon;
    process.env.SUPABASE_SERVICE_ROLE_KEY = entorno.claveServicio;
    process.env.NEXT_PUBLIC_URL_ADMIN = 'http://localhost:3100';
    servicio = crearClienteAdmin(entorno.url, entorno.claveServicio);
    ({ admin, idAdmin } = await sesionAdminDemo());
  });

  beforeEach(() => {
    almacenCookies.clear();
    vi.mocked(revalidatePath).mockClear();
  });

  afterAll(async () => {
    // Red de seguridad: si una prueba del último admin aplicó el cambio por error, el seed quedaría sin admin.
    if (idAdmin) await restaurarAdminDemo(idAdmin);
    if (!servicio) return;
    const { data } = await servicio.auth.admin.listUsers({ perPage: 200 });
    for (const usuario of data.users.filter((u) => u.email?.startsWith(PREFIJO_CORREO))) {
      await servicio.from('articulos').delete().eq('autor_id', usuario.id);
      await servicio.from('perfiles').delete().eq('id', usuario.id);
      await servicio.auth.admin.deleteUser(usuario.id);
    }
  });

  const correoNuevo = () => `${PREFIJO_CORREO}-${(contador += 1)}@prueba.local`;

  async function ingresarComo(correo: string, contrasenia: string) {
    const { ingresar } = await import('./acceso');
    almacenCookies.clear();
    await correr(() => ingresar(null, formulario({ correo, contrasenia })));
  }
  const comoAdmin = () => ingresarComo('admin@demo.local', 'demo-admin-2026');
  const comoEditor = () => ingresarComo('editor@demo.local', 'demo-editor-2026');

  /** Miembro confirmado y activo con el rol dado (como si ya hubiera aceptado su invitación). */
  async function crearMiembro(rol: 'editor' | 'admin', { activo = true } = {}) {
    const correo = correoNuevo();
    const contrasenia = `prueba-${crypto.randomUUID()}`;
    const { data, error } = await servicio.auth.admin.createUser({
      email: correo,
      password: contrasenia,
      email_confirm: true,
      user_metadata: { nombre: `Miembro ${rol} ${contador}` },
      app_metadata: { rol },
    });
    if (error || !data.user) throw new Error(`No se pudo crear el miembro: ${error?.message}`);
    // El servicio no es un cliente (privado.es_cliente): puede fijar rol y estado a mano.
    await servicio.from('perfiles').update({ rol, activo }).eq('id', data.user.id);
    return { id: data.user.id, correo, contrasenia };
  }

  async function filaPorCorreo(correo: string) {
    return (await listarEquipo(admin)).find((fila) => fila.correo === correo);
  }
  async function filaPorId(id: string) {
    return (await listarEquipo(admin)).find((fila) => fila.id === id);
  }

  describe('invitarMiembro (H6-E1, H6-E3)', () => {
    it('H6-E1: crea al miembro como invitado con el rol pedido y actualiza la lista', async () => {
      await comoAdmin();
      const correo = correoNuevo();

      const resultado = await invitarMiembro({ nombre: 'Nueva Editora', correo, rol: 'editor' });

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(await filaPorCorreo(correo)).toMatchObject({
        id: resultado.datos.id,
        nombre: 'Nueva Editora',
        rol: 'editor',
        acceso: 'invitado',
      });
      expect(revalidatePath).toHaveBeenCalledWith('/equipo');
    });

    it('H6-E1: también se puede invitar a un administrador', async () => {
      await comoAdmin();
      const correo = correoNuevo();

      const resultado = await invitarMiembro({ nombre: 'Nuevo Admin', correo, rol: 'admin' });

      expect(resultado.ok).toBe(true);
      expect(await filaPorCorreo(correo)).toMatchObject({ rol: 'admin', acceso: 'invitado' });
      // Un admin invitado ya cuenta como admin activo: se quita para no alterar las pruebas del último admin.
      const invitado = await filaPorCorreo(correo);
      if (invitado) {
        await servicio.from('perfiles').delete().eq('id', invitado.id);
        await servicio.auth.admin.deleteUser(invitado.id);
      }
    });

    it('H6-E3: un correo que ya pertenece a un miembro devuelve validacion con un mensaje claro', async () => {
      await comoAdmin();

      const resultado = await invitarMiembro({ nombre: 'Repetido', correo: 'editor@demo.local', rol: 'editor' });

      expect(resultado).toMatchObject({
        ok: false,
        codigo: 'validacion',
        detalle: MENSAJE_CORREO_EXISTENTE,
        mensaje: MENSAJE_CORREO_EXISTENTE,
      });
      expect(revalidatePath).not.toHaveBeenCalled();
      expect((await filaPorId(ID_EDITOR_DEMO))?.nombre).toBe('Edu Editor');
    });

    it('H6-E3: invitar dos veces el mismo correo (el primero sigue invitado) también se rechaza', async () => {
      await comoAdmin();
      const correo = correoNuevo();
      const primera = await invitarMiembro({ nombre: 'Primera vez', correo, rol: 'editor' });
      expect(primera.ok).toBe(true);

      const segunda = await invitarMiembro({ nombre: 'Segunda vez', correo, rol: 'admin' });

      expect(segunda).toMatchObject({ ok: false, codigo: 'validacion', detalle: MENSAJE_CORREO_EXISTENTE });
      expect(await filaPorCorreo(correo)).toMatchObject({ nombre: 'Primera vez', rol: 'editor' });
    });

    it('RF-027: nombre vacío o demasiado largo, correo inválido o rol desconocido devuelven validacion y no crean nada', async () => {
      await comoAdmin();
      const casos = [
        { nombre: '   ', correo: correoNuevo(), rol: 'editor' },
        { nombre: 'n'.repeat(81), correo: correoNuevo(), rol: 'editor' },
        { nombre: 'Correo roto', correo: 'esto-no-es-un-correo', rol: 'editor' },
        { nombre: 'Rol raro', correo: correoNuevo(), rol: 'superadmin' },
      ];

      for (const caso of casos) {
        const resultado = await invitarMiembro(caso as never);
        expect(resultado).toMatchObject({ ok: false, codigo: 'validacion' });
        expect(await filaPorCorreo(caso.correo)).toBeUndefined();
      }
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe('reenviarInvitacion (H6-E2)', () => {
    it('H6-E2: sobre un invitado responde ok y la cuenta sigue invitada con el mismo id', async () => {
      await comoAdmin();
      const correo = correoNuevo();
      const invitada = await invitarMiembro({ nombre: 'Para reenviar', correo, rol: 'editor' });
      if (!invitada.ok) throw new Error(`No se pudo invitar: ${invitada.mensaje}`);
      vi.mocked(revalidatePath).mockClear();

      const resultado = await reenviarInvitacion({ id: invitada.datos.id });

      expect(resultado.ok).toBe(true);
      expect(await filaPorCorreo(correo)).toMatchObject({ id: invitada.datos.id, acceso: 'invitado' });
      expect(revalidatePath).toHaveBeenCalledWith('/equipo');
    });

    it('H6-E2: sobre un miembro que ya definió su contraseña devuelve validacion', async () => {
      await comoAdmin();

      const resultado = await reenviarInvitacion({ id: ID_EDITOR_DEMO });

      expect(resultado).toMatchObject({
        ok: false,
        codigo: 'validacion',
        detalle: 'Esa persona ya definió su contraseña',
      });
    });

    it('H6-E2: un id que no está en el equipo devuelve no_encontrado y uno que no es uuid, validacion', async () => {
      await comoAdmin();

      expect(await reenviarInvitacion({ id: crypto.randomUUID() })).toMatchObject({
        ok: false,
        codigo: 'no_encontrado',
      });
      expect(await reenviarInvitacion({ id: 'no-es-un-uuid' } as never)).toMatchObject({
        ok: false,
        codigo: 'validacion',
      });
    });
  });

  describe('cambiarRolAccion (H6-E4, H6-E5)', () => {
    it('H6-E4: cambia el rol de un editor a admin y de vuelta, y la lista lo refleja', async () => {
      await comoAdmin();
      const miembro = await crearMiembro('editor');

      const ascenso = await cambiarRolAccion({ id: miembro.id, rol: 'admin' });
      expect(ascenso.ok).toBe(true);
      expect((await filaPorId(miembro.id))?.rol).toBe('admin');
      expect(revalidatePath).toHaveBeenCalledWith('/equipo');

      const descenso = await cambiarRolAccion({ id: miembro.id, rol: 'editor' });
      expect(descenso.ok).toBe(true);
      expect((await filaPorId(miembro.id))?.rol).toBe('editor');
    });

    it('H6-E4: si hay otro admin activo, se puede quitar el rol a un admin', async () => {
      await comoAdmin();
      const otroAdmin = await crearMiembro('admin');

      const resultado = await cambiarRolAccion({ id: otroAdmin.id, rol: 'editor' });

      expect(resultado.ok).toBe(true);
      expect((await filaPorId(otroAdmin.id))?.rol).toBe('editor');
    });

    it('H6-E5: el único admin activo (incluido quien llama) no puede pasar a editor', async () => {
      await comoAdmin();

      const resultado = await cambiarRolAccion({ id: idAdmin, rol: 'editor' });

      expect(resultado).toMatchObject({ ok: false, codigo: 'ultimo_admin', mensaje: MENSAJE_ULTIMO_ADMIN });
      expect((await filaPorId(idAdmin))?.rol).toBe('admin');
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('H6-E4: un id inexistente devuelve no_encontrado y un rol desconocido, validacion', async () => {
      await comoAdmin();

      expect(await cambiarRolAccion({ id: crypto.randomUUID(), rol: 'editor' })).toMatchObject({
        ok: false,
        codigo: 'no_encontrado',
      });
      expect(await cambiarRolAccion({ id: ID_EDITOR_DEMO, rol: 'superadmin' } as never)).toMatchObject({
        ok: false,
        codigo: 'validacion',
      });
      expect((await filaPorId(ID_EDITOR_DEMO))?.rol).toBe('editor');
    });
  });

  describe('cambiarActivoAccion (H6-E4, H6-E5)', () => {
    it('H6-E4: desactiva y reactiva a un miembro, y la lista muestra su acceso', async () => {
      await comoAdmin();
      const miembro = await crearMiembro('editor');

      const baja = await cambiarActivoAccion({ id: miembro.id, activo: false });
      expect(baja.ok).toBe(true);
      expect(await filaPorId(miembro.id)).toMatchObject({ activo: false, acceso: 'desactivado' });
      expect(revalidatePath).toHaveBeenCalledWith('/equipo');

      const alta = await cambiarActivoAccion({ id: miembro.id, activo: true });
      expect(alta.ok).toBe(true);
      expect(await filaPorId(miembro.id)).toMatchObject({ activo: true, acceso: 'activo' });
    });

    it('H6-E4: el miembro desactivado ya no puede usar las acciones del panel (se comporta como anónimo)', async () => {
      await comoAdmin();
      const miembro = await crearMiembro('admin');
      await cambiarActivoAccion({ id: miembro.id, activo: false });

      await ingresarComo(miembro.correo, miembro.contrasenia);
      // La sesión puede no haberse abierto (el ingreso lo impide): en ambos casos la acción no debe ejecutarse.
      const resultado = await invitarMiembro({ nombre: 'No debería', correo: correoNuevo(), rol: 'editor' });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_autenticado' });
    });

    it('H6-E5: el único admin activo (incluido quien llama) no puede desactivarse', async () => {
      await comoAdmin();

      const resultado = await cambiarActivoAccion({ id: idAdmin, activo: false });

      expect(resultado).toMatchObject({ ok: false, codigo: 'ultimo_admin', mensaje: MENSAJE_ULTIMO_ADMIN });
      expect(await filaPorId(idAdmin)).toMatchObject({ activo: true, acceso: 'activo' });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('H6-E4: un id inexistente devuelve no_encontrado', async () => {
      await comoAdmin();

      const resultado = await cambiarActivoAccion({ id: crypto.randomUUID(), activo: false });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_encontrado' });
    });
  });

  describe('permisos (RF-024)', () => {
    it('H6-E6: un editor recibe sin_permiso en las cuatro acciones y no cambia nada', async () => {
      await comoEditor();
      const correo = correoNuevo();
      const objetivo = await crearMiembro('editor');

      const resultados = [
        await invitarMiembro({ nombre: 'Intruso', correo, rol: 'admin' }),
        await reenviarInvitacion({ id: objetivo.id }),
        await cambiarRolAccion({ id: objetivo.id, rol: 'admin' }),
        await cambiarActivoAccion({ id: objetivo.id, activo: false }),
      ];

      for (const resultado of resultados) {
        expect(resultado).toMatchObject({ ok: false, codigo: 'sin_permiso' });
      }
      expect(await filaPorCorreo(correo)).toBeUndefined();
      expect(await filaPorId(objetivo.id)).toMatchObject({ rol: 'editor', activo: true });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('un editor no puede darse a sí mismo el rol de admin', async () => {
      await comoEditor();

      const resultado = await cambiarRolAccion({ id: ID_EDITOR_DEMO, rol: 'admin' });

      expect(resultado).toMatchObject({ ok: false, codigo: 'sin_permiso' });
      expect((await filaPorId(ID_EDITOR_DEMO))?.rol).toBe('editor');
    });

    it('un anónimo recibe no_autenticado con motivo sin_sesion en las cuatro acciones', async () => {
      const resultados = [
        await invitarMiembro({ nombre: 'Anónimo', correo: correoNuevo(), rol: 'editor' }),
        await reenviarInvitacion({ id: ID_EDITOR_DEMO }),
        await cambiarRolAccion({ id: ID_EDITOR_DEMO, rol: 'admin' }),
        await cambiarActivoAccion({ id: ID_EDITOR_DEMO, activo: false }),
      ];

      for (const resultado of resultados) {
        expect(resultado).toMatchObject({ ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' });
      }
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe('la clave de servicio no sale del servidor (§III.4)', () => {
    it('ningún resultado, de éxito o de error, contiene la clave de servicio', async () => {
      const clave = entorno?.claveServicio ?? '';
      const correo = correoNuevo();
      await comoAdmin();
      const miembro = await crearMiembro('editor');
      const resultados = [
        await invitarMiembro({ nombre: 'Sin filtraciones', correo, rol: 'editor' }),
        await invitarMiembro({ nombre: 'Repetido', correo: 'editor@demo.local', rol: 'editor' }),
        await reenviarInvitacion({ id: ID_EDITOR_DEMO }),
        await reenviarInvitacion({ id: crypto.randomUUID() }),
        // Sigue siendo editor: con un segundo admin, desactivar al demo ya no daría `ultimo_admin`.
        await cambiarRolAccion({ id: miembro.id, rol: 'editor' }),
        await cambiarActivoAccion({ id: idAdmin, activo: false }),
      ];
      const invitada = await filaPorCorreo(correo);
      if (invitada) resultados.push(await reenviarInvitacion({ id: invitada.id }));

      const texto = JSON.stringify(resultados);

      expect(clave.length).toBeGreaterThan(20);
      expect(texto).not.toContain(clave);
      expect(texto.toLowerCase()).not.toContain('service_role');
    });
  });
});
