// T062: operaciones del equipo sobre perfiles (contracts/db.md, "Operaciones del equipo"; H6-E1, H6-E2,
// H6-E4, H6-E5; RF-021, RF-023; research D3, D4, D15). Integración contra Supabase local con las
// sesiones demo del seed y un miembro de prueba propio (su perfil se borra al final).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ClienteBlog } from '../cliente';
import { rechazoDe } from '../pruebas/afirmaciones';
import { crearMiembroDePrueba, restaurarAdminDemo, sesionesDemo, sinSupabase } from '../pruebas/clientes';
import { actualizarPerfilPropio, cambiarActivo, cambiarRol } from './equipo-perfiles';

const sufijo = crypto.randomUUID().slice(0, 8);

describe.skipIf(sinSupabase)('operaciones del equipo sobre perfiles (integración)', () => {
  let editor: ClienteBlog;
  let admin: ClienteBlog;
  let idAdmin: string;
  let miembro: Awaited<ReturnType<typeof crearMiembroDePrueba>> | undefined;

  beforeAll(async () => {
    ({ editor, admin } = await sesionesDemo());
    const { data, error } = await admin.auth.getUser();
    if (error || !data.user) throw new Error('No se pudo obtener el usuario admin');
    idAdmin = data.user.id;
    miembro = await crearMiembroDePrueba(`H6 Miembro ${sufijo}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Si una prueba del último admin fallara aplicando el cambio, el seed quedaría sin admin.
  afterAll(async () => {
    if (idAdmin) await restaurarAdminDemo(idAdmin);
    await miembro?.eliminar();
  });

  function miembroDePrueba() {
    if (!miembro) throw new Error('Falta el miembro de prueba');
    return miembro;
  }

  /** Rol y estado de un perfil, leídos con la sesión del admin demo. */
  async function estadoDe(id: string) {
    const { data, error } = await admin.from('perfiles').select('rol, activo').eq('id', id).single();
    if (error) throw new Error(`No se pudo leer el perfil: ${error.message}`);
    return data;
  }

  describe('actualizarPerfilPropio', () => {
    it('H6-E5: guarda nombre, biografía y foto, y persiste la foto parseada (con decorativa por defecto)', async () => {
      const { id, sesion } = miembroDePrueba();
      const perfil = await actualizarPerfilPropio(sesion, {
        nombre: `H6 Miembro Renombrado ${sufijo}`,
        biografia: 'Escribe sobre el equipo.',
        avatar: { ruta: 'avatares/h6.jpg', ancho: 96, alto: 96, alt: 'Foto del miembro' },
      });

      expect(perfil).toMatchObject({
        id,
        nombre: `H6 Miembro Renombrado ${sufijo}`,
        biografia: 'Escribe sobre el equipo.',
        avatar: { ruta: 'avatares/h6.jpg', ancho: 96, alto: 96, alt: 'Foto del miembro', decorativa: false },
      });
    });

    it('H6-E5: con avatar null quita la foto', async () => {
      const perfil = await actualizarPerfilPropio(miembroDePrueba().sesion, { avatar: null });

      expect(perfil.avatar).toBeNull();
    });

    it('D15: rechaza un avatar sin alt con contenido_invalido, sin llamar a la base', async () => {
      const espiaFetch = vi.spyOn(globalThis, 'fetch');
      const error = await rechazoDe(
        actualizarPerfilPropio(miembroDePrueba().sesion, {
          avatar: { ruta: 'avatares/h6.jpg', ancho: 96, alto: 96 },
        }),
      );

      expect(error.codigo).toBe('contenido_invalido');
      expect(error.errores).toEqual([expect.objectContaining({ indice: -1, campo: 'avatar.alt' })]);
      expect(espiaFetch).not.toHaveBeenCalled();
    });

    it('D15: rechaza un avatar con medidas no enteras con contenido_invalido, sin llamar a la base', async () => {
      const espiaFetch = vi.spyOn(globalThis, 'fetch');
      const error = await rechazoDe(
        actualizarPerfilPropio(miembroDePrueba().sesion, {
          avatar: { ruta: 'avatares/h6.jpg', ancho: 96.5, alto: 96, alt: 'Foto' },
        }),
      );

      expect(error.codigo).toBe('contenido_invalido');
      expect(error.errores).toEqual([expect.objectContaining({ indice: -1, campo: 'avatar.ancho' })]);
      expect(espiaFetch).not.toHaveBeenCalled();
    });
  });

  describe('cambiarRol y cambiarActivo', () => {
    it('RF-023: el admin promueve a un editor a admin y lo vuelve a editor', async () => {
      const { id } = miembroDePrueba();

      await cambiarRol(admin, id, 'admin');
      expect(await estadoDe(id)).toEqual({ rol: 'admin', activo: true });

      await cambiarRol(admin, id, 'editor');
      expect(await estadoDe(id)).toEqual({ rol: 'editor', activo: true });
    });

    it('RF-023: el admin desactiva y reactiva a un miembro', async () => {
      const { id } = miembroDePrueba();

      await cambiarActivo(admin, id, false);
      expect(await estadoDe(id)).toEqual({ rol: 'editor', activo: false });

      await cambiarActivo(admin, id, true);
      expect(await estadoDe(id)).toEqual({ rol: 'editor', activo: true });
    });

    it('H6-E2: un editor que cambia su propio rol recibe sin_permiso', async () => {
      const { id, sesion } = miembroDePrueba();
      const error = await rechazoDe(cambiarRol(sesion, id, 'admin'));

      expect(error.codigo).toBe('sin_permiso');
      expect(await estadoDe(id)).toEqual({ rol: 'editor', activo: true });
    });

    it('H6-E2: un editor no puede cambiar el rol ni el estado de otro miembro', async () => {
      const { id } = miembroDePrueba();
      // Sin política de update sobre filas ajenas, la base no ve la fila (0 filas afectadas).
      const errorRol = await rechazoDe(cambiarRol(editor, id, 'admin'));
      const errorActivo = await rechazoDe(cambiarActivo(editor, id, false));

      expect(['sin_permiso', 'no_encontrado']).toContain(errorRol.codigo);
      expect(['sin_permiso', 'no_encontrado']).toContain(errorActivo.codigo);
      expect(await estadoDe(id)).toEqual({ rol: 'editor', activo: true });
    });

    it('H6-E4: cambiarRol sobre el último admin lanza ErrorDominio(ultimo_admin)', async () => {
      const { data: admins, error: errorAdmins } = await admin
        .from('perfiles')
        .select('id')
        .eq('rol', 'admin')
        .eq('activo', true);
      if (errorAdmins) throw new Error(`No se pudieron leer los admins: ${errorAdmins.message}`);
      expect(admins.map((fila) => fila.id)).toEqual([idAdmin]); // precondición: el admin demo es el único

      const error = await rechazoDe(cambiarRol(admin, idAdmin, 'editor'));

      expect(error.codigo).toBe('ultimo_admin');
      expect(await estadoDe(idAdmin)).toEqual({ rol: 'admin', activo: true });
    });

    it('H6-E4: cambiarActivo(false) sobre el último admin lanza ErrorDominio(ultimo_admin)', async () => {
      const error = await rechazoDe(cambiarActivo(admin, idAdmin, false));

      expect(error.codigo).toBe('ultimo_admin');
      expect(await estadoDe(idAdmin)).toEqual({ rol: 'admin', activo: true });
    });
  });

  describe('alta por la Admin API (H6-E1, nota de T063)', () => {
    it('H6-E1: un usuario creado con app_metadata.rol = editor queda editor activo sin activarlo a mano', async () => {
      const nuevo = await crearMiembroDePrueba(`H6 Alta ${sufijo}`, { activarComoServicio: false });
      try {
        expect(await estadoDe(nuevo.id)).toEqual({ rol: 'editor', activo: true });
      } finally {
        await nuevo.eliminar();
      }
    });
  });
});
