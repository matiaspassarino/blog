// T022 (spec 002): política de caché y tags de cada página (contracts/cache.md, "Tags que
// declara cada página"; research D1, H4-E6). Los tags salen de los constructores de @blog/db.
import { TAG_ARTICULOS, tagArticulo, tagAutor, tagCategoria, tagEtiqueta } from '@blog/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheArticulo, cacheListado, cacheNoEncontrado, cacheRedireccion } from './cache';

const UN_ANIO = 31_536_000;

type ArticuloDePrueba = Parameters<typeof cacheArticulo>[0];
type RelacionadosDePrueba = Parameters<typeof cacheArticulo>[1];

function articuloDePrueba(campos: Record<string, unknown> = {}): ArticuloDePrueba {
  return {
    id: 'a0000000-0000-4000-8000-000000000001',
    titulo: 'Artículo de prueba',
    slug: 'articulo-de-prueba',
    extracto: null,
    imagen_destacada: null,
    contenido: [],
    publicado_en: '2026-10-18T15:00:00Z',
    actualizado_en: '2026-10-18T15:00:00Z',
    categoria: { id: 'c0000000-0000-4000-8000-000000000001', nombre: 'Diseño', slug: 'diseno' },
    etiquetas: [
      { id: 'e0000000-0000-4000-8000-000000000001', nombre: 'Astro', slug: 'astro' },
      { id: 'e0000000-0000-4000-8000-000000000002', nombre: 'SEO', slug: 'seo' },
    ],
    autor: {
      id: 'u0000000-0000-4000-8000-000000000001',
      slug: 'ana-admin',
      nombre: 'Ana Admin',
      biografia: null,
      avatar: null,
    },
    seo: { titulo: 'Artículo de prueba', descripcion: null },
    ...campos,
  } as unknown as ArticuloDePrueba;
}

function relacionado(id: string) {
  return {
    id,
    titulo: `Relacionado ${id}`,
    slug: `relacionado-${id}`,
    extracto: null,
    imagen_destacada: null,
    publicado_en: '2026-10-17T15:00:00Z',
    categoria: null,
  };
}

const relacionados = [
  relacionado('r0000000-0000-4000-8000-000000000001'),
  relacionado('r0000000-0000-4000-8000-000000000002'),
] as unknown as RelacionadosDePrueba;

const ordenados = (tags: readonly string[] | undefined) => [...(tags ?? [])].sort();

describe('cacheArticulo', () => {
  it('contrato: maxAge de un año y swr de 60 s', () => {
    const politica = cacheArticulo(articuloDePrueba(), relacionados);

    expect(politica.maxAge).toBe(UN_ANIO);
    expect(politica.swr).toBe(60);
  });

  it('H4-E6: declara los tags del artículo, su categoría, sus etiquetas, su autor y sus relacionados', () => {
    const articulo = articuloDePrueba();

    const { tags } = cacheArticulo(articulo, relacionados);

    expect(ordenados(tags)).toEqual(
      ordenados([
        tagArticulo('a0000000-0000-4000-8000-000000000001'),
        tagCategoria('c0000000-0000-4000-8000-000000000001'),
        tagEtiqueta('e0000000-0000-4000-8000-000000000001'),
        tagEtiqueta('e0000000-0000-4000-8000-000000000002'),
        tagAutor('u0000000-0000-4000-8000-000000000001'),
        tagArticulo('r0000000-0000-4000-8000-000000000001'),
        tagArticulo('r0000000-0000-4000-8000-000000000002'),
      ]),
    );
  });

  it('H4-E6: el artículo lleva el tag de su categoría (categoria:<id>)', () => {
    const { tags } = cacheArticulo(articuloDePrueba(), relacionados);

    expect(tags).toContain('categoria:c0000000-0000-4000-8000-000000000001');
  });

  it('contrato: los tags no se repiten', () => {
    const repetidos = [
      ...(relacionados as unknown[]),
      relacionado('r0000000-0000-4000-8000-000000000001'),
    ] as unknown as RelacionadosDePrueba;

    const { tags = [] } = cacheArticulo(articuloDePrueba(), repetidos);

    expect(new Set(tags).size).toBe(tags.length);
    expect(tags.filter((tag) => tag === tagArticulo('r0000000-0000-4000-8000-000000000001'))).toHaveLength(1);
  });

  it('sin categoría, sin autor y sin relacionados declara solo el tag del artículo', () => {
    const articulo = articuloDePrueba({ categoria: null, autor: null, etiquetas: [] });

    const { tags } = cacheArticulo(articulo, [] as unknown as RelacionadosDePrueba);

    expect(tags).toEqual([tagArticulo('a0000000-0000-4000-8000-000000000001')]);
  });
});

