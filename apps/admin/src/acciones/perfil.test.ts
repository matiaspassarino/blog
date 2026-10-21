// T088 (spec 003, H6-E7, H6-E8, RF-025, D11): Server Action del perfil propio, contra Supabase local.
// FASE ROJA: `./perfil` no existe aún (T095).
//
// Firma supuesta, exportada desde './perfil' (`'use server'`). Recibe UN OBJETO y devuelve `ResultadoAccion<Perfil>`:
//   guardarPerfil({ nombre, biografia?, avatar?: Imagen | null }): ResultadoAccion<Perfil>
//     `datos` es el perfil ya guardado. El esquema Zod solo admite `nombre` (1 a 80), `biografia` (<= 500) y `avatar`
//     (`esquemaImagen` o `null`): cualquier otra clave (`rol`, `activo`) se DESCARTA sin error. Un campo omitido no se toca
//     (en particular, sin `avatar` la foto actual se conserva).
//   Errores:
//     - sin sesión -> { ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' }.
//     - nombre vacío o de más de 80, biografía de más de 500 -> 'validacion', sin tocar la base.
//     - avatar sin `alt` y sin `decorativa` -> 'contenido_invalido' con `errores` ({ indice: -1, campo: 'avatar.alt', mensaje }).
// Efectos: revalidatePath('/perfil'). Al cambiar o quitar el avatar se borra del bucket `medios` la imagen anterior que ya
// ningún contenido usa (artículo o perfil), mejor esfuerzo y después de guardar (D11); si algo más la usa, se conserva.
import type { ClienteBlog } from '@blog/db';
import { cambiarActivo, cambiarRol } from '@blog/db';
import { clienteComo, pngMinimo, rechazoDe, sinSupabase } from '@blog/db/pruebas';
import type {} from '@blog/db/pruebas/entorno'; // declara el contexto `supabase` que provee globalSetup
import { crearClienteAdmin } from '@blog/db/servicio';
import { revalidatePath } from 'next/cache';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { almacenCookies, correr, formulario } from '../test/next-simulado';
import { guardarPerfil } from './perfil';

vi.mock('next/headers', async () => (await import('../test/next-simulado')).moduloHeaders);
vi.mock('next/navigation', async () => (await import('../test/next-simulado')).moduloNavegacion);
vi.mock('next/cache', async () => (await import('../test/next-simulado')).moduloCache);

const entorno = inject('supabase');
const sufijo = crypto.randomUUID().slice(0, 8);
const PREFIJO_CORREO = `t088-${sufijo}`;

type Miembro = { id: string; correo: string; contrasenia: string };

