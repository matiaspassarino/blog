// T017 (spec 003): lecturas del panel (RF-016, RF-017, RF-019, RF-020, D11). Integración contra
// Supabase local con las sesiones demo del seed (editor y admin) y el cliente anónimo. El admin
// demo borra los datos creados al final.
// Firmas supuestas (T029), exportadas desde './panel':
//   listarArticulosPanel(c, { estado?, categoria?, autor?, q?, pagina? }): Promise<Pagina<FilaArticuloPanel>>
//     (mismos nombres de filtro que el contrato de acciones.md; porPagina = 20; items sin `total`)
//   listarEquipo(c): Promise<FilaEquipo[]>      (ErrorDominio 'sin_permiso' para un no admin)
//   rutasEnUso(c, rutas): Promise<string[]>
//   listarTaxonomiasConConteo(c, tipo): Promise<(Taxonomia & { conteo: number })[]>
//   obtenerPerfilPropio(c): Promise<Perfil | null>
//   listarAutores(c): Promise<{ id: string; nombre: string }[]>
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ClienteBlog } from '../cliente';
import { rechazoDe } from '../pruebas/afirmaciones';
import { clienteAnon, sesionesDemo, sinSupabase } from '../pruebas/clientes';
import { crearArticuloDePrueba, registroDePrueba } from '../pruebas/datos';
import { crearTaxonomia } from './equipo-taxonomias';
import {
  listarArticulosPanel,
  listarAutores,
  listarEquipo,
  listarTaxonomiasConConteo,
  obtenerPerfilPropio,
  rutasEnUso,
} from './panel';

const sufijo = crypto.randomUUID().slice(0, 8);
const carpeta = `pruebas-t017/${sufijo}`;
const contenido = [{ id: crypto.randomUUID(), tipo: 'parrafo', texto: 'Cuerpo del artículo de prueba.' }];