describe('cacheListado', () => {
  it('contrato: sin entidad declara solo el tag articulos, con maxAge de un año y swr de 60 s', () => {
    expect(cacheListado()).toEqual({ maxAge: UN_ANIO, swr: 60, tags: [TAG_ARTICULOS] });
  });

  it('contrato: con una categoría agrega categoria:<id>', () => {
    expect(cacheListado({ tipo: 'categoria', id: 'c1' }).tags).toEqual([TAG_ARTICULOS, tagCategoria('c1')]);
  });

  it('contrato: con una etiqueta agrega etiqueta:<id>', () => {
    expect(cacheListado({ tipo: 'etiqueta', id: 'e1' }).tags).toEqual([TAG_ARTICULOS, tagEtiqueta('e1')]);
  });

  it('contrato: con un autor agrega autor:<id>', () => {
    expect(cacheListado({ tipo: 'autor', id: 'u1' }).tags).toEqual([TAG_ARTICULOS, tagAutor('u1')]);
  });
});

describe('cacheNoEncontrado y cacheRedireccion', () => {
  it('contrato: el 404 se cachea una hora con swr de 60 s y sin tags propios', () => {
    const politica = cacheNoEncontrado();

    expect(politica.maxAge).toBe(3600);
    expect(politica.swr).toBe(60);
    expect(politica.tags ?? []).toEqual([]);
  });

  it('contrato: la redirección se cachea un año sin swr y sin tags', () => {
    const politica = cacheRedireccion();

    expect(politica.maxAge).toBe(UN_ANIO);
    expect(politica.swr).toBe(0);
    expect(politica.tags ?? []).toEqual([]);
  });
});

describe('fuente única del formato de los tags', () => {
  afterEach(() => {
    vi.doUnmock('@blog/db');
    vi.resetModules();
  });

  it('contracts/cache.md: los constructores de @blog/db producen el formato del contrato', () => {
    expect(TAG_ARTICULOS).toBe('articulos');
    expect(tagArticulo('x')).toBe('articulo:x');
    expect(tagCategoria('x')).toBe('categoria:x');
    expect(tagEtiqueta('x')).toBe('etiqueta:x');
    expect(tagAutor('x')).toBe('autor:x');
  });

  it('contracts/cache.md: cache.ts arma los tags con los constructores de @blog/db, no con texto literal', async () => {
    vi.resetModules();
    vi.doMock('@blog/db', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@blog/db')>()),
      TAG_ARTICULOS: 'TODOS',
      tagArticulo: (id: string) => `A|${id}`,
      tagCategoria: (id: string) => `C|${id}`,
      tagEtiqueta: (id: string) => `E|${id}`,
      tagAutor: (id: string) => `U|${id}`,
    }));
    const cache = await import('./cache');

    expect(cache.cacheListado({ tipo: 'categoria', id: 'c1' }).tags).toEqual(['TODOS', 'C|c1']);
    expect(ordenados(cache.cacheArticulo(articuloDePrueba(), relacionados).tags)).toEqual(
      ordenados([
        'A|a0000000-0000-4000-8000-000000000001',
        'C|c0000000-0000-4000-8000-000000000001',
        'E|e0000000-0000-4000-8000-000000000001',
        'E|e0000000-0000-4000-8000-000000000002',
        'U|u0000000-0000-4000-8000-000000000001',
        'A|r0000000-0000-4000-8000-000000000001',
        'A|r0000000-0000-4000-8000-000000000002',
      ]),
    );
  });
});
