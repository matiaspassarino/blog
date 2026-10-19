// T047: operaciones del equipo sobre taxonomías y etiquetado (contracts/db.md, "Operaciones del equipo";
// H3-E3, H3-E4; RF-008, RF-012, RF-014, RF-016, D22, D23). Integración contra Supabase local con la
// sesión de un editor demo del seed (research D18). El admin demo borra los artículos al final.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ClienteBlog } from '../cliente';
import { rechazoDe } from '../pruebas/afirmaciones';
import { clienteAnon, sesionesDemo, sinSupabase } from '../pruebas/clientes';
import { registroDePrueba } from '../pruebas/datos';
import { resolverRedireccion } from './articulos-publicos';
import { actualizarTaxonomia, asignarEtiquetas, crearTaxonomia, eliminarTaxonomia } from './equipo-taxonomias';

const sufijo = crypto.randomUUID().slice(0, 8);

/** Cuerpo JSON de las llamadas a un RPC capturadas por el espía de fetch. */
function cuerposDeRpc(espia: { mock: { calls: unknown[][] } }, rpc: string): unknown[] {
  return espia.mock.calls
    .filter(([entrada]) => {
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
      return url.pathname.endsWith(`/rpc/${rpc}`);
    })
    .map(([, init]) => JSON.parse(String((init as RequestInit | undefined)?.body ?? 'null')));
}

