// T046: listados públicos (contracts/db.md, "Consultas públicas"; H3-E1, H3-E2, H3-E5; RF-017, RSEO-004, D16).
// Spec 002, T047: listarRelacionados (RF-005, research D18).
// Spec 002, T060: listarPorAutor (H2-E4, RF-008, RF-011).
// Integración contra Supabase local como visitante (anon). Los datos los crea y los borra el admin demo
// del seed (research D18). Otras suites publican en paralelo: los listados globales se verifican por
// sus invariantes y por la presencia de los artículos propios, nunca por totales exactos.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ClienteBlog } from '../cliente';
import type { Pagina } from '../paginacion';
import type { Taxonomia } from '../tipos-dominio';
import { clienteAnon, clienteComo, crearMiembroDePrueba, sesionAdminDemo, sinSupabase } from '../pruebas/clientes';
import { crearArticuloDePrueba, registroDePrueba } from '../pruebas/datos';
import {
  listarArticulosPublicados,
  listarParaSitemap,
  listarPorCategoria,
  listarPorAutor,
  listarPorEtiqueta,
  listarRelacionados,
} from './listados';

const sufijo = crypto.randomUUID().slice(0, 8);
const contenido = [{ id: crypto.randomUUID(), tipo: 'parrafo', texto: 'Cuerpo del artículo listado.' }];

type TaxonomiaDePrueba = Pick<Taxonomia, 'id' | 'nombre' | 'slug' | 'descripcion'>;
type Creado = Awaited<ReturnType<typeof crearArticuloDePrueba>>;

/** Verifica que los items vengan del más reciente al más antiguo (RF-017). */
function esperarOrdenDescendente(items: { publicado_en: string }[]) {
  const fechas = items.map((item) => new Date(item.publicado_en).getTime());
  expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
}

/** Verifica la aritmética de `Pagina<T>`. */
function esperarPaginaCoherente<T>(pagina: Pagina<T>, numero: number, porPagina: number) {
  expect(pagina.pagina).toBe(numero);
  expect(pagina.porPagina).toBe(porPagina);
  expect(pagina.totalPaginas).toBe(Math.ceil(pagina.total / porPagina));
  expect(pagina.items.length).toBe(Math.max(0, Math.min(porPagina, pagina.total - (numero - 1) * porPagina)));
}

