// T049 (spec 003, H2-E4, RF-007, D9 y D10): Server Actions de medios, contra Supabase local.
// FASE ROJA: `./medios` no existe aún.
//
// Firmas supuestas (T055), exportadas desde './medios' (`'use server'`). Reciben UN OBJETO y devuelven
// `ResultadoAccion<T>` (lib/resultado.ts):
//   firmarSubidaMedio({ nombre: string, bytes: number }): Promise<ResultadoAccion<{ ruta: string; token: string; urlFirmada: string }>>
//     `ruta` = `articulos/AAAA/MM/<uuid>.<ext>` (sin `medios/` ni `/` inicial; la extensión sale del nombre).
//     bytes > 5 242 880 (o no positivo / no entero) -> { ok: false, codigo: 'imagen_invalida' }; exactamente 5 242 880 es válido.
//   registrarMedio({ ruta: string }): Promise<ResultadoAccion<{ ruta: string; ancho: number; alto: number }>>
//     Descarga el objeto con la sesión, `detectarImagen`; si no es JPEG/PNG/WebP/AVIF borra el objeto y devuelve
//     `imagen_invalida` con el mensaje "Solo se aceptan imágenes JPEG, PNG, WebP o AVIF"; ruta inexistente -> 'no_encontrado'.
//   Sin sesión: { ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' } en ambas.
// El navegador sube con `uploadToSignedUrl`; aquí se hace igual con la sesión del editor demo (API de Storage).
import {
  gifMinimo,
  jpegMinimo,
  pngMinimo,
  sesionesDemo,
  sinSupabase,
  svgMinimo,
  textoPlanoComoArchivo,
} from '@blog/db/pruebas';
import type { ClienteBlog } from '@blog/db';
import type {} from '@blog/db/pruebas/entorno'; // declara el contexto `supabase` que provee globalSetup
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { almacenCookies, correr, formulario } from '../test/next-simulado';

vi.mock('next/headers', async () => (await import('../test/next-simulado')).moduloHeaders);
vi.mock('next/navigation', async () => (await import('../test/next-simulado')).moduloNavegacion);
vi.mock('next/cache', async () => (await import('../test/next-simulado')).moduloCache);

const entorno = inject('supabase');
const LIMITE = 5_242_880;
const MENSAJE_FORMATO = /JPEG, PNG, WebP o AVIF/;