describe.skipIf(sinSupabase)('lecturas del panel (integración)', () => {
  let editor: ClienteBlog;
  let admin: ClienteBlog;
  let anon: ClienteBlog;
  let idEditor: string;
  let idAdmin: string;
  let categoriaUsada: string;
  let categoriaVacia: string;
  let etiquetaUsada: string;
  let etiquetaVacia: string;
  let idPublicado: string;
  let idBorradorConCategoria: string;
  let idBorradorSinCategoria: string;
  const creados = registroDePrueba();

  beforeAll(async () => {
    ({ editor, admin, idEditor, idAdmin } = await sesionesDemo());
    anon = clienteAnon();

    categoriaUsada = (await crearTaxonomia(editor, 'categoria', { nombre: `Panel Usada ${sufijo}` })).id;
    categoriaVacia = (await crearTaxonomia(editor, 'categoria', { nombre: `Panel Vacia ${sufijo}` })).id;
    etiquetaUsada = (await crearTaxonomia(editor, 'etiqueta', { nombre: `Panel Etiqueta Usada ${sufijo}` })).id;
    etiquetaVacia = (await crearTaxonomia(editor, 'etiqueta', { nombre: `Panel Etiqueta Vacia ${sufijo}` })).id;
    creados.categorias.push(categoriaUsada, categoriaVacia);
    creados.etiquetas.push(etiquetaUsada, etiquetaVacia);

    // A: publicado, del admin, con categoría y etiqueta. Se crea primero (el más viejo).
    ({ id: idPublicado } = await crearArticuloDePrueba(admin, creados, {
      titulo: `Panel ${sufijo} A publicado`,
      slug: `panel-${sufijo}-a`,
      contenido,
      categoriaId: categoriaUsada,
      etiquetas: [etiquetaUsada],
    }));

    // B: borrador del editor con categoría, con una imagen destacada. C: borrador sin categoría.
    const { data: b, error: errorB } = await editor
      .from('articulos')
      .insert({
        titulo: `Panel ${sufijo} B borrador`,
        slug: `panel-${sufijo}-b`,
        autor_id: idEditor,
        categoria_id: categoriaUsada,
        imagen_destacada: { ruta: `${carpeta}/portada.webp`, ancho: 1200, alto: 630, alt: 'Portada de prueba' },
      })
      .select('id')
      .single();
    if (errorB) throw new Error(`No se pudo crear el borrador B: ${errorB.message}`);
    idBorradorConCategoria = b.id;
    creados.articulos.push(b.id);

    const { data: c, error: errorC } = await editor
      .from('articulos')
      .insert({ titulo: `Panel ${sufijo} C sin categoria`, slug: `panel-${sufijo}-c`, autor_id: idEditor })
      .select('id')
      .single();
    if (errorC) throw new Error(`No se pudo crear el borrador C: ${errorC.message}`);
    idBorradorSinCategoria = c.id;
    creados.articulos.push(c.id);
  });

  afterAll(() => creados.limpiar(admin));

  describe('listarArticulosPanel', () => {
    it('H4-E1: devuelve una Pagina con los artículos de todos los estados y el total', async () => {
      const pagina = await listarArticulosPanel(editor, { q: sufijo });

      expect(pagina).toMatchObject({ total: 3, pagina: 1, porPagina: 20, totalPaginas: 1 });
      expect(pagina.items).toHaveLength(3);
    });

    it('H4-E1: cada fila trae título, estado, categoría, autor y fechas', async () => {
      const pagina = await listarArticulosPanel(editor, { q: `${sufijo} B` });

      expect(pagina.items[0]).toMatchObject({
        id: idBorradorConCategoria,
        titulo: `Panel ${sufijo} B borrador`,
        slug: `panel-${sufijo}-b`,
        estado: 'borrador',
        categoria_id: categoriaUsada,
        categoria_nombre: `Panel Usada ${sufijo}`,
        autor_id: idEditor,
        programado_para: null,
        publicado_en: null,
      });
      expect(pagina.items[0]?.autor_nombre).toEqual(expect.any(String));
      expect(pagina.items[0]?.actualizado_en).toEqual(expect.any(String));
    });

    it('H4-E1: ordena por actualizado_en descendente (lo último editado, primero)', async () => {
      const pagina = await listarArticulosPanel(editor, { q: sufijo });

      expect(pagina.items.map((fila) => fila.id)).toEqual([idBorradorSinCategoria, idBorradorConCategoria, idPublicado]);
    });

    it('H4-E2: filtra por estado', async () => {
      const pagina = await listarArticulosPanel(editor, { q: sufijo, estado: 'publicado' });

      expect(pagina.items.map((fila) => fila.id)).toEqual([idPublicado]);
      expect(pagina.total).toBe(1);
    });

    it('H4-E2: filtra por categoría', async () => {
      const pagina = await listarArticulosPanel(editor, { q: sufijo, categoria: categoriaUsada });

      expect(pagina.items.map((fila) => fila.id).sort()).toEqual([idPublicado, idBorradorConCategoria].sort());
    });

    it('H4-E2: filtra por autor', async () => {
      const pagina = await listarArticulosPanel(editor, { q: sufijo, autor: idEditor });

      expect(pagina.items.map((fila) => fila.id).sort()).toEqual([idBorradorConCategoria, idBorradorSinCategoria].sort());
    });

    it('H4-E2: combina estado, categoría y autor', async () => {
      const pagina = await listarArticulosPanel(editor, {
        q: sufijo,
        estado: 'borrador',
        categoria: categoriaUsada,
        autor: idEditor,
      });

      expect(pagina.items.map((fila) => fila.id)).toEqual([idBorradorConCategoria]);
    });

    it('H4-E2: una combinación sin coincidencias devuelve una página vacía', async () => {
      const pagina = await listarArticulosPanel(editor, { q: sufijo, estado: 'archivado', autor: idAdmin });

      expect(pagina.items).toEqual([]);
      expect(pagina.total).toBe(0);
    });

    it('H4-E3: la búsqueda por texto ignora mayúsculas y tildes', async () => {
      const pagina = await listarArticulosPanel(editor, { q: `${sufijo.toUpperCase()} c SIN CATEGORÍA` });

      expect(pagina.items.map((fila) => fila.id)).toEqual([idBorradorSinCategoria]);
    });

    it('H4-E3: un texto con "%" no actúa como comodín', async () => {
      const pagina = await listarArticulosPanel(editor, { q: `${sufijo}%` });

      expect(pagina.items).toEqual([]);
    });

    it('H4-E4: una página mayor que 1 sin filas devuelve una Pagina vacía, sin lanzar error', async () => {
      const pagina = await listarArticulosPanel(editor, { q: sufijo, pagina: 5 });

      expect(pagina.items).toEqual([]);
      expect(pagina.pagina).toBe(5);
    });

    it('RF-016: un anónimo no puede listar artículos del panel', async () => {
      const error = await rechazoDe(listarArticulosPanel(anon, { q: sufijo }));

      expect(error.codigo).toBe('sin_permiso');
    });
  });

  describe('listarEquipo', () => {
    it('H6-E1: el admin recibe el equipo con correo, rol, activo y acceso', async () => {
      const equipo = await listarEquipo(admin);

      expect(equipo).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: idAdmin, correo: 'admin@demo.local', rol: 'admin', activo: true, acceso: 'activo' }),
          expect.objectContaining({ id: idEditor, correo: 'editor@demo.local', rol: 'editor', activo: true, acceso: 'activo' }),
        ]),
      );
      expect(equipo[0]).toEqual(
        expect.objectContaining({ nombre: expect.any(String), creado_en: expect.any(String) }),
      );
    });

    it('H6-E6: un editor recibe sin_permiso', async () => {
      const error = await rechazoDe(listarEquipo(editor));

      expect(error.codigo).toBe('sin_permiso');
    });

    it('H6-E6: un anónimo recibe sin_permiso', async () => {
      const error = await rechazoDe(listarEquipo(anon));

      expect(error.codigo).toBe('sin_permiso');
    });
  });

  describe('rutasEnUso', () => {
    it('D11: devuelve solo las rutas que algún artículo usa', async () => {
      const usada = `${carpeta}/portada.webp`;
      const libre = `${carpeta}/sin-uso.webp`;

      const enUso = await rutasEnUso(editor, [usada, libre]);

      expect(enUso).toEqual([usada]);
    });

    it('D11: una lista vacía devuelve una lista vacía', async () => {
      expect(await rutasEnUso(editor, [])).toEqual([]);
    });

    it('D11: un anónimo recibe sin_permiso', async () => {
      const error = await rechazoDe(rutasEnUso(anon, [`${carpeta}/portada.webp`]));

      expect(error.codigo).toBe('sin_permiso');
    });
  });

  describe('listarTaxonomiasConConteo', () => {
    it('H5-E3: cuenta los artículos de cada categoría', async () => {
      const categorias = await listarTaxonomiasConConteo(editor, 'categoria');

      const usada = categorias.find((c) => c.id === categoriaUsada);
      const vacia = categorias.find((c) => c.id === categoriaVacia);
      expect(usada).toMatchObject({ nombre: `Panel Usada ${sufijo}`, conteo: 2 });
      expect(vacia).toMatchObject({ conteo: 0 });
    });

    it('H5-E4: cuenta los artículos de cada etiqueta', async () => {
      const etiquetas = await listarTaxonomiasConConteo(editor, 'etiqueta');

      expect(etiquetas.find((e) => e.id === etiquetaUsada)).toMatchObject({ conteo: 1 });
      expect(etiquetas.find((e) => e.id === etiquetaVacia)).toMatchObject({ conteo: 0 });
    });
  });

  describe('obtenerPerfilPropio', () => {
    it('H6-E7: devuelve el perfil de la sesión', async () => {
      const perfil = await obtenerPerfilPropio(editor);

      expect(perfil).toMatchObject({ id: idEditor, rol: 'editor', activo: true });
      expect(perfil?.nombre).toEqual(expect.any(String));
    });

    it('H6-E7: devuelve el perfil del admin cuando es el admin quien pregunta', async () => {
      expect(await obtenerPerfilPropio(admin)).toMatchObject({ id: idAdmin, rol: 'admin' });
    });

    it('H1-E1: sin sesión devuelve null', async () => {
      expect(await obtenerPerfilPropio(anon)).toBeNull();
    });
  });

  describe('listarAutores', () => {
    it('H4-E2: un editor puede leer los autores como { id, nombre }', async () => {
      const autores = await listarAutores(editor);

      expect(autores).toEqual(
        expect.arrayContaining([
          { id: idEditor, nombre: expect.any(String) },
          { id: idAdmin, nombre: expect.any(String) },
        ]),
      );
      for (const autor of autores) expect(Object.keys(autor).sort()).toEqual(['id', 'nombre']);
    });

    it('H4-E2: un anónimo no recibe ningún autor', async () => {
      expect(await listarAutores(anon)).toEqual([]);
    });
  });
});
