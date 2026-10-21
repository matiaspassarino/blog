// T013 (spec 003): operaciones de Storage del bucket `medios` (§III.2, D9, D11, RF-007).
// Integración contra Supabase local con las sesiones demo del seed (editor y admin) y el cliente
// anónimo. Los objetos de prueba viven bajo `pruebas-t013/<sufijo>/` y el admin los borra al final.
// Firmas supuestas (T026), exportadas desde './medios':
//   crearSubidaFirmada(c, ruta): Promise<{ ruta: string; token: string; urlFirmada: string }>
//     (rechaza con ErrorDominio 'sin_permiso' si la base/Storage niega la subida)
//   descargarMedio(c, ruta): Promise<Uint8Array> (rechaza con 'no_encontrado' si no existe)
//   borrarMedios(c, rutas): Promise<string[]> (devuelve las rutas NO borradas; nunca lanza)
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ClienteBlog } from './cliente';
import { rechazoDe } from './pruebas/afirmaciones';
import { clienteAnon, sesionesDemo, sinSupabase } from './pruebas/clientes';
import { borrarMedios, crearSubidaFirmada, descargarMedio } from './medios';

const sufijo = crypto.randomUUID().slice(0, 8);
const carpeta = `pruebas-t013/${sufijo}`;
const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5]);

describe.skipIf(sinSupabase)('operaciones de Storage del bucket medios (integración)', () => {
  let editor: ClienteBlog;
  let admin: ClienteBlog;
  let anon: ClienteBlog;
  const subidas: string[] = [];

  beforeAll(async () => {
    ({ editor, admin } = await sesionesDemo());
    anon = clienteAnon();
  });

  afterAll(async () => {
    if (admin && subidas.length > 0) await admin.storage.from('medios').remove(subidas);
  });

  /** Sube un objeto con la sesión del editor (como lo hace el navegador con la URL firmada). */
  async function subir(nombre: string) {
    const ruta = `${carpeta}/${nombre}`;
    const { error } = await editor.storage.from('medios').upload(ruta, BYTES, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`No se pudo subir el objeto de prueba: ${error.message}`);
    subidas.push(ruta);
    return ruta;
  }

  async function existe(ruta: string) {
    const { data } = await admin.storage.from('medios').download(ruta);
    return data !== null;
  }

  describe('crearSubidaFirmada', () => {
    it('D9: devuelve ruta, token y URL firmada para un miembro del equipo', async () => {
      const ruta = `${carpeta}/firmada.png`;

      const subida = await crearSubidaFirmada(editor, ruta);

      expect(subida.ruta).toBe(ruta);
      expect(subida.token).toEqual(expect.any(String));
      expect(subida.token.length).toBeGreaterThan(0);
      expect(subida.urlFirmada).toMatch(/^https?:\/\//);
      expect(subida.urlFirmada).toContain('token=');
    });

    it('D9: la URL firmada sirve para subir el archivo con el token', async () => {
      const ruta = `${carpeta}/con-token.png`;
      const subida = await crearSubidaFirmada(editor, ruta);
      subidas.push(ruta);

      const { error } = await editor.storage
        .from('medios')
        .uploadToSignedUrl(subida.ruta, subida.token, BYTES, { contentType: 'image/png' });

      expect(error).toBeNull();
      expect(await existe(ruta)).toBe(true);
    });

    it('D9: falla con sin_permiso para un anónimo', async () => {
      const error = await rechazoDe(crearSubidaFirmada(anon, `${carpeta}/anonimo.png`));

      expect(error.codigo).toBe('sin_permiso');
    });
  });

  describe('descargarMedio', () => {
    it('D10: devuelve los bytes de un objeto subido', async () => {
      const ruta = await subir('descarga.png');

      const bytes = await descargarMedio(editor, ruta);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(Array.from(bytes)).toEqual(Array.from(BYTES));
    });

    it('D10: rechaza con no_encontrado si el objeto no existe', async () => {
      const error = await rechazoDe(descargarMedio(editor, `${carpeta}/no-existe.png`));

      expect(error.codigo).toBe('no_encontrado');
    });
  });

  describe('borrarMedios', () => {
    it('D11: borra las rutas pedidas y devuelve una lista vacía', async () => {
      const a = await subir('borrar-a.png');
      const b = await subir('borrar-b.png');

      const noBorradas = await borrarMedios(editor, [a, b]);

      expect(noBorradas).toEqual([]);
      expect(await existe(a)).toBe(false);
      expect(await existe(b)).toBe(false);
    });

    it('D11: con una lista vacía no hace nada y devuelve una lista vacía', async () => {
      expect(await borrarMedios(editor, [])).toEqual([]);
    });

    it('D11: devuelve las rutas que no pudo borrar, sin lanzar (un anónimo no puede borrar)', async () => {
      const ruta = await subir('intocable.png');

      const noBorradas = await borrarMedios(anon, [ruta]);

      expect(noBorradas).toEqual([ruta]);
      expect(await existe(ruta)).toBe(true);
    });
  });
});
