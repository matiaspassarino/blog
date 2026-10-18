// T038: rutas que se revalidan ante un cambio público (contracts/revalidacion.md,
// "Rutas que calcula rutasAfectadas"; contracts/db.md, "Revalidación"; RF-013).
// Función pura: sin base de datos.
import { describe, expect, it } from 'vitest';
import { rutasAfectadas, type CambioPublico } from './rutas-afectadas';

/** El contrato no fija un orden: se comparan como conjuntos ordenados. */
function ordenadas(rutas: string[]) {
  return [...rutas].sort();
}

function sinDuplicados(rutas: string[]) {
  return new Set(rutas).size === rutas.length;
}

const paginasDelBlog = ['/blog/pagina/1', '/blog/pagina/2', '/blog/pagina/3', '/blog/pagina/4', '/blog/pagina/5'];

describe('rutasAfectadas', () => {
  describe('artículo', () => {
    const cambio: CambioPublico = {
      tipo: 'articulo',
      id: '5b0c0000-0000-4000-8000-000000000001',
      slugs: ['como-elegir-tipografia', 'elegir-tipografia'],
      categorias: ['diseno'],
      etiquetas: ['tipografia', 'branding'],
    };

    it('RF-013: con dos slugs, una categoría y dos etiquetas devuelve exactamente las rutas del contrato', () => {
      expect(ordenadas(rutasAfectadas(cambio))).toEqual(
        ordenadas([
          '/blog/como-elegir-tipografia',
          '/blog/elegir-tipografia',
          '/blog',
          ...paginasDelBlog,
          '/blog/categoria/diseno',
          '/blog/etiqueta/tipografia',
          '/blog/etiqueta/branding',
          '/',
          '/sitemap.xml',
          '/rss.xml',
        ]),
      );
    });

    it('no devuelve rutas duplicadas', () => {
      expect(sinDuplicados(rutasAfectadas(cambio))).toBe(true);
    });

    it('no duplica rutas aunque la entrada repita slugs, categorías o etiquetas', () => {
      const rutas = rutasAfectadas({
        tipo: 'articulo',
        id: '5b0c0000-0000-4000-8000-000000000002',
        slugs: ['mismo', 'mismo'],
        categorias: ['diseno', 'diseno'],
        etiquetas: ['seo', 'seo'],
      });

      expect(sinDuplicados(rutas)).toBe(true);
      expect(ordenadas(rutas)).toEqual(
        ordenadas([
          '/blog/mismo',
          '/blog',
          ...paginasDelBlog,
          '/blog/categoria/diseno',
          '/blog/etiqueta/seo',
          '/',
          '/sitemap.xml',
          '/rss.xml',
        ]),
      );
    });

    it('sin categorías ni etiquetas (opcionales) no agrega rutas de taxonomías', () => {
      const rutas = rutasAfectadas({ tipo: 'articulo', id: '5b0c0000-0000-4000-8000-000000000003', slugs: ['solo'] });

      expect(ordenadas(rutas)).toEqual(
        ordenadas(['/blog/solo', '/blog', ...paginasDelBlog, '/', '/sitemap.xml', '/rss.xml']),
      );
    });

    it('con etiquetas vacías (H2) no agrega rutas de etiqueta', () => {
      const rutas = rutasAfectadas({ ...cambio, etiquetas: [] });

      expect(rutas.some((ruta) => ruta.startsWith('/blog/etiqueta/'))).toBe(false);
    });
  });

  describe('categoría', () => {
    it('devuelve /blog/categoria/{slug} por cada slug, /blog y /sitemap.xml', () => {
      const rutas = rutasAfectadas({
        tipo: 'categoria',
        id: '5b0c0000-0000-4000-8000-000000000004',
        slugs: ['diseno-grafico', 'diseno'],
      });

      expect(ordenadas(rutas)).toEqual(
        ordenadas(['/blog/categoria/diseno-grafico', '/blog/categoria/diseno', '/blog', '/sitemap.xml']),
      );
      expect(sinDuplicados(rutas)).toBe(true);
    });
  });

  describe('etiqueta', () => {
    it('devuelve /blog/etiqueta/{slug} por cada slug, /blog y /sitemap.xml', () => {
      const rutas = rutasAfectadas({
        tipo: 'etiqueta',
        id: '5b0c0000-0000-4000-8000-000000000005',
        slugs: ['tipografia'],
      });

      expect(ordenadas(rutas)).toEqual(ordenadas(['/blog/etiqueta/tipografia', '/blog', '/sitemap.xml']));
    });
  });

  describe('autor', () => {
    it('devuelve /blog/{slug} por cada artículo publicado del autor y /blog', () => {
      const rutas = rutasAfectadas({
        tipo: 'autor',
        id: '5b0c0000-0000-4000-8000-000000000006',
        slugs: ['primer-articulo', 'segundo-articulo'],
      });

      expect(ordenadas(rutas)).toEqual(ordenadas(['/blog/primer-articulo', '/blog/segundo-articulo', '/blog']));
      expect(sinDuplicados(rutas)).toBe(true);
    });

    it('un autor sin artículos publicados solo revalida /blog', () => {
      expect(rutasAfectadas({ tipo: 'autor', id: '5b0c0000-0000-4000-8000-000000000007', slugs: [] })).toEqual([
        '/blog',
      ]);
    });
  });
});
