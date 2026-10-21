// T026: operaciones del equipo sobre artículos (contracts/db.md, "Operaciones del equipo"; H1-E2; RF-008).
// Integración contra Supabase local con la sesión de un editor demo del seed (research D18).
import type { ErrorBloque } from '@blog/bloques';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ClienteBlog } from '../cliente';
import type { ErrorDominio } from '../errores';
import { rechazoDe } from '../pruebas/afirmaciones';
import { clienteAnon, sesionesDemo, sinSupabase } from '../pruebas/clientes';
import { registroDePrueba } from '../pruebas/datos';
import {
  actualizarArticulo,
  cambiarEstado,
  crearArticulo,
  eliminarArticulo,
  previsualizarSlug,
} from './equipo-articulos';

type NuevoArticulo = Parameters<typeof crearArticulo>[1];
type CambiosArticulo = Parameters<typeof actualizarArticulo>[3];

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
  const creados = registroDePrueba();

  beforeAll(async () => {
    ({ editor, admin, idEditor } = await sesionesDemo());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // El editor no puede borrar: limpia el admin demo.
  afterAll(async () => {
    await creados.limpiar(admin);
  });

  // slug vacío: lo genera a10_asignar_slug (la columna tiene default '').
  async function crearBorrador(titulo: string) {
    const { data, error } = await editor
      .from('articulos')
      .insert({ titulo, slug: '', autor_id: idEditor })
      .select('id, version')
      .single();
    if (error) throw new Error(`No se pudo crear el borrador de prueba: ${error.message}`);
    creados.articulos.push(data.id);
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

  describe('crearArticulo (camino feliz y validación de imagen)', () => {
    it('crea un borrador del usuario actual y persiste el contenido parseado (con valores por defecto)', async () => {
      const imagen = (n: number) => ({ ruta: `medios/g${n}.jpg`, ancho: 800, alto: 600, alt: `Foto ${n}` });
      const articulo = await crearArticulo(editor, {
        titulo: 'H1 integración: camino feliz',
        contenido: [{ id: crypto.randomUUID(), tipo: 'galeria', imagenes: [imagen(1), imagen(2)] }],
      });
      creados.articulos.push(articulo.id);

      expect(articulo).toMatchObject({ estado: 'borrador', autor_id: idEditor, version: 1 });
      expect(articulo.contenido).toEqual([expect.objectContaining({ tipo: 'galeria', columnas: 3 })]);
      // A7-M3: el tsvector interno no sale de packages/db.
      expect(articulo).not.toHaveProperty('busqueda');
    });

    it('rechaza una imagen destacada sin alt con contenido_invalido, sin llamar a la base', async () => {
      const espiaFetch = vi.spyOn(globalThis, 'fetch');
      const error = await rechazoDe(
        crearArticulo(editor, {
          titulo: 'H1 integración: imagen destacada sin alt',
          imagen_destacada: { ruta: 'medios/portada.jpg', ancho: 1600, alto: 900 },
        }),
      );

      expect(error.codigo).toBe('contenido_invalido');
      expect(error.errores).toEqual([expect.objectContaining({ indice: -1, campo: 'imagen_destacada.alt' })]);
      expect(espiaFetch).not.toHaveBeenCalled();
    });
  });

  describe('eliminarArticulo', () => {
    it('un editor no puede eliminar (no_encontrado) y un admin sí', async () => {
      const articulo = await crearBorrador('H1 integración: eliminar');

      expect((await rechazoDe(eliminarArticulo(editor, articulo.id))).codigo).toBe('no_encontrado');
      await expect(eliminarArticulo(admin, articulo.id)).resolves.toBeUndefined();
    });
  });

  // T055: cambiarEstado con programación (H4-E1, H4-E3, H4-E4, RF-011).
  describe('cambiarEstado (programación)', () => {
    const UN_DIA_MS = 24 * 60 * 60 * 1000;

    /** Borrador listo para programar: con categoría (del seed) y un bloque. */
    async function crearProgramable(titulo: string) {
      const { data: categoria, error: errorCategoria } = await editor.from('categorias').select('id').limit(1).single();
      if (errorCategoria) throw new Error(`No hay categorías en el seed: ${errorCategoria.message}`);
      const articulo = await crearArticulo(editor, {
        titulo,
        categoria_id: categoria.id,
        contenido: [{ id: crypto.randomUUID(), tipo: 'parrafo', texto: 'Cuerpo programable.' }],
      });
      creados.articulos.push(articulo.id);
      return articulo;
    }

    it('H4-E1: programar para mañana deja el artículo programado, envía la versión y el visitante no lo ve', async () => {
      const articulo = await crearProgramable('H4 integración: programar');
      const programadoPara = new Date(Date.now() + UN_DIA_MS);
      const espiaFetch = vi.spyOn(globalThis, 'fetch');

      const programado = await cambiarEstado(editor, articulo.id, articulo.version, 'programado', { programadoPara });

      const escrituras = peticionesDe(espiaFetch).filter(({ metodo }) => metodo === 'PATCH');
      expect(escrituras).toHaveLength(1);
      expect(escrituras[0]?.url.searchParams.get('version')).toBe(`eq.${articulo.version}`);
      expect(programado).toMatchObject({
        id: articulo.id,
        estado: 'programado',
        publicado_en: null,
        version: articulo.version + 1,
      });
      expect(new Date(programado.programado_para ?? '').getTime()).toBe(programadoPara.getTime());

      vi.restoreAllMocks();
      const { data: visto } = await clienteAnon().from('articulos').select('id').eq('id', articulo.id);
      expect(visto).toEqual([]);
    });

    it('H4-E3: programar para una fecha pasada se traduce a ErrorDominio(fecha_no_futura) y no cambia nada', async () => {
      const articulo = await crearProgramable('H4 integración: fecha pasada');

      const error = await rechazoDe(
        cambiarEstado(editor, articulo.id, articulo.version, 'programado', {
          programadoPara: new Date(Date.now() - UN_DIA_MS),
        }),
      );

      expect(error.codigo).toBe('fecha_no_futura');
      const { data } = await editor
        .from('articulos')
        .select('estado, programado_para, version')
        .eq('id', articulo.id)
        .single();
      expect(data).toEqual({ estado: 'borrador', programado_para: null, version: articulo.version });
    });

    it('H4-E4: cancelar la programación (programado → borrador) limpia programado_para', async () => {
      const articulo = await crearProgramable('H4 integración: cancelar');
      const programado = await cambiarEstado(editor, articulo.id, articulo.version, 'programado', {
        programadoPara: new Date(Date.now() + UN_DIA_MS),
      });

      const cancelado = await cambiarEstado(editor, articulo.id, programado.version, 'borrador');

      expect(cancelado).toMatchObject({ estado: 'borrador', programado_para: null, version: programado.version + 1 });
    });

    // C7-M4: el rechazo con 0 filas de cambiarEstado (compartido con actualizarArticulo).
    it('RF-008: cambiar el estado con una versión desactualizada se traduce a ErrorDominio(conflicto_version)', async () => {
      const articulo = await crearProgramable('H4 integración: versión vieja');
      await cambiarEstado(editor, articulo.id, articulo.version, 'programado', {
        programadoPara: new Date(Date.now() + UN_DIA_MS),
      });

      const error = await rechazoDe(cambiarEstado(editor, articulo.id, articulo.version, 'borrador'));

      expect(error.codigo).toBe('conflicto_version');
    });

    it('cambiar el estado de un id inexistente se traduce a ErrorDominio(no_encontrado)', async () => {
      const error = await rechazoDe(cambiarEstado(editor, crypto.randomUUID(), 1, 'publicado'));

      expect(error.codigo).toBe('no_encontrado');
    });
  });

  describe('previsualizarSlug', () => {
    it('un visitante no puede previsualizar (sin_permiso)', async () => {
      const error = await rechazoDe(previsualizarSlug(clienteAnon(), 'Algo', 'articulo'));
      expect(error.codigo).toBe('sin_permiso');
    });

    it("RF-005: previsualizarSlug('Año de Diseño', 'articulo') devuelve ano-de-diseno", async () => {
      await expect(previsualizarSlug(editor, 'Año de Diseño', 'articulo')).resolves.toBe('ano-de-diseno');
    });
  });
});