describe.skipIf(sinSupabase)('Server Actions de medios (H2)', () => {
  let editor: ClienteBlog;
  let admin: ClienteBlog;
  const subidas: string[] = [];

  beforeAll(async () => {
    if (!entorno) throw new Error('Supabase local no disponible');
    process.env.NEXT_PUBLIC_SUPABASE_URL = entorno.url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = entorno.claveAnon;
    process.env.NEXT_PUBLIC_URL_ADMIN = 'http://localhost:3100';
    ({ editor, admin } = await sesionesDemo());
  });

  beforeEach(() => almacenCookies.clear());

  afterAll(async () => {
    if (admin && subidas.length > 0) await admin.storage.from('medios').remove(subidas);
  });

  async function comoEditor() {
    const { ingresar } = await import('./acceso');
    almacenCookies.clear();
    await correr(() => ingresar(null, formulario({ correo: 'editor@demo.local', contrasenia: 'demo-editor-2026' })));
  }

  /** Pide la firma con la acción y sube como lo hace el navegador (`uploadToSignedUrl`). */
  async function subirComoElNavegador(nombre: string, contenido: Uint8Array, tipoDeclarado: string) {
    const { firmarSubidaMedio } = await import('./medios');
    const firma = await firmarSubidaMedio({ nombre, bytes: contenido.byteLength });
    if (!firma.ok) throw new Error(`No se pudo firmar la subida: ${firma.mensaje}`);
    const { error } = await editor.storage
      .from('medios')
      .uploadToSignedUrl(firma.datos.ruta, firma.datos.token, contenido, { contentType: tipoDeclarado });
    if (error) throw new Error(`No se pudo subir el objeto: ${error.message}`);
    subidas.push(firma.datos.ruta);
    return firma.datos.ruta;
  }

  const existeEnBucket = async (ruta: string) => (await admin.storage.from('medios').download(ruta)).data !== null;

  describe('firmarSubidaMedio', () => {
    it('H2-E4: para un archivo válido devuelve ruta bajo articulos/AAAA/MM, token y URL firmada', async () => {
      const { firmarSubidaMedio } = await import('./medios');
      await comoEditor();

      const resultado = await firmarSubidaMedio({ nombre: 'Mi foto.PNG', bytes: 1024 });

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.datos.ruta).toMatch(/^articulos\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
      expect(resultado.datos.token).toEqual(expect.any(String));
      expect(resultado.datos.token.length).toBeGreaterThan(0);
      expect(resultado.datos.urlFirmada).toMatch(/^https?:\/\/.+token=/);
    });

    it('la ruta no empieza con "medios/" ni con "/" y cada llamada genera una ruta distinta', async () => {
      const { firmarSubidaMedio } = await import('./medios');
      await comoEditor();

      const a = await firmarSubidaMedio({ nombre: 'a.jpg', bytes: 10 });
      const b = await firmarSubidaMedio({ nombre: 'a.jpg', bytes: 10 });

      if (!a.ok || !b.ok) throw new Error('Se esperaban dos firmas válidas');
      expect(a.datos.ruta).not.toMatch(/^(medios\/|\/)/);
      expect(a.datos.ruta).not.toBe(b.datos.ruta);
    });

    it('el nombre del archivo no puede sacar la ruta de articulos/', async () => {
      const { firmarSubidaMedio } = await import('./medios');
      await comoEditor();

      const resultado = await firmarSubidaMedio({ nombre: '../../perfiles/otro.png', bytes: 10 });

      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.datos.ruta).toMatch(/^articulos\//);
      expect(resultado.datos.ruta).not.toContain('..');
    });

    it('H2-E4: rechaza más de 5 242 880 bytes con imagen_invalida y un mensaje que dice el límite', async () => {
      const { firmarSubidaMedio } = await import('./medios');
      await comoEditor();

      const resultado = await firmarSubidaMedio({ nombre: 'grande.jpg', bytes: LIMITE + 1 });

      expect(resultado).toMatchObject({ ok: false, codigo: 'imagen_invalida' });
      expect(resultado.ok === false && resultado.mensaje).toMatch(/5 MB/);
    });

    it('acepta exactamente 5 242 880 bytes (el límite es inclusivo)', async () => {
      const { firmarSubidaMedio } = await import('./medios');
      await comoEditor();

      const resultado = await firmarSubidaMedio({ nombre: 'justo.jpg', bytes: LIMITE });

      expect(resultado.ok).toBe(true);
    });

    it.each([0, -1, 1.5])('rechaza un tamaño que no es un entero positivo (%s)', async (bytes) => {
      const { firmarSubidaMedio } = await import('./medios');
      await comoEditor();

      const resultado = await firmarSubidaMedio({ nombre: 'raro.jpg', bytes });

      expect(resultado.ok).toBe(false);
    });

    it('un anónimo recibe no_autenticado', async () => {
      const { firmarSubidaMedio } = await import('./medios');

      const resultado = await firmarSubidaMedio({ nombre: 'a.png', bytes: 10 });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' });
    });
  });

  describe('registrarMedio', () => {
    it('H2-E4: sobre un PNG real devuelve { ruta, ancho, alto } con las dimensiones reales y conserva el objeto', async () => {
      const { registrarMedio } = await import('./medios');
      await comoEditor();
      const ruta = await subirComoElNavegador('foto.png', pngMinimo(3, 2), 'image/png');

      const resultado = await registrarMedio({ ruta });

      expect(resultado).toEqual({ ok: true, datos: { ruta, ancho: 3, alto: 2 } });
      expect(await existeEnBucket(ruta)).toBe(true);
    });

    it('H2-E4: sobre un JPEG real devuelve sus dimensiones', async () => {
      const { registrarMedio } = await import('./medios');
      await comoEditor();
      const ruta = await subirComoElNavegador('foto.jpg', jpegMinimo(40, 30), 'image/jpeg');

      expect(await registrarMedio({ ruta })).toEqual({ ok: true, datos: { ruta, ancho: 40, alto: 30 } });
    });

    it('RF-007: un archivo de texto renombrado a .jpg se borra del bucket y devuelve imagen_invalida', async () => {
      const { registrarMedio } = await import('./medios');
      await comoEditor();
      const ruta = await subirComoElNavegador('falsa.jpg', textoPlanoComoArchivo(), 'image/jpeg');
      expect(await existeEnBucket(ruta)).toBe(true);

      const resultado = await registrarMedio({ ruta });

      expect(resultado).toMatchObject({ ok: false, codigo: 'imagen_invalida' });
      expect(resultado.ok === false && resultado.mensaje).toMatch(MENSAJE_FORMATO);
      expect(await existeEnBucket(ruta)).toBe(false);
    });

    it('RF-007: un GIF (aunque declare image/png) se borra del bucket y devuelve imagen_invalida', async () => {
      const { registrarMedio } = await import('./medios');
      await comoEditor();
      const ruta = await subirComoElNavegador('animada.png', gifMinimo(), 'image/png');

      const resultado = await registrarMedio({ ruta });

      expect(resultado).toMatchObject({ ok: false, codigo: 'imagen_invalida' });
      expect(await existeEnBucket(ruta)).toBe(false);
    });

    it('RF-007: un SVG (aunque declare image/png) se borra del bucket y devuelve imagen_invalida', async () => {
      const { registrarMedio } = await import('./medios');
      await comoEditor();
      const ruta = await subirComoElNavegador('vector.png', svgMinimo(), 'image/png');

      const resultado = await registrarMedio({ ruta });

      expect(resultado).toMatchObject({ ok: false, codigo: 'imagen_invalida' });
      expect(await existeEnBucket(ruta)).toBe(false);
    });

    it('una ruta que no existe en el bucket devuelve no_encontrado', async () => {
      const { registrarMedio } = await import('./medios');
      await comoEditor();

      const resultado = await registrarMedio({ ruta: `articulos/2026/10/${crypto.randomUUID()}.png` });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_encontrado' });
    });

    it('un anónimo recibe no_autenticado y no toca el objeto', async () => {
      const { registrarMedio } = await import('./medios');
      await comoEditor();
      const ruta = await subirComoElNavegador('ajena.png', pngMinimo(), 'image/png');
      almacenCookies.clear();

      const resultado = await registrarMedio({ ruta });

      expect(resultado).toMatchObject({ ok: false, codigo: 'no_autenticado', motivo: 'sin_sesion' });
      expect(await existeEnBucket(ruta)).toBe(true);
    });
  });
});
