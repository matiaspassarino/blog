// T057: búsqueda pública (contracts/db.md, "Consultas públicas"; H5-E1, H5-E3, H5-E4; RF-018 a RF-020;
// CE-005; research D12). Integración contra Supabase local como visitante (anon), sobre los datos de
// demo del seed. Los artículos propios los crea y los borra el admin demo (research D18) y usan una
// palabra inventada, así no dependen de lo que publiquen otras suites en paralelo.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ClienteBlog } from '../cliente';
import type { Pagina } from '../paginacion';
import { clienteAnon, clienteComo, sinSupabase } from '../pruebas/clientes';
import { crearArticuloDePrueba, registroDePrueba } from '../pruebas/datos';
import { buscarArticulos } from './busqueda';
import type { ResumenArticulo } from './tipos-publicos';

const sufijo = crypto.randomUUID().slice(0, 8);
/** Solo letras: el parser de texto la trata como una palabra (un sufijo hexadecimal no siempre). */
const palabraUnica = `zorzal${Array.from({ length: 8 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('')}`;

/** Verifica la aritmética de `Pagina<T>`. */
function esperarPaginaCoherente<T>(pagina: Pagina<T>, numero: number, porPagina: number) {
  expect(pagina.pagina).toBe(numero);
  expect(pagina.porPagina).toBe(porPagina);
  expect(pagina.totalPaginas).toBe(Math.ceil(pagina.total / porPagina));
  expect(pagina.items.length).toBe(Math.max(0, Math.min(porPagina, pagina.total - (numero - 1) * porPagina)));
}

