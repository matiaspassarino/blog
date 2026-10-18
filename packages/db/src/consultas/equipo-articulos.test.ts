// T026: operaciones del equipo sobre artículos (contracts/db.md, "Operaciones del equipo"; H1-E2; RF-008).
// Integración contra Supabase local con la sesión de un editor demo del seed (research D18).
import type { ErrorBloque } from '@blog/bloques';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ClienteBlog } from '../cliente';
import { ErrorDominio } from '../errores';
import { clienteComo, sinSupabase } from '../pruebas/clientes';
import { actualizarArticulo, crearArticulo, previsualizarSlug } from './equipo-articulos';

type NuevoArticulo = Parameters<typeof crearArticulo>[1];
type CambiosArticulo = Parameters<typeof actualizarArticulo>[3];

/** Ejecuta la promesa y devuelve el error con el que se rechaza (o falla si se resuelve). */
async function rechazoDe(promesa: Promise<unknown>): Promise<ErrorDominio> {
  const error = await promesa.then(
    () => {
      throw new Error('se esperaba que la operación se rechazara');
    },
    (motivo: unknown) => motivo,
  );
  expect(error).toBeInstanceOf(ErrorDominio);
  return error as ErrorDominio;
}

/**
 * Los ErrorBloque[] de un error contenido_invalido. El contrato dice que se devuelven
 * "con ErrorBloque[]" pero no fija la propiedad: se aceptan `errores` o `cause`.
 */
function erroresDeBloque(error: ErrorDominio): ErrorBloque[] | undefined {
  const candidato = (error as ErrorDominio & { errores?: unknown }).errores ?? error.cause;
  return Array.isArray(candidato) ? (candidato as ErrorBloque[]) : undefined;
}

type Peticion = { url: URL; metodo: string };

function peticionesDe(espia: { mock: { calls: unknown[][] } }): Peticion[] {
  return espia.mock.calls.map(([entrada, init]) => {
    const esRequest = entrada instanceof Request;
    const url = new URL(esRequest ? entrada.url : String(entrada));
    const metodo = ((init as RequestInit | undefined)?.method ?? (esRequest ? entrada.method : 'GET')).toUpperCase();
    return { url, metodo };
  });
}

describe.skipIf(sinSupabase)('operaciones del equipo sobre artículos (integración)', () => {
  let editor: ClienteBlog;
  let admin: ClienteBlog;
  let idEditor: string;
  const creados: string[] = [];

  beforeAll(async () => {
    editor = await clienteComo('editor@demo.local', 'demo-editor-2026');
    admin = await clienteComo('admin@demo.local', 'demo-admin-2026');
    const { data, error } = await editor.auth.getUser();
    if (error || !data.user) throw new Error('No se pudo obtener el usuario editor');
    idEditor = data.user.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // El editor no puede borrar: limpia el admin demo.
  afterAll(async () => {
    if (creados.length > 0) await admin.from('articulos').delete().in('id', creados);
  });

  // slug vacío: lo genera a10_asignar_slug (la columna es not null sin default).
  async function crearBorrador(titulo: string) {
    const { data, error } = await editor
      .from('articulos')
      .insert({ titulo, slug: '', autor_id: idEditor })
      .select('id, version')
      .single();
    if (error) throw new Error(`No se pudo crear el borrador de prueba: ${error.message}`);
    creados.push(data.id);
    return data;
  }

  describe('crearArticulo', () => {
    it('H1-E2: con contenido inválido rechaza con contenido_invalido y ErrorBloque[], sin llamar a la base', async () => {
      const espiaFrom = vi.spyOn(editor, 'from');
      const espiaRpc = vi.spyOn(editor, 'rpc');
      const espiaFetch = vi.spyOn(globalThis, 'fetch');
      const datos = {
        titulo: 'H1 integración: contenido inválido',
        contenido: [
          {
            id: crypto.randomUUID(),
            tipo: 'imagen',
            imagen: { ruta: 'medios/sin-alt.jpg', ancho: 800, alto: 600 },
          },
          { id: crypto.randomUUID(), tipo: 'tabla' },
        ],
      } as unknown as NuevoArticulo;

      const error = await rechazoDe(crearArticulo(editor, datos));

      expect(error.codigo).toBe('contenido_invalido');
      expect(erroresDeBloque(error)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ indice: 0, campo: 'imagen.alt' }),
          expect.objectContaining({ indice: 1, campo: 'tipo' }),
        ]),
      );
      expect(espiaFrom).not.toHaveBeenCalled();
      expect(espiaRpc).not.toHaveBeenCalled();
      expect(espiaFetch).not.toHaveBeenCalled();
    });
  });

  describe('actualizarArticulo', () => {
    it('RF-008: envía siempre la versión en el filtro del update y devuelve la versión incrementada', async () => {
      const articulo = await crearBorrador('H1 integración: versión en el filtro');
      const espiaFetch = vi.spyOn(globalThis, 'fetch');

      const actualizado = await actualizarArticulo(editor, articulo.id, articulo.version, {
        extracto: 'Extracto actualizado',
      } as CambiosArticulo);

      const escrituras = peticionesDe(espiaFetch).filter(
        ({ url, metodo }) => metodo === 'PATCH' && url.pathname.endsWith('/rest/v1/articulos'),
      );
      expect(escrituras).toHaveLength(1);
      expect(escrituras[0]?.url.searchParams.get('id')).toBe(`eq.${articulo.id}`);
      expect(escrituras[0]?.url.searchParams.get('version')).toBe(`eq.${articulo.version}`);
      expect(actualizado).toMatchObject({
        id: articulo.id,
        extracto: 'Extracto actualizado',
        version: articulo.version + 1,
      });
    });

    it('RF-008: un update sobre una versión desactualizada se traduce a ErrorDominio(conflicto_version) y no pisa cambios', async () => {
      const articulo = await crearBorrador('H1 integración: conflicto de versión');
      await actualizarArticulo(editor, articulo.id, articulo.version, {
        extracto: 'Primera edición',
      } as CambiosArticulo);
      const espiaFetch = vi.spyOn(globalThis, 'fetch');

      const error = await rechazoDe(
        actualizarArticulo(editor, articulo.id, articulo.version, {
          extracto: 'Edición sobre una versión vieja',
        } as CambiosArticulo),
      );

      expect(error.codigo).toBe('conflicto_version');
      const escrituras = peticionesDe(espiaFetch).filter(({ metodo }) => metodo === 'PATCH');
      expect(escrituras.every(({ url }) => url.searchParams.get('version') === `eq.${articulo.version}`)).toBe(true);
      vi.restoreAllMocks();
      const { data } = await editor.from('articulos').select('extracto, version').eq('id', articulo.id).single();
      expect(data).toEqual({ extracto: 'Primera edición', version: articulo.version + 1 });
    });

    it('un id inexistente se traduce a ErrorDominio(no_encontrado)', async () => {
      const error = await rechazoDe(
        actualizarArticulo(editor, crypto.randomUUID(), 1, { extracto: 'Nada' } as CambiosArticulo),
      );
      expect(error.codigo).toBe('no_encontrado');
    });
  });

  describe('previsualizarSlug', () => {
    it("RF-005: previsualizarSlug('Año de Diseño', 'articulo') devuelve ano-de-diseno", async () => {
      await expect(previsualizarSlug(editor, 'Año de Diseño', 'articulo')).resolves.toBe('ano-de-diseno');
    });
  });
});