describe.skipIf(sinSupabase)('listados públicos (integración, anon)', () => {
  let admin: ClienteBlog;
  let anon: ClienteBlog;
  let categoria: TaxonomiaDePrueba;
  let categoriaSinPublicados: TaxonomiaDePrueba;
  let etiquetaDiseno: TaxonomiaDePrueba;
  let etiquetaSeo: TaxonomiaDePrueba;
  let etiquetaSoloBorrador: TaxonomiaDePrueba;
  let etiquetaSinArticulos: TaxonomiaDePrueba;
  /** Publicados de `categoria`, en el orden en que se publicaron (el primero es el más antiguo). */
  const publicados: Creado[] = [];
  let borrador: Creado;
  let borradorSinPublicados: Creado;
  const creados = registroDePrueba();

  async function insertarTaxonomia(tabla: 'categorias' | 'etiquetas', nombre: string, slug: string) {
    const { data, error } = await admin
      .from(tabla)
      .insert({ nombre: `${nombre} ${sufijo}`, slug: `${slug}-${sufijo}`, descripcion: `Descripción de ${nombre}.` })
      .select('id, nombre, slug, descripcion')
      .single();
    if (error) throw new Error(`No se pudo crear la taxonomía de prueba: ${error.message}`);
    (tabla === 'categorias' ? creados.categorias : creados.etiquetas).push(data.id);
    return data;
  }

  function crearArticulo(
    nombre: string,
    categoriaId: string,
    { publicar, etiquetas = [] }: { publicar: boolean; etiquetas?: string[] },
  ): Promise<Creado> {
    return crearArticuloDePrueba(admin, creados, {
      titulo: `H3 listados: ${nombre}`,
      slug: `h3-listados-${nombre}-${sufijo}`,
      extracto: `Extracto de ${nombre}.`,
      contenido,
      categoriaId,
      etiquetas,
      publicar,
    });
  }

  beforeAll(async () => {
    ({ admin } = await sesionAdminDemo());
    anon = clienteAnon();

    categoria = await insertarTaxonomia('categorias', 'H3 Listados Categoría', 'h3-listados-categoria');
    categoriaSinPublicados = await insertarTaxonomia('categorias', 'H3 Listados Vacía', 'h3-listados-vacia');
    etiquetaDiseno = await insertarTaxonomia('etiquetas', 'H3 Listados Diseño', 'h3-listados-diseno');
    etiquetaSeo = await insertarTaxonomia('etiquetas', 'H3 Listados SEO', 'h3-listados-seo');
    etiquetaSoloBorrador = await insertarTaxonomia(
      'etiquetas',
      'H3 Listados Solo Borrador',
      'h3-listados-solo-borrador',
    );
    etiquetaSinArticulos = await insertarTaxonomia(
      'etiquetas',
      'H3 Listados Sin Artículos',
      'h3-listados-sin-articulos',
    );

    // H3-E1: 3 publicados y 1 borrador en la misma categoría. Se publican en orden, así que el
    // último publicado es el más reciente (publicado_en = now() de cada petición).
    publicados.push(
      await crearArticulo('primero', categoria.id, {
        publicar: true,
        etiquetas: [etiquetaSeo.id, etiquetaDiseno.id],
      }),
    );
    publicados.push(await crearArticulo('segundo', categoria.id, { publicar: true }));
    publicados.push(await crearArticulo('tercero', categoria.id, { publicar: true }));
    borrador = await crearArticulo('borrador', categoria.id, {
      publicar: false,
      etiquetas: [etiquetaDiseno.id, etiquetaSoloBorrador.id],
    });
    // H3-E5: una categoría que solo tiene un borrador.
    borradorSinPublicados = await crearArticulo('borrador-sin-publicados', categoriaSinPublicados.id, {
      publicar: false,
    });
  });

  // Primero los artículos (la categoría tiene FK restrict y no se borra en uso).
  afterAll(() => creados.limpiar(admin));

  describe('listarPorCategoria', () => {
    it('H3-E1: devuelve exactamente los 3 publicados, del más reciente al más antiguo', async () => {
      const resultado = await listarPorCategoria(anon, categoria.slug);

      expect(resultado?.categoria).toMatchObject(categoria);
      const ids = resultado?.articulos.items.map((item) => item.id);
      expect(ids).toEqual([publicados[2]?.id, publicados[1]?.id, publicados[0]?.id]);
      expect(ids).not.toContain(borrador.id);
      esperarOrdenDescendente(resultado?.articulos.items ?? []);
    });

    it('RF-017: la página por defecto es la 1, con 12 por página y el total correcto', async () => {
      const resultado = await listarPorCategoria(anon, categoria.slug);

      expect(resultado?.articulos).toMatchObject({ total: 3, pagina: 1, porPagina: 12, totalPaginas: 1 });
    });

    it('RF-017: pagina con un tamaño configurable', async () => {
      const primera = await listarPorCategoria(anon, categoria.slug, { porPagina: 2 });
      const segunda = await listarPorCategoria(anon, categoria.slug, { pagina: 2, porPagina: 2 });

      expect(primera?.articulos).toMatchObject({ total: 3, pagina: 1, porPagina: 2, totalPaginas: 2 });
      expect(primera?.articulos.items.map((item) => item.id)).toEqual([publicados[2]?.id, publicados[1]?.id]);
      expect(segunda?.articulos).toMatchObject({ total: 3, pagina: 2, porPagina: 2, totalPaginas: 2 });
      expect(segunda?.articulos.items.map((item) => item.id)).toEqual([publicados[0]?.id]);
    });

    it('cada item es un resumen con id, título, slug, extracto, fecha de publicación y categoría', async () => {
      const resultado = await listarPorCategoria(anon, categoria.slug);

      const masAntiguo = resultado?.articulos.items.at(-1);
      expect(masAntiguo).toMatchObject({
        id: publicados[0]?.id,
        titulo: 'H3 listados: primero',
        slug: publicados[0]?.slug,
        extracto: 'Extracto de primero.',
        publicado_en: expect.any(String),
        categoria: { nombre: categoria.nombre, slug: categoria.slug },
      });
      expect(Number.isNaN(new Date(masAntiguo?.publicado_en ?? '').getTime())).toBe(false);
    });

    it('H3-E5: una categoría sin publicados devuelve un listado vacío, sin error', async () => {
      const resultado = await listarPorCategoria(anon, categoriaSinPublicados.slug);

      expect(resultado?.categoria).toMatchObject(categoriaSinPublicados);
      expect(resultado?.articulos).toMatchObject({ items: [], total: 0, pagina: 1, porPagina: 12 });
    });

    it('un slug inexistente devuelve null', async () => {
      await expect(listarPorCategoria(anon, `h3-listados-no-existe-${sufijo}`)).resolves.toBeNull();
    });

    it('CE-002: con una sesión del equipo tampoco lista borradores', async () => {
      const resultado = await listarPorCategoria(admin, categoria.slug);

      expect(resultado?.articulos.items.map((item) => item.id)).not.toContain(borrador.id);
      expect(resultado?.articulos.total).toBe(3);
    });
  });

  describe('listarPorEtiqueta', () => {
    it('H3-E2: un artículo con las etiquetas "seo" y "diseño" aparece en el listado de "diseño"', async () => {
      const resultado = await listarPorEtiqueta(anon, etiquetaDiseno.slug);

      expect(resultado?.etiqueta).toMatchObject(etiquetaDiseno);
      expect(resultado?.articulos.items.map((item) => item.id)).toEqual([publicados[0]?.id]);
      expect(resultado?.articulos).toMatchObject({ total: 1, pagina: 1, porPagina: 12, totalPaginas: 1 });
    });

    it('H3-E2: el mismo artículo aparece en el listado de "seo"', async () => {
      const resultado = await listarPorEtiqueta(anon, etiquetaSeo.slug);

      expect(resultado?.articulos.items.map((item) => item.id)).toEqual([publicados[0]?.id]);
    });

    it('H3-E5: una etiqueta sin publicados devuelve un listado vacío, sin error', async () => {
      const soloBorrador = await listarPorEtiqueta(anon, etiquetaSoloBorrador.slug);
      const sinArticulos = await listarPorEtiqueta(anon, etiquetaSinArticulos.slug);

      expect(soloBorrador?.etiqueta).toMatchObject(etiquetaSoloBorrador);
      expect(soloBorrador?.articulos).toMatchObject({ items: [], total: 0 });
      expect(sinArticulos?.articulos).toMatchObject({ items: [], total: 0 });
    });

    it('un slug inexistente devuelve null', async () => {
      await expect(listarPorEtiqueta(anon, `h3-listados-no-existe-${sufijo}`)).resolves.toBeNull();
    });
  });

  describe('listarArticulosPublicados', () => {
    it('RF-017: por defecto devuelve la página 1 con 12 por página', async () => {
      const pagina = await listarArticulosPublicados(anon);

      expect(pagina.total).toBeGreaterThanOrEqual(3);
      esperarPaginaCoherente(pagina, 1, 12);
      esperarOrdenDescendente(pagina.items);
    });

    it('RF-017: pagina con un tamaño configurable', async () => {
      const primera = await listarArticulosPublicados(anon, { porPagina: 1 });
      const segunda = await listarArticulosPublicados(anon, { pagina: 2, porPagina: 1 });

      esperarPaginaCoherente(primera, 1, 1);
      esperarPaginaCoherente(segunda, 2, 1);
    });

    it('spec 002 (H2-E5): una página fuera de rango devuelve items vacíos y el total real, sin lanzar', async () => {
      const total = (await listarArticulosPublicados(anon)).total;

      const fuera = await listarArticulosPublicados(anon, { pagina: 999 });

      expect(fuera.items).toEqual([]);
      expect(fuera.total).toBeGreaterThanOrEqual(total);
      expect(fuera.pagina).toBe(999);
      expect(fuera.totalPaginas).toBe(Math.ceil(fuera.total / 12));
    });

    it('incluye los publicados propios en orden y nunca los borradores', async () => {
      const pagina = await listarArticulosPublicados(anon, { porPagina: 50 });

      const ids = pagina.items.map((item) => item.id);
      const propios = ids.filter((id) => publicados.some((publicado) => publicado.id === id));
      expect(propios).toEqual([publicados[2]?.id, publicados[1]?.id, publicados[0]?.id]);
      expect(ids).not.toContain(borrador.id);
      expect(ids).not.toContain(borradorSinPublicados.id);
      esperarOrdenDescendente(pagina.items);
    });
  });

  describe('listarParaSitemap', () => {
    it('A5-B1: hace una sola petición (RPC entradas_sitemap, sin el corte de max_rows)', async () => {
      const espiaFetch = vi.spyOn(globalThis, 'fetch');

      await listarParaSitemap(anon);

      expect(espiaFetch).toHaveBeenCalledTimes(1);
      espiaFetch.mockRestore();
    });

    it('RSEO-004: incluye los artículos publicados con su fecha de última modificación', async () => {
      const entradas = await listarParaSitemap(anon);

      const { data: filas, error } = await admin
        .from('articulos')
        .select('slug, actualizado_en')
        .in(
          'id',
          publicados.map((publicado) => publicado.id),
        );
      if (error) throw new Error(`No se pudieron leer los artículos de prueba: ${error.message}`);
      for (const fila of filas) {
        const entrada = entradas.find((e) => e.tipo === 'articulo' && e.slug === fila.slug);
        expect(entrada, `falta el artículo ${fila.slug} en el sitemap`).toBeDefined();
        expect(new Date(entrada?.actualizadoEn ?? '').getTime()).toBe(new Date(fila.actualizado_en).getTime());
      }
    });

    it('CE-002: no incluye borradores', async () => {
      const entradas = await listarParaSitemap(anon);

      const slugsArticulos = entradas.filter((e) => e.tipo === 'articulo').map((e) => e.slug);
      expect(slugsArticulos).not.toContain(borrador.slug);
      expect(slugsArticulos).not.toContain(borradorSinPublicados.slug);
    });

    it('RSEO-004: incluye solo las categorías y etiquetas con algún artículo publicado', async () => {
      const entradas = await listarParaSitemap(anon);

      const slugsDe = (tipo: string) => entradas.filter((e) => e.tipo === tipo).map((e) => e.slug);
      expect(slugsDe('categoria')).toContain(categoria.slug);
      expect(slugsDe('categoria')).not.toContain(categoriaSinPublicados.slug);
      expect(slugsDe('etiqueta')).toEqual(expect.arrayContaining([etiquetaDiseno.slug, etiquetaSeo.slug]));
      expect(slugsDe('etiqueta')).not.toContain(etiquetaSoloBorrador.slug);
      expect(slugsDe('etiqueta')).not.toContain(etiquetaSinArticulos.slug);
    });

    it('RSEO-004: cada entrada tiene tipo, slug y una fecha de modificación válida', async () => {
      const entradas = await listarParaSitemap(anon);

      const propia = entradas.find((e) => e.tipo === 'categoria' && e.slug === categoria.slug);
      expect(propia).toMatchObject({ tipo: 'categoria', slug: categoria.slug });
      expect(Number.isNaN(new Date(propia?.actualizadoEn ?? '').getTime())).toBe(false);
      expect(entradas.every((e) => ['articulo', 'categoria', 'etiqueta', 'autor'].includes(e.tipo))).toBe(true);
    });
  });

  // Spec 002, T047 (RF-005, research D18): hasta 3 publicados, primero de la misma categoría
  // y sin el propio artículo; si faltan, se completa con los más recientes sin repetir.
  describe('listarRelacionados', () => {
    let categoriaLlena: TaxonomiaDePrueba;
    let categoriaCorta: TaxonomiaDePrueba;
    /** 5 publicados de `categoriaLlena`, del más antiguo al más reciente. */
    const llena: Creado[] = [];
    /** 2 publicados de `categoriaCorta`, del más antiguo al más reciente. */
    const corta: Creado[] = [];
    let borradorCorta: Creado;
    /** Fecha del publicado más reciente fuera de `categoriaCorta`, antes de consultar (otras suites pueden publicar después). */
    let masRecienteAntes: number;

    const crearRelacionado = (nombre: string, categoriaId: string, publicar = true) =>
      crearArticuloDePrueba(admin, creados, {
        titulo: `002 relacionados: ${nombre}`,
        slug: `002-relacionados-${nombre}-${sufijo}`,
        extracto: `Extracto de ${nombre}.`,
        contenido,
        categoriaId,
        publicar,
      });

    /** El artículo de prueba en la posición pedida (falla si no se creó). */
    function articulo(lista: Creado[], indice: number) {
      const encontrado = lista[indice];
      if (!encontrado) throw new Error('Faltan los artículos de prueba');
      return encontrado;
    }

    beforeAll(async () => {
      categoriaLlena = await insertarTaxonomia('categorias', '002 Relacionados Llena', '002-relacionados-llena');
      categoriaCorta = await insertarTaxonomia('categorias', '002 Relacionados Corta', '002-relacionados-corta');
      for (const nombre of ['llena-1', 'llena-2', 'llena-3', 'llena-4', 'llena-5']) {
        llena.push(await crearRelacionado(nombre, categoriaLlena.id));
      }
      corta.push(await crearRelacionado('corta-1', categoriaCorta.id));
      // Un borrador de la misma categoría: nunca debe aparecer.
      borradorCorta = await crearRelacionado('corta-borrador', categoriaCorta.id, false);
      corta.push(await crearRelacionado('corta-2', categoriaCorta.id));
      const previos = await listarArticulosPublicados(anon, { porPagina: 5 });
      const ajeno = previos.items.find((item) => !corta.some((propio) => propio.id === item.id));
      masRecienteAntes = new Date(ajeno?.publicado_en ?? 0).getTime();
    });

    it('RF-005: con suficientes en la categoría, devuelve 3 de ella, del más reciente al más antiguo', async () => {
      const propio = articulo(llena, 0);

      const relacionados = await listarRelacionados(anon, { id: propio.id, categoriaId: categoriaLlena.id }, 3);

      expect(relacionados.map((r) => r.id)).toEqual([llena[4]?.id, llena[3]?.id, llena[2]?.id]);
      esperarOrdenDescendente(relacionados);
    });

    it('RF-005: nunca incluye el propio artículo', async () => {
      const propio = articulo(llena, 4);

      const relacionados = await listarRelacionados(anon, { id: propio.id, categoriaId: categoriaLlena.id }, 3);

      expect(relacionados.map((r) => r.id)).not.toContain(propio.id);
      expect(relacionados.map((r) => r.id)).toEqual([llena[3]?.id, llena[2]?.id, llena[1]?.id]);
    });

    it('D18: si faltan en la categoría, completa con los más recientes sin repetir ni incluir el propio', async () => {
      const propio = articulo(corta, 0);

      const relacionados = await listarRelacionados(anon, { id: propio.id, categoriaId: categoriaCorta.id }, 3);

      const ids = relacionados.map((r) => r.id);
      expect(ids).toHaveLength(3);
      // Primero el único otro publicado de la misma categoría.
      expect(ids[0]).toBe(corta[1]?.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids).not.toContain(propio.id);
      expect(ids).not.toContain(borradorCorta.id);
      // Los que completan son de otras categorías y los más recientes del sitio.
      const completados = relacionados.slice(1);
      for (const completado of completados) {
        expect(completado.categoria?.id).not.toBe(categoriaCorta.id);
      }
      esperarOrdenDescendente(completados);
      expect(new Date(completados[0]?.publicado_en ?? 0).getTime()).toBeGreaterThanOrEqual(masRecienteAntes);
    });

    it('D18: el relleno sale del listado general de publicados más recientes', async () => {
      const propio = articulo(corta, 0);

      const relacionados = await listarRelacionados(anon, { id: propio.id, categoriaId: categoriaCorta.id }, 3);
      const recientes = await listarArticulosPublicados(anon, { porPagina: 12 });

      const idsRecientes = recientes.items.map((item) => item.id);
      for (const completado of relacionados.slice(1)) {
        expect(idsRecientes).toContain(completado.id);
      }
    });

    it('RF-005: respeta la cantidad pedida', async () => {
      const propio = articulo(llena, 0);

      const relacionados = await listarRelacionados(anon, { id: propio.id, categoriaId: categoriaLlena.id }, 2);

      expect(relacionados.map((r) => r.id)).toEqual([llena[4]?.id, llena[3]?.id]);
    });

    it('RF-009: cada relacionado es un resumen con id, título, slug, extracto, imagen, fecha y categoría', async () => {
      const propio = articulo(llena, 0);

      const [primero] = await listarRelacionados(anon, { id: propio.id, categoriaId: categoriaLlena.id }, 3);

      expect(primero).toMatchObject({
        id: llena[4]?.id,
        titulo: '002 relacionados: llena-5',
        slug: llena[4]?.slug,
        extracto: 'Extracto de llena-5.',
        imagen_destacada: null,
        publicado_en: expect.any(String),
        categoria: { id: categoriaLlena.id, nombre: categoriaLlena.nombre, slug: categoriaLlena.slug },
      });
    });

    it('D18: hace a lo sumo 2 peticiones, aunque tenga que completar', async () => {
      const propio = articulo(corta, 0);
      const espiaFetch = vi.spyOn(globalThis, 'fetch');

      await listarRelacionados(anon, { id: propio.id, categoriaId: categoriaCorta.id }, 3);

      expect(espiaFetch.mock.calls.length).toBeLessThanOrEqual(2);
      espiaFetch.mockRestore();
    });
  });

  // Spec 002, T060 (H2-E4, RF-008): el autor público y sus publicados. Los artículos propios los
  // escribe Eva Editora, a quien ninguna otra suite de integración usa como autora; aun así, su
  // listado se compara con lo que lee el admin en el mismo momento, no con un total fijo.
  describe('listarPorAutor', () => {
    const ID_EVA = '00000000-0000-4000-a000-000000000002';
    const SLUG_EVA = 'eva-editora';
    let editora: ClienteBlog;
    let categoriaAutor: TaxonomiaDePrueba;
    /** Publicados propios de Eva, del más antiguo al más reciente. */
    const propios: Creado[] = [];
    let borradorPropio: Creado;
    /** Miembro con un borrador y ningún publicado: no tiene página de autor. */
    let sinPublicados: Awaited<ReturnType<typeof crearMiembroDePrueba>> | undefined;
    let slugSinPublicados: string;
    const creadosAutor = registroDePrueba();

    const crearDeAutor = (autor: ClienteBlog, nombre: string, publicar: boolean) =>
      crearArticuloDePrueba(autor, creadosAutor, {
        titulo: `002 autor: ${nombre}`,
        slug: `002-autor-${nombre}-${sufijo}`,
        extracto: `Extracto de ${nombre}.`,
        contenido,
        categoriaId: categoriaAutor.id,
        publicar,
      });

    /** Ids de los publicados de Eva según el admin, en el orden del listado público. */
    async function publicadosDeEva() {
      const { data, error } = await admin
        .from('articulos')
        .select('id')
        .eq('autor_id', ID_EVA)
        .eq('estado', 'publicado')
        .order('publicado_en', { ascending: false })
        .order('id', { ascending: false });
      if (error) throw new Error(`No se pudieron leer los artículos de Eva: ${error.message}`);
      return data.map((fila) => fila.id);
    }

    beforeAll(async () => {
      editora = await clienteComo('editora@demo.local', 'demo-editora-2026');
      categoriaAutor = await insertarTaxonomia('categorias', '002 Autor', '002-autor');
      propios.push(await crearDeAutor(editora, 'primero', true));
      borradorPropio = await crearDeAutor(editora, 'borrador', false);
      propios.push(await crearDeAutor(editora, 'segundo', true));

      sinPublicados = await crearMiembroDePrueba(`Autor Sin Publicados ${sufijo}`);
      await crearDeAutor(sinPublicados.sesion, 'sin-publicados-borrador', false);
      const { data, error } = await admin.from('perfiles').select('slug').eq('id', sinPublicados.id).single();
      if (error) throw new Error(`No se pudo leer el slug del miembro de prueba: ${error.message}`);
      slugSinPublicados = data.slug;
    });

    // Los artículos antes que el perfil (FK restrict); la categoría la borra el afterAll general.
    afterAll(async () => {
      await creadosAutor.limpiar(admin);
      await sinPublicados?.eliminar();
    });

    it('H2-E4: devuelve el autor con id, slug, nombre, biografía y avatar', async () => {
      const resultado = await listarPorAutor(anon, SLUG_EVA);

      expect(resultado?.autor).toEqual({
        id: ID_EVA,
        slug: SLUG_EVA,
        nombre: 'Eva Editora',
        biografia: 'Diseñadora de identidad visual. Le interesan la tipografía y la accesibilidad.',
        avatar: null,
      });
    });

    it('H2-E4: el autor nunca expone su correo, su rol ni su estado', async () => {
      const resultado = await listarPorAutor(anon, SLUG_EVA);

      expect(resultado).not.toBeNull();
      const autor = resultado?.autor ?? {};
      expect(Object.keys(autor).sort()).toEqual(['avatar', 'biografia', 'id', 'nombre', 'slug']);
      expect(autor).not.toHaveProperty('email');
      expect(autor).not.toHaveProperty('rol');
      expect(autor).not.toHaveProperty('activo');
    });

    it('H2-E4: lista solo sus publicados, del más reciente al más antiguo', async () => {
      const resultado = await listarPorAutor(anon, SLUG_EVA, { porPagina: 50 });

      const ids = resultado?.articulos.items.map((item) => item.id);
      expect(ids).toEqual(await publicadosDeEva());
      esperarOrdenDescendente(resultado?.articulos.items ?? []);
    });

    it('H2-E4: incluye sus publicados nuevos primero y nunca su borrador', async () => {
      const resultado = await listarPorAutor(anon, SLUG_EVA, { porPagina: 50 });

      const ids = resultado?.articulos.items.map((item) => item.id) ?? [];
      expect(ids.slice(0, 2)).toEqual([propios[1]?.id, propios[0]?.id]);
      expect(ids).not.toContain(borradorPropio.id);
    });

    it('H2-E4: no incluye artículos de otros autores', async () => {
      const resultado = await listarPorAutor(anon, SLUG_EVA, { porPagina: 50 });

      // Los publicados de la suite general los escribió Ana Admin.
      const ids = resultado?.articulos.items.map((item) => item.id) ?? [];
      expect(ids).not.toContain(publicados[0]?.id);
      expect(resultado?.articulos.total).toBe((await publicadosDeEva()).length);
    });

    it('CE-002: con una sesión del equipo tampoco lista borradores', async () => {
      const resultado = await listarPorAutor(admin, SLUG_EVA, { porPagina: 50 });

      const ids = resultado?.articulos.items.map((item) => item.id);
      expect(ids).not.toContain(borradorPropio.id);
      expect(ids).toEqual(await publicadosDeEva());
    });

    it('RF-009: cada item es el mismo resumen que en los demás listados', async () => {
      const resultado = await listarPorAutor(anon, SLUG_EVA);

      expect(resultado?.articulos.items[0]).toMatchObject({
        id: propios[1]?.id,
        titulo: '002 autor: segundo',
        slug: propios[1]?.slug,
        extracto: 'Extracto de segundo.',
        imagen_destacada: null,
        publicado_en: expect.any(String),
        categoria: { id: categoriaAutor.id, nombre: categoriaAutor.nombre, slug: categoriaAutor.slug },
      });
    });

    it('RF-008: pagina igual que los demás listados (12 por defecto y tamaño configurable)', async () => {
      const porDefecto = await listarPorAutor(anon, SLUG_EVA);
      const segunda = await listarPorAutor(anon, SLUG_EVA, { pagina: 2, porPagina: 2 });

      expect(porDefecto).not.toBeNull();
      expect(segunda).not.toBeNull();
      if (!porDefecto || !segunda) return;
      esperarPaginaCoherente(porDefecto.articulos, 1, 12);
      esperarPaginaCoherente(segunda.articulos, 2, 2);
      expect(segunda.articulos.items.map((item) => item.id)).toEqual((await publicadosDeEva()).slice(2, 4));
    });

    it('un slug inexistente devuelve null', async () => {
      await expect(listarPorAutor(anon, `002-autor-no-existe-${sufijo}`)).resolves.toBeNull();
    });

    it('H2-E4: un autor sin publicados (solo un borrador) devuelve null, también con sesión del equipo', async () => {
      expect(slugSinPublicados).toMatch(/^autor-sin-publicados/);

      await expect(listarPorAutor(anon, slugSinPublicados)).resolves.toBeNull();
      await expect(listarPorAutor(admin, slugSinPublicados)).resolves.toBeNull();
    });
  });
});