describe.skipIf(sinSupabase)('operaciones del equipo sobre taxonomías (integración)', () => {
  let editor: ClienteBlog;
  let admin: ClienteBlog;
  let anon: ClienteBlog;
  let idEditor: string;
  const creados = registroDePrueba();

  beforeAll(async () => {
    ({ editor, admin, idEditor } = await sesionesDemo());
    anon = clienteAnon();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // El editor no puede borrar artículos: limpia el admin demo. Después, las taxonomías
  // que hayan quedado (la categoría tiene FK restrict).
  afterAll(() => creados.limpiar(admin));

  async function nuevaCategoria(nombre: string) {
    const creada = await crearTaxonomia(editor, 'categoria', { nombre: `${nombre} ${sufijo}` });
    creados.categorias.push(creada.id);
    return creada;
  }

  async function nuevaEtiqueta(nombre: string) {
    const creada = await crearTaxonomia(editor, 'etiqueta', { nombre: `${nombre} ${sufijo}` });
    creados.etiquetas.push(creada.id);
    return creada;
  }

  async function crearBorrador(titulo: string, categoriaId?: string) {
    const { data, error } = await editor
      .from('articulos')
      .insert({ titulo: `${titulo} ${sufijo}`, slug: '', autor_id: idEditor, categoria_id: categoriaId ?? null })
      .select('id, version')
      .single();
    if (error) throw new Error(`No se pudo crear el borrador de prueba: ${error.message}`);
    creados.articulos.push(data.id);
    return data;
  }

  async function etiquetasDe(articuloId: string) {
    const { data, error } = await editor
      .from('articulos_etiquetas')
      .select('etiqueta_id')
      .eq('articulo_id', articuloId);
    if (error) throw new Error(`No se pudieron leer las etiquetas: ${error.message}`);
    return data.map((fila) => fila.etiqueta_id).sort();
  }

  describe('crearTaxonomia', () => {
    it('RF-014: crea una categoría con el slug normalizado a partir del nombre', async () => {
      const creada = await nuevaCategoria('H3 Equipo Diseño Gráfico');

      expect(creada).toMatchObject({
        id: expect.any(String),
        nombre: `H3 Equipo Diseño Gráfico ${sufijo}`,
        slug: `h3-equipo-diseno-grafico-${sufijo}`,
      });
    });

    it('RF-014: crea una etiqueta con descripción', async () => {
      const creada = await crearTaxonomia(editor, 'etiqueta', {
        nombre: `H3 Equipo Etiqueta ${sufijo}`,
        descripcion: 'Descripción de la etiqueta.',
      });
      creados.etiquetas.push(creada.id);

      expect(creada).toMatchObject({
        slug: `h3-equipo-etiqueta-${sufijo}`,
        descripcion: 'Descripción de la etiqueta.',
      });
    });

    it('un visitante no puede crear taxonomías (sin_permiso)', async () => {
      const error = await rechazoDe(crearTaxonomia(anon, 'categoria', { nombre: `H3 Equipo Intrusa ${sufijo}` }));

      expect(error.codigo).toBe('sin_permiso');
    });
  });

  describe('actualizarTaxonomia', () => {
    it('RF-012: cambiar el slug de una etiqueta devuelve la fila nueva y el slug anterior redirige', async () => {
      const etiqueta = await nuevaEtiqueta('H3 Equipo Slug Viejo');
      const slugNuevo = `h3-equipo-slug-nuevo-${sufijo}`;

      const actualizada = await actualizarTaxonomia(editor, 'etiqueta', etiqueta.id, { slug: slugNuevo });

      expect(actualizada).toMatchObject({ id: etiqueta.id, slug: slugNuevo });
      await expect(resolverRedireccion(anon, 'etiqueta', etiqueta.slug)).resolves.toBe(slugNuevo);
    });

    it('cambiar el nombre de una categoría conserva su slug', async () => {
      const categoria = await nuevaCategoria('H3 Equipo Nombre Viejo');

      const actualizada = await actualizarTaxonomia(editor, 'categoria', categoria.id, {
        nombre: `H3 Equipo Nombre Nuevo ${sufijo}`,
        descripcion: 'Nueva descripción.',
      });

      expect(actualizada).toMatchObject({
        nombre: `H3 Equipo Nombre Nuevo ${sufijo}`,
        slug: categoria.slug,
        descripcion: 'Nueva descripción.',
      });
    });
  });

  describe('eliminarTaxonomia', () => {
    it('H3-E3: una categoría con artículos asignados lanza ErrorDominio(categoria_en_uso) con el conteo', async () => {
      const categoria = await nuevaCategoria('H3 Equipo En Uso');
      await crearBorrador('H3 equipo en uso uno', categoria.id);
      await crearBorrador('H3 equipo en uso dos', categoria.id);

      const error = await rechazoDe(eliminarTaxonomia(editor, 'categoria', categoria.id));

      expect(error.codigo).toBe('categoria_en_uso');
      expect(error.detalle).toBe('2');
      const { data } = await editor.from('categorias').select('id').eq('id', categoria.id);
      expect(data).toHaveLength(1);
    });

    it('RF-016: una categoría sin artículos se elimina', async () => {
      const categoria = await nuevaCategoria('H3 Equipo Libre');

      await expect(eliminarTaxonomia(editor, 'categoria', categoria.id)).resolves.toBeUndefined();

      const { data } = await editor.from('categorias').select('id').eq('id', categoria.id);
      expect(data).toEqual([]);
    });

    it('H3-E4: eliminar una etiqueta la quita de sus artículos y los conserva', async () => {
      const etiqueta = await nuevaEtiqueta('H3 Equipo Efímera');
      const otra = await nuevaEtiqueta('H3 Equipo Permanente');
      const articulo = await crearBorrador('H3 equipo con etiquetas');
      await asignarEtiquetas(editor, articulo.id, articulo.version, [etiqueta.id, otra.id]);

      await eliminarTaxonomia(editor, 'etiqueta', etiqueta.id);

      await expect(etiquetasDe(articulo.id)).resolves.toEqual([otra.id]);
      const { data } = await editor.from('articulos').select('id').eq('id', articulo.id);
      expect(data).toHaveLength(1);
    });

    it('una taxonomía inexistente lanza ErrorDominio(no_encontrado)', async () => {
      const error = await rechazoDe(eliminarTaxonomia(editor, 'etiqueta', crypto.randomUUID()));

      expect(error.codigo).toBe('no_encontrado');
    });
  });

  describe('asignarEtiquetas', () => {
    it('D22: reemplaza el conjunto y devuelve la versión nueva', async () => {
      const [a, b, c] = await Promise.all([
        nuevaEtiqueta('H3 Equipo Asignar A'),
        nuevaEtiqueta('H3 Equipo Asignar B'),
        nuevaEtiqueta('H3 Equipo Asignar C'),
      ]);
      const articulo = await crearBorrador('H3 equipo asignar');

      const primera = await asignarEtiquetas(editor, articulo.id, articulo.version, [a.id, b.id]);
      const segunda = await asignarEtiquetas(editor, articulo.id, primera.version, [b.id, c.id]);

      expect(primera).toEqual({ version: articulo.version + 1 });
      expect(segunda).toEqual({ version: articulo.version + 2 });
      await expect(etiquetasDe(articulo.id)).resolves.toEqual([b.id, c.id].sort());
      const { data } = await editor.from('articulos').select('version').eq('id', articulo.id).single();
      expect(data?.version).toBe(segunda.version);
    });

    it('D13: envía la versión al RPC asignar_etiquetas', async () => {
      const etiqueta = await nuevaEtiqueta('H3 Equipo Versión');
      const articulo = await crearBorrador('H3 equipo versión');
      const espiaFetch = vi.spyOn(globalThis, 'fetch');

      await asignarEtiquetas(editor, articulo.id, articulo.version, [etiqueta.id]);

      expect(cuerposDeRpc(espiaFetch, 'asignar_etiquetas')).toEqual([
        { articulo_id: articulo.id, etiqueta_ids: [etiqueta.id], version: articulo.version },
      ]);
    });

    it('RF-008: con una versión vieja lanza ErrorDominio(conflicto_version) y no cambia nada', async () => {
      const [a, b] = await Promise.all([
        nuevaEtiqueta('H3 Equipo Conflicto A'),
        nuevaEtiqueta('H3 Equipo Conflicto B'),
      ]);
      const articulo = await crearBorrador('H3 equipo conflicto');
      await asignarEtiquetas(editor, articulo.id, articulo.version, [a.id]);

      const error = await rechazoDe(asignarEtiquetas(editor, articulo.id, articulo.version, [b.id]));

      expect(error.codigo).toBe('conflicto_version');
      await expect(etiquetasDe(articulo.id)).resolves.toEqual([a.id]);
    });

    it('un visitante no puede asignar etiquetas (sin_permiso)', async () => {
      const articulo = await crearBorrador('H3 equipo visitante');

      const error = await rechazoDe(asignarEtiquetas(anon, articulo.id, articulo.version, []));

      expect(error.codigo).toBe('sin_permiso');
    });
  });
});