describe.skipIf(sinSupabase)('buscarArticulos (integración, anon)', () => {
  let admin: ClienteBlog;
  let anon: ClienteBlog;
  let categoria: { id: string; nombre: string; slug: string };
  let enTitulo: { id: string; slug: string };
  let enCuerpo: { id: string; slug: string };
  let borrador: { id: string; slug: string };
  const creados = registroDePrueba();

  beforeAll(async () => {
    admin = await clienteComo('admin@demo.local', 'demo-admin-2026');
    anon = clienteAnon();

    const { data, error } = await admin
      .from('categorias')
      .insert({ nombre: `H5 búsqueda ${sufijo}`, slug: `h5-busqueda-${sufijo}` })
      .select('id, nombre, slug')
      .single();
    if (error) throw new Error(`No se pudo crear la categoría de prueba: ${error.message}`);
    categoria = data;
    creados.categorias.push(data.id);

    // H5-E2: el que tiene la palabra solo en el cuerpo se publica después (es más reciente).
    enTitulo = await crearArticuloDePrueba(admin, creados, {
      titulo: `H5 búsqueda: ${palabraUnica} en el título`,
      slug: `h5-busqueda-titulo-${sufijo}`,
      extracto: 'Extracto del artículo con la palabra en el título.',
      contenido: [{ id: crypto.randomUUID(), tipo: 'parrafo', texto: 'Cuerpo sin la palabra.' }],
      categoriaId: categoria.id,
    });
    enCuerpo = await crearArticuloDePrueba(admin, creados, {
      titulo: `H5 búsqueda: solo en el cuerpo ${sufijo}`,
      slug: `h5-busqueda-cuerpo-${sufijo}`,
      contenido: [{ id: crypto.randomUUID(), tipo: 'parrafo', texto: `El cuerpo menciona ${palabraUnica}.` }],
      categoriaId: categoria.id,
    });
    borrador = await crearArticuloDePrueba(admin, creados, {
      titulo: `H5 búsqueda: ${palabraUnica} en un borrador`,
      slug: `h5-busqueda-borrador-${sufijo}`,
      contenido: [{ id: crypto.randomUUID(), tipo: 'parrafo', texto: 'Cuerpo del borrador.' }],
      categoriaId: categoria.id,
      publicar: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Primero los artículos (la categoría tiene FK restrict).
  afterAll(() => creados.limpiar(admin));

  it('H5-E1: buscarArticulos(c, "diseno") devuelve una Pagina con items y total sobre los datos de demo', async () => {
    const resultado = await buscarArticulos(anon, 'diseno');

    expect(resultado.total).toBeGreaterThan(0);
    expect(resultado.items.length).toBeGreaterThan(0);
    esperarPaginaCoherente(resultado, 1, 12);
  });

  it('CE-005: la búsqueda sobre los datos de demo responde en menos de 1.000 ms', async () => {
    const inicio = performance.now();
    await buscarArticulos(anon, 'diseno');
    const duracion = performance.now() - inicio;

    expect(duracion).toBeLessThan(1000);
  });

  it('cada item es un ResumenArticulo con id, título, slug, extracto, fecha de publicación y categoría', async () => {
    const resultado = await buscarArticulos(anon, palabraUnica);

    const item = resultado.items.find((candidato) => candidato.id === enTitulo.id);
    expect(item).toMatchObject<Partial<ResumenArticulo>>({
      id: enTitulo.id,
      titulo: `H5 búsqueda: ${palabraUnica} en el título`,
      slug: enTitulo.slug,
      extracto: 'Extracto del artículo con la palabra en el título.',
      imagen_destacada: null,
      publicado_en: expect.any(String),
    });
    expect(item?.categoria).toEqual({ id: categoria.id, nombre: categoria.nombre, slug: categoria.slug });
    expect(Number.isNaN(new Date(item?.publicado_en ?? '').getTime())).toBe(false);
  });

  it('H5-E2: el artículo con la palabra en el título aparece antes que el que la tiene solo en el cuerpo', async () => {
    const resultado = await buscarArticulos(anon, palabraUnica);

    expect(resultado.items.map((item) => item.id)).toEqual([enTitulo.id, enCuerpo.id]);
    expect(resultado.total).toBe(2);
  });

  it('H5-E3: un borrador con la palabra no aparece, ni para el visitante ni con una sesión del equipo', async () => {
    const comoVisitante = await buscarArticulos(anon, palabraUnica);
    const comoAdmin = await buscarArticulos(admin, palabraUnica);

    expect(comoVisitante.items.map((item) => item.id)).not.toContain(borrador.id);
    expect(comoAdmin.items.map((item) => item.id)).not.toContain(borrador.id);
    expect(comoAdmin.total).toBe(2);
  });

  it('pagina con un tamaño configurable y conserva el total', async () => {
    const primera = await buscarArticulos(anon, palabraUnica, { porPagina: 1 });
    const segunda = await buscarArticulos(anon, palabraUnica, { pagina: 2, porPagina: 1 });

    expect(primera).toMatchObject({ total: 2, pagina: 1, porPagina: 1, totalPaginas: 2 });
    expect(primera.items.map((item) => item.id)).toEqual([enTitulo.id]);
    expect(segunda).toMatchObject({ total: 2, pagina: 2, porPagina: 1, totalPaginas: 2 });
    expect(segunda.items.map((item) => item.id)).toEqual([enCuerpo.id]);
  });

  it('H5-E4: una consulta vacía devuelve una página vacía, sin error', async () => {
    const resultado = await buscarArticulos(anon, '');

    expect(resultado).toMatchObject({ items: [], total: 0, pagina: 1, porPagina: 12, totalPaginas: 0 });
  });

  it('H5-E4: una consulta sin coincidencias devuelve una página vacía, sin error', async () => {
    const resultado = await buscarArticulos(anon, `${palabraUnica}inexistente`);

    expect(resultado).toMatchObject({ items: [], total: 0, pagina: 1, porPagina: 12, totalPaginas: 0 });
  });

  it('hace una sola petición a la base (contracts/db.md)', async () => {
    const espiaFetch = vi.spyOn(globalThis, 'fetch');

    await buscarArticulos(anon, palabraUnica);

    expect(espiaFetch).toHaveBeenCalledTimes(1);
  });
});