describe.skipIf(sinSupabase)('Server Action del perfil propio (H6)', () => {
  let servicio: ClienteBlog;
  let miembro: Miembro;
  const objetos: string[] = [];
  let contador = 0;

  beforeAll(async () => {
    if (!entorno?.claveServicio) throw new Error('Falta la clave de servicio de Supabase local');
    process.env.NEXT_PUBLIC_SUPABASE_URL = entorno.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = entorno.claveAnon;
    process.env.NEXT_PUBLIC_URL_ADMIN = 'http://localhost:3100';
    servicio = crearClienteAdmin(entorno.url, entorno.claveServicio);
    miembro = await crearMiembro('editor', 'Perfil Original');
  });

  beforeEach(async () => {
    almacenCookies.clear();
    vi.mocked(revalidatePath).mockClear();
    // Cada prueba parte del mismo perfil: sin foto y con datos conocidos.
    await servicio
      .from('perfiles')
      .update({ nombre: 'Perfil Original', biografia: 'Biografía original', avatar: null, rol: 'editor', activo: true })
      .eq('id', miembro.id);
  });

  afterAll(async () => {
    if (!servicio) return;
    if (objetos.length > 0) await servicio.storage.from('medios').remove(objetos);
    const { data } = await servicio.auth.admin.listUsers({ perPage: 200 });
    for (const usuario of data.users.filter((u) => u.email?.startsWith(PREFIJO_CORREO))) {
      await servicio.from('perfiles').delete().eq('id', usuario.id);
      await servicio.auth.admin.deleteUser(usuario.id);
    }
  });

  async function crearMiembro(rol: 'editor' | 'admin', nombre: string): Promise<Miembro> {
    const correo = `${PREFIJO_CORREO}-${(contador += 1)}@prueba.local`;
    const contrasenia = `prueba-${crypto.randomUUID()}`;
    const { data, error } = await servicio.auth.admin.createUser({
      email: correo,
      password: contrasenia,
      email_confirm: true,
      user_metadata: { nombre },
      app_metadata: { rol },
    });
    if (error || !data.user) throw new Error(`No se pudo crear el miembro: ${error?.message}`);
    await servicio.from('perfiles').update({ rol, activo: true }).eq('id', data.user.id);
    return { id: data.user.id, correo, contrasenia };
  }

  async function ingresarComo({ correo, contrasenia }: Miembro) {
    const { ingresar } = await import('./acceso');
    almacenCookies.clear();
    await correr(() => ingresar(null, formulario({ correo, contrasenia })));
  }

  async function perfilDe(id: string) {
    const { data, error } = await servicio.from('perfiles').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  }

  /** Sube una imagen al bucket (como lo hace el navegador) y devuelve la imagen lista para el avatar. */
  async function subirAvatar(alt = 'Foto de perfil de prueba') {
    const ruta = `perfiles/${miembro.id}/${crypto.randomUUID()}.png`;
    const { error } = await servicio.storage
      .from('medios')
      .upload(ruta, pngMinimo(40, 40), { contentType: 'image/png' });
    if (error) throw new Error(`No se pudo subir ${ruta}: ${error.message}`);
    objetos.push(ruta);
    return { ruta, ancho: 40, alto: 40, alt, decorativa: false };
  }

  const existeObjeto = async (ruta: string) => (await servicio.storage.from('medios').download(ruta)).data !== null;

  describe('datos del perfil (H6-E7)', () => {
    it('H6-E7: actualiza nombre y biografía del miembro que llama', async () => {
      await ingresarComo(miembro);

      const resultado = await guardarPerfil({ nombre: 'Nombre Nuevo', biografia: 'Una biografía nueva' });

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.datos).toMatchObject({
        id: miembro.id,
        nombre: 'Nombre Nuevo',
        biografia: 'Una biografía nueva',
      });
      expect(await perfilDe(miembro.id)).toMatchObject({ nombre: 'Nombre Nuevo', biografia: 'Una biografía nueva' });
      expect(revalidatePath).toHaveBeenCalledWith('/perfil');
    });

    it('H6-E7: un admin también edita su propio perfil', async () => {
      const otroAdmin = await crearMiembro('admin', 'Admin Propio');
      await ingresarComo(otroAdmin);

      const resultado = await guardarPerfil({ nombre: 'Admin Renombrado' });

      expect(resultado.ok).toBe(true);
      expect((await perfilDe(otroAdmin.id)).nombre).toBe('Admin Renombrado');
    });

    it('H6-E7: guarda un avatar válido con su texto alternativo', async () => {
      await ingresarComo(miembro);
      const avatar = await subirAvatar('Retrato de la persona');

      const resultado = await guardarPerfil({ nombre: 'Con Foto', avatar });

      expect(resultado.ok).toBe(true);
      expect((await perfilDe(miembro.id)).avatar).toMatchObject({
        ruta: avatar.ruta,
        ancho: 40,
        alto: 40,
        alt: 'Retrato de la persona',
        decorativa: false,
      });
    });

    it('H6-E7: un avatar decorativo no necesita texto alternativo', async () => {
      await ingresarComo(miembro);
      const { alt: _alt, ...sinAlt } = await subirAvatar();

      const resultado = await guardarPerfil({ nombre: 'Foto Decorativa', avatar: { ...sinAlt, decorativa: true } });

      expect(resultado.ok).toBe(true);
      expect((await perfilDe(miembro.id)).avatar).toMatchObject({ decorativa: true });
    });

    it('H6-E7: un campo omitido no se toca (sin avatar, la foto actual se conserva)', async () => {
      await ingresarComo(miembro);
      const avatar = await subirAvatar();
      await guardarPerfil({ nombre: 'Con Foto', avatar });

      const resultado = await guardarPerfil({ nombre: 'Solo Nombre' });

      expect(resultado.ok).toBe(true);
      const perfil = await perfilDe(miembro.id);
      expect(perfil.nombre).toBe('Solo Nombre');
      expect(perfil.avatar).toMatchObject({ ruta: avatar.ruta });
      expect(await existeObjeto(avatar.ruta)).toBe(true);
    });
  });

  describe('validación (RF-025)', () => {
    it('H6-E7: un avatar sin alt y sin decorativa devuelve contenido_invalido con el campo y no cambia nada', async () => {
      await ingresarComo(miembro);
      const { alt: _alt, ...sinAlt } = await subirAvatar();

      const resultado = await guardarPerfil({ nombre: 'No debería guardarse', avatar: sinAlt as never });

      expect(resultado).toMatchObject({ ok: false, codigo: 'contenido_invalido' });
      if (resultado.ok) return;
      expect(resultado.errores).toEqual(
        expect.arrayContaining([expect.objectContaining({ indice: -1, campo: 'avatar.alt' })]),
      );
      expect(await perfilDe(miembro.id)).toMatchObject({ nombre: 'Perfil Original', avatar: null });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('RF-025: un nombre vacío o de más de 80 caracteres devuelve validacion', async () => {
      await ingresarComo(miembro);

      for (const nombre of ['', '   ', 'n'.repeat(81)]) {
        expect(await guardarPerfil({ nombre })).toMatchObject({ ok: false, codigo: 'validacion' });
      }
      expect((await perfilDe(miembro.id)).nombre).toBe('Perfil Original');
    });

    it('RF-025: una biografía de más de 500 caracteres devuelve validacion; de exactamente 500 es válida', async () => {
      await ingresarComo(miembro);

      const larga = await guardarPerfil({ nombre: 'Biografía larga', biografia: 'b'.repeat(501) });
      const justa = await guardarPerfil({ nombre: 'Biografía justa', biografia: 'b'.repeat(500) });

      expect(larga).toMatchObject({ ok: false, codigo: 'validacion' });
      expect(justa.ok).toBe(true);
    });

    it('RF-025: un nombre de exactamente 80 caracteres es válido', async () => {
      await ingresarComo(miembro);

      const resultado = await guardarPerfil({ nombre: 'n'.repeat(80) });

      expect(resultado.ok).toBe(true);
    });
  });

  describe('rol y estado no se pueden cambiar (H6-E8)', () => {
    it('H6-E8: el esquema descarta rol y activo enviados a propósito y el resto se guarda', async () => {
      await ingresarComo(miembro);

      const resultado = await guardarPerfil({ nombre: 'Intento de ascenso', rol: 'admin', activo: false } as never);

      expect(resultado.ok).toBe(true);
      expect(await perfilDe(miembro.id)).toMatchObject({ nombre: 'Intento de ascenso', rol: 'editor', activo: true });
    });

    it('H6-E8: aunque se salte la acción, la base rechaza que un miembro cambie su propio rol o estado', async () => {
      const propia = await clienteComo(miembro.correo, miembro.contrasenia);

      await rechazoDe(cambiarRol(propia, miembro.id, 'admin'));
      await rechazoDe(cambiarActivo(propia, miembro.id, false));

      expect(await perfilDe(miembro.id)).toMatchObject({ rol: 'editor', activo: true });
    });
  });

  describe('imágenes sin uso (D11)', () => {
    it('D11: al cambiar el avatar se borra la imagen anterior del bucket', async () => {
      await ingresarComo(miembro);
      const anterior = await subirAvatar('Foto vieja');
      await guardarPerfil({ nombre: 'Foto vieja', avatar: anterior });
      const nueva = await subirAvatar('Foto nueva');

      const resultado = await guardarPerfil({ nombre: 'Foto nueva', avatar: nueva });

      expect(resultado.ok).toBe(true);
      expect(await existeObjeto(anterior.ruta)).toBe(false);
      expect(await existeObjeto(nueva.ruta)).toBe(true);
    });

    it('D11: al quitar el avatar (null) se borra la imagen del bucket y el perfil queda sin foto', async () => {
      await ingresarComo(miembro);
      const avatar = await subirAvatar();
      await guardarPerfil({ nombre: 'Con foto', avatar });

      const resultado = await guardarPerfil({ nombre: 'Sin foto', avatar: null });

      expect(resultado.ok).toBe(true);
      expect((await perfilDe(miembro.id)).avatar).toBeNull();
      expect(await existeObjeto(avatar.ruta)).toBe(false);
    });

    it('D11: guardar con la misma imagen no la borra', async () => {
      await ingresarComo(miembro);
      const avatar = await subirAvatar();
      await guardarPerfil({ nombre: 'Misma foto', avatar });

      const resultado = await guardarPerfil({
        nombre: 'Misma foto otra vez',
        avatar: { ...avatar, alt: 'Otro texto' },
      });

      expect(resultado.ok).toBe(true);
      expect(await existeObjeto(avatar.ruta)).toBe(true);
    });

    it('D11: si otro contenido sigue usando la imagen anterior, no se borra', async () => {
      await ingresarComo(miembro);
      const compartida = await subirAvatar('Foto compartida');
      await guardarPerfil({ nombre: 'Foto compartida', avatar: compartida });
      const otro = await crearMiembro('editor', 'Usa la misma foto');
      await servicio.from('perfiles').update({ avatar: compartida }).eq('id', otro.id);

      const resultado = await guardarPerfil({ nombre: 'Ya sin foto', avatar: null });

      expect(resultado.ok).toBe(true);
      expect((await perfilDe(miembro.id)).avatar).toBeNull();
      expect(await existeObjeto(compartida.ruta)).toBe(true);
    });
  });

  describe('sin sesión', () => {
    it('un anónimo recibe no_autenticado con motivo sin_sesion y no cambia nada', async () => {
      const resultado = await guardarPerfil({ nombre: 'Anónimo' });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' });
      expect((await perfilDe(miembro.id)).nombre).toBe('Perfil Original');
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('un miembro desactivado recibe no_autenticado con motivo desactivada', async () => {
      await ingresarComo(miembro);
      await servicio.from('perfiles').update({ activo: false }).eq('id', miembro.id);

      const resultado = await guardarPerfil({ nombre: 'Desactivado' });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_autenticado', motivo: 'desactivada' });
      expect((await perfilDe(miembro.id)).nombre).toBe('Perfil Original');
    });
  });
});
