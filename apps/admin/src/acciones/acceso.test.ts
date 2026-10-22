// T039 (spec 003, H1): Server Actions de acceso, contra Supabase local. FASE ROJA: `./acceso` no existe aún.
//
// Firmas supuestas (T044), exportadas desde './acceso' (`'use server'`), pensadas para `useActionState`:
//   ingresar(estado: ResultadoAccion | null, formData: FormData): Promise<ResultadoAccion>
//     campos del FormData: `correo`, `contrasenia`, `volver` (opcional). Con éxito NO devuelve: redirige
//     (lanza `redirect`) a `rutaInterna(volver)`. Con error devuelve `{ ok: false, codigo, mensaje }`.
//   cerrarSesion(): Promise<never>              signOut + borra `blog_actividad` + redirect('/ingreso').
//   pedirRecuperacion(estado, formData)         campo `correo`. Siempre `{ ok: true, datos }` (mismo valor exista o no).
//   confirmarEnlace(estado, formData)           campos `tokenHash`, `tipo` ('invite' | 'recovery').
//     Éxito: redirect('/definir-contrasena'). Enlace usado/vencido/ilegible: `{ ok: false, codigo: 'enlace_invalido' }`.
//   definirContrasena(estado, formData)         campos `contrasenia`, `repetir`. Éxito: redirect('/articulos').
//     Errores: 'contrasenia_corta' (< 8, RF-028), 'no_coinciden'; sin sesión abierta: 'no_autenticado'/'sin_sesion'.
//   exigirMiembroEnAccion(): Promise<{ miembro: MiembroSesion } | { fallo: ResultadoAccion<never> }>
//     ayuda que usan las acciones del panel (paso 1 de "Reglas comunes"): sin sesión válida y activa devuelve
//     `fallo = no_autenticado` con `motivo: 'sin_sesion' | 'desactivada'`. Vive en lib/accion.ts (no en acceso.ts:
//     un export de un archivo 'use server' se vuelve un punto de entrada invocable desde el navegador).
// Los códigos nuevos ('enlace_invalido', 'contrasenia_corta', 'no_coinciden') se agregan a `CodigoMensaje`.
// Se simulan `next/headers` (almacén de cookies en memoria) y `next/navigation` (`redirect` lanza un
// error reconocible), así las acciones corren sin servidor Next.
import { crearClienteAdmin } from '@blog/db/servicio';
import { sinSupabase } from '@blog/db/pruebas';
import type {} from '@blog/db/pruebas/entorno'; // declara el contexto `supabase` que provee globalSetup
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { COOKIE_ACTIVIDAD } from '../lib/actividad';
import { almacenCookies, correr, formulario, hayCookieDeSesion } from '../test/next-simulado';

vi.mock('next/headers', async () => (await import('../test/next-simulado')).moduloHeaders);
vi.mock('next/navigation', async () => (await import('../test/next-simulado')).moduloNavegacion);
vi.mock('next/cache', async () => (await import('../test/next-simulado')).moduloCache);

const entorno = inject('supabase');

describe.skipIf(sinSupabase)('Server Actions de acceso (H1)', () => {
  const miembrosCreados: string[] = [];
  let servicio: ReturnType<typeof crearClienteAdmin>;

  beforeAll(() => {
    if (!entorno?.claveServicio) throw new Error('Falta la clave de servicio de Supabase local');
    process.env.NEXT_PUBLIC_SUPABASE_URL = entorno.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = entorno.claveAnon;
    process.env.NEXT_PUBLIC_URL_ADMIN = 'http://localhost:3100';
    servicio = crearClienteAdmin(entorno.url, entorno.claveServicio);
  });

  beforeEach(() => almacenCookies.clear());

  afterEach(async () => {
    for (const id of miembrosCreados.splice(0)) {
      await servicio.from('perfiles').delete().eq('id', id);
      await servicio.auth.admin.deleteUser(id);
    }
  });

  afterAll(() => almacenCookies.clear());

  async function crearMiembro({ activo = true } = {}) {
    const correo = `acceso-${crypto.randomUUID().slice(0, 8)}@prueba.local`;
    const contrasenia = `prueba-${crypto.randomUUID()}`;
    const { data, error } = await servicio.auth.admin.createUser({
      email: correo,
      password: contrasenia,
      email_confirm: true,
      user_metadata: { nombre: 'Miembro de prueba' },
      app_metadata: { rol: 'editor' },
    });
    if (error || !data.user) throw new Error(`No se pudo crear el miembro: ${error?.message}`);
    miembrosCreados.push(data.user.id);
    await servicio.from('perfiles').update({ activo }).eq('id', data.user.id);
    return { id: data.user.id, correo, contrasenia };
  }

  async function tokenDeRecuperacion(correo: string) {
    const { data, error } = await servicio.auth.admin.generateLink({ type: 'recovery', email: correo });
    if (error || !data.properties) throw new Error(`No se pudo generar el enlace: ${error?.message}`);
    return data.properties.hashed_token;
  }

  describe('ingresar', () => {
    it('H1-E1: con credenciales correctas redirige a la lista de artículos y deja la sesión abierta', async () => {
      const { ingresar } = await import('./acceso');
      const salida = await correr(() =>
        ingresar(null, formulario({ correo: 'editor@demo.local', contrasenia: 'demo-editor-2026' })),
      );
      expect(salida).toEqual({ redirigio: '/articulos' });
      expect(hayCookieDeSesion()).toBe(true);
    });

    it('H1-E4: con `volver` interno redirige ahí', async () => {
      const { ingresar } = await import('./acceso');
      const salida = await correr(() =>
        ingresar(
          null,
          formulario({ correo: 'admin@demo.local', contrasenia: 'demo-admin-2026', volver: '/articulos/nuevo' }),
        ),
      );
      expect(salida).toEqual({ redirigio: '/articulos/nuevo' });
    });

    it.each(['//evil.com', 'https://evil.com', '/\\evil.com'])(
      'H1-E4: con `volver` externo (%s) redirige a /articulos',
      async (volver) => {
        const { ingresar } = await import('./acceso');
        const salida = await correr(() =>
          ingresar(null, formulario({ correo: 'editor@demo.local', contrasenia: 'demo-editor-2026', volver })),
        );
        expect(salida).toEqual({ redirigio: '/articulos' });
      },
    );

    it('H1-E2: contraseña incorrecta y correo inexistente devuelven credenciales_invalidas con el mismo mensaje', async () => {
      const { ingresar } = await import('./acceso');
      const contraseniaMala = await correr(() =>
        ingresar(null, formulario({ correo: 'editor@demo.local', contrasenia: 'no-es-esta' })),
      );
      const correoMalo = await correr(() =>
        ingresar(null, formulario({ correo: 'nadie@demo.local', contrasenia: 'no-es-esta' })),
      );
      expect(contraseniaMala).toMatchObject({ resultado: { ok: false, codigo: 'credenciales_invalidas' } });
      expect(correoMalo).toMatchObject({ resultado: { ok: false, codigo: 'credenciales_invalidas' } });
      expect(contraseniaMala).toEqual(correoMalo);
      expect(hayCookieDeSesion()).toBe(false);
    });

    it('H1-E3: con el perfil desactivado devuelve cuenta_desactivada y deja la sesión cerrada', async () => {
      const { ingresar } = await import('./acceso');
      const miembro = await crearMiembro({ activo: false });
      const salida = await correr(() =>
        ingresar(null, formulario({ correo: miembro.correo, contrasenia: miembro.contrasenia })),
      );
      expect(salida).toMatchObject({ resultado: { ok: false, codigo: 'cuenta_desactivada' } });
      expect(hayCookieDeSesion()).toBe(false);
    });

    it('H1-E3: con la contraseña mal, una cuenta desactivada no se distingue de una inexistente', async () => {
      const { ingresar } = await import('./acceso');
      const miembro = await crearMiembro({ activo: false });
      const salida = await correr(() =>
        ingresar(null, formulario({ correo: miembro.correo, contrasenia: 'mala-123' })),
      );
      expect(salida).toMatchObject({ resultado: { ok: false, codigo: 'credenciales_invalidas' } });
    });
  });

  describe('cerrarSesion', () => {
    it('H1-E5: cierra la sesión, borra blog_actividad y redirige a /ingreso', async () => {
      const { ingresar, cerrarSesion } = await import('./acceso');
      await correr(() => ingresar(null, formulario({ correo: 'editor@demo.local', contrasenia: 'demo-editor-2026' })));
      almacenCookies.set(COOKIE_ACTIVIDAD, String(Date.now()));
      expect(hayCookieDeSesion()).toBe(true);

      const salida = await correr(() => cerrarSesion());

      expect(salida).toEqual({ redirigio: '/ingreso' });
      expect(almacenCookies.has(COOKIE_ACTIVIDAD)).toBe(false);
      expect(hayCookieDeSesion()).toBe(false);
    });
  });

  describe('pedirRecuperacion', () => {
    it('H1-E7: responde ok y lo mismo exista o no el correo', async () => {
      const { pedirRecuperacion } = await import('./acceso');
      const existente = await correr(() => pedirRecuperacion(null, formulario({ correo: 'editora@demo.local' })));
      const inexistente = await correr(() => pedirRecuperacion(null, formulario({ correo: 'nadie@demo.local' })));
      expect(existente).toMatchObject({ resultado: { ok: true } });
      expect(inexistente).toEqual(existente);
    });
  });

  describe('confirmarEnlace', () => {
    it('H1-E7: con un enlace de recuperación válido abre la sesión y redirige a /definir-contrasena', async () => {
      const { confirmarEnlace } = await import('./acceso');
      const miembro = await crearMiembro();
      const tokenHash = await tokenDeRecuperacion(miembro.correo);
      const salida = await correr(() => confirmarEnlace(null, formulario({ tokenHash, tipo: 'recovery' })));
      expect(salida).toEqual({ redirigio: '/definir-contrasena' });
      expect(hayCookieDeSesion()).toBe(true);
    });

    it('H1-E7: el enlace es de un solo uso: la segunda vez devuelve enlace_invalido', async () => {
      const { confirmarEnlace } = await import('./acceso');
      const miembro = await crearMiembro();
      const tokenHash = await tokenDeRecuperacion(miembro.correo);
      await correr(() => confirmarEnlace(null, formulario({ tokenHash, tipo: 'recovery' })));
      almacenCookies.clear();

      const segunda = await correr(() => confirmarEnlace(null, formulario({ tokenHash, tipo: 'recovery' })));

      expect(segunda).toMatchObject({ resultado: { ok: false, codigo: 'enlace_invalido' } });
      expect(hayCookieDeSesion()).toBe(false);
    });

    it('H1-E7: un token inventado devuelve enlace_invalido', async () => {
      const { confirmarEnlace } = await import('./acceso');
      const salida = await correr(() =>
        confirmarEnlace(null, formulario({ tokenHash: 'inventado', tipo: 'recovery' })),
      );
      expect(salida).toMatchObject({ resultado: { ok: false, codigo: 'enlace_invalido' } });
    });
  });

  describe('definirContrasena', () => {
    async function conSesionDeRecuperacion() {
      const { confirmarEnlace } = await import('./acceso');
      const miembro = await crearMiembro();
      const tokenHash = await tokenDeRecuperacion(miembro.correo);
      await correr(() => confirmarEnlace(null, formulario({ tokenHash, tipo: 'recovery' })));
      return miembro;
    }

    it('RF-028: rechaza menos de 8 caracteres con contrasenia_corta', async () => {
      const { definirContrasena } = await import('./acceso');
      await conSesionDeRecuperacion();
      const salida = await correr(() =>
        definirContrasena(null, formulario({ contrasenia: 'abc1234', repetir: 'abc1234' })),
      );
      expect(salida).toMatchObject({ resultado: { ok: false, codigo: 'contrasenia_corta' } });
    });

    it('RF-028: acepta exactamente 8 caracteres', async () => {
      const { definirContrasena } = await import('./acceso');
      await conSesionDeRecuperacion();
      const salida = await correr(() =>
        definirContrasena(null, formulario({ contrasenia: 'abcd1234', repetir: 'abcd1234' })),
      );
      expect(salida).toEqual({ redirigio: '/articulos' });
    });

    it('H1-E7: rechaza repeticiones distintas con no_coinciden', async () => {
      const { definirContrasena } = await import('./acceso');
      await conSesionDeRecuperacion();
      const salida = await correr(() =>
        definirContrasena(null, formulario({ contrasenia: 'contrasenia-nueva-1', repetir: 'contrasenia-nueva-2' })),
      );
      expect(salida).toMatchObject({ resultado: { ok: false, codigo: 'no_coinciden' } });
    });

    it('H1-E7: con datos válidos cambia la contraseña y se puede ingresar con la nueva', async () => {
      const { definirContrasena, ingresar } = await import('./acceso');
      const miembro = await conSesionDeRecuperacion();
      const nueva = `nueva-${crypto.randomUUID()}`;

      const salida = await correr(() => definirContrasena(null, formulario({ contrasenia: nueva, repetir: nueva })));
      expect(salida).toEqual({ redirigio: '/articulos' });

      almacenCookies.clear();
      const conNueva = await correr(() => ingresar(null, formulario({ correo: miembro.correo, contrasenia: nueva })));
      expect(conNueva).toEqual({ redirigio: '/articulos' });
      almacenCookies.clear();
      const conVieja = await correr(() =>
        ingresar(null, formulario({ correo: miembro.correo, contrasenia: miembro.contrasenia })),
      );
      expect(conVieja).toMatchObject({ resultado: { ok: false, codigo: 'credenciales_invalidas' } });
    });

    it('H1-E7: sin sesión abierta devuelve no_autenticado', async () => {
      const { definirContrasena } = await import('./acceso');
      const salida = await correr(() =>
        definirContrasena(null, formulario({ contrasenia: 'contrasenia-valida', repetir: 'contrasenia-valida' })),
      );
      expect(salida).toMatchObject({ resultado: { ok: false, codigo: 'no_autenticado' } });
    });
  });

  describe('perfil desactivado con la sesión abierta (H1-E6)', () => {
    it('H1-E6: la capa de sesión trata al miembro desactivado como anónimo con motivo desactivada', async () => {
      // `acceso.ts` es lo que abre la sesión de este miembro; luego el admin lo desactiva.
      const { confirmarEnlace } = await import('./acceso');
      const { obtenerMiembro } = await import('../lib/sesion');
      const miembro = await crearMiembro();
      const tokenHash = await tokenDeRecuperacion(miembro.correo);
      await correr(() => confirmarEnlace(null, formulario({ tokenHash, tipo: 'recovery' })));
      expect((await obtenerMiembro()).miembro?.id).toBe(miembro.id);

      await servicio.from('perfiles').update({ activo: false }).eq('id', miembro.id);

      const sesion = await obtenerMiembro();
      expect(sesion.miembro).toBeNull();
      expect(sesion.motivo).toBe('desactivada');
    });

    it('H1-E6: una acción que exige miembro, llamada con un perfil desactivado, devuelve no_autenticado/desactivada', async () => {
      // `exigirMiembroEnAccion` (T044) es la ayuda de acceso.ts que usan las acciones del panel:
      // devuelve `{ miembro }` o `{ fallo }` con el ResultadoAccion que hay que devolver.
      const { confirmarEnlace } = await import('./acceso');
      const { exigirMiembroEnAccion } = await import('../lib/accion');
      const miembro = await crearMiembro();
      const tokenHash = await tokenDeRecuperacion(miembro.correo);
      await correr(() => confirmarEnlace(null, formulario({ tokenHash, tipo: 'recovery' })));
      await servicio.from('perfiles').update({ activo: false }).eq('id', miembro.id);

      const resultado = await exigirMiembroEnAccion();

      expect(resultado).toMatchObject({
        fallo: { ok: false, codigo: 'no_autenticado', motivo: 'desactivada' },
      });
    });
  });
});
