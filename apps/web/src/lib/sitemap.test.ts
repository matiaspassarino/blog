// T085 (spec 002): XML del sitemap (RSEO-005, H5-E1; research D14). Función pura de
// src/lib/sitemap.ts:
//   xmlSitemap(entradas: EntradaSitemap[], urlSitio: string): string
// `entradas` sale de listarParaSitemap (RPC entradas_sitemap: solo artículos publicados y
// taxonomías y autores con publicados, sin slugs anteriores). `urlSitio` es PUBLIC_URL_SITIO,
// absoluta y sin barra final. Además de las entradas, el XML incluye la portada y /blog, con
// `<lastmod>` igual a la modificación más reciente de las entradas (si hay alguna).
import type { EntradaSitemap } from '@blog/db';
import { describe, expect, it } from 'vitest';
import { xmlSitemap } from './sitemap';

const urlSitio = 'https://estudio.example';

const entradas: EntradaSitemap[] = [
  { tipo: 'articulo', slug: 'guia-visual-todos-los-bloques-del-blog', actualizadoEn: '2026-10-05T09:30:00+00:00' },
  { tipo: 'categoria', slug: 'diseno', actualizadoEn: '2026-10-03T10:00:00+00:00' },
  { tipo: 'etiqueta', slug: 'ux', actualizadoEn: '2026-10-02T08:00:00+00:00' },
  { tipo: 'autor', slug: 'eva-editora', actualizadoEn: '2026-10-04T11:15:00+00:00' },
];

/** Las <url> del XML como pares loc → lastmod (null si no tiene). */
function urlsDe(xml: string): Map<string, string | null> {
  const urls = new Map<string, string | null>();
  for (const [, bloque] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([\s\S]*?)<\/loc>/.exec(bloque ?? '')?.[1] ?? '';
    const lastmod = /<lastmod>([\s\S]*?)<\/lastmod>/.exec(bloque ?? '')?.[1] ?? null;
    urls.set(loc, lastmod);
  }
  return urls;
}

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

describe('xmlSitemap (RSEO-005, H5-E1)', () => {
  const xml = xmlSitemap(entradas, urlSitio);
  const urls = urlsDe(xml);

  it('H5-E1: empieza con la declaración XML y un <urlset> del protocolo sitemaps 0.9', () => {
    expect(xml.trimStart().startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('H5-E1: incluye la portada y /blog con URL absoluta', () => {
    expect(urls.has('https://estudio.example/')).toBe(true);
    expect(urls.has('https://estudio.example/blog')).toBe(true);
  });

  it('H5-E1: la portada y /blog llevan la modificación más reciente de las entradas', () => {
    for (const loc of ['https://estudio.example/', 'https://estudio.example/blog']) {
      const lastmod = urls.get(loc);
      expect(lastmod, loc).toMatch(ISO_8601);
      expect(Date.parse(lastmod ?? '')).toBe(Date.parse('2026-10-05T09:30:00+00:00'));
    }
  });

  it('H5-E1: una <url> por entrada, con la ruta según el tipo', () => {
    expect([...urls.keys()]).toEqual([
      'https://estudio.example/',
      'https://estudio.example/blog',
      'https://estudio.example/blog/guia-visual-todos-los-bloques-del-blog',
      'https://estudio.example/blog/categoria/diseno',
      'https://estudio.example/blog/etiqueta/ux',
      'https://estudio.example/blog/autor/eva-editora',
    ]);
  });

  it('H5-E1: cada entrada tiene <lastmod> en ISO 8601 con su fecha de modificación', () => {
    for (const entrada of entradas) {
      const ruta = entrada.tipo === 'articulo' ? `/blog/${entrada.slug}` : `/blog/${entrada.tipo}/${entrada.slug}`;
      const lastmod = urls.get(`${urlSitio}${ruta}`);
      expect(lastmod, ruta).toMatch(ISO_8601);
      expect(Date.parse(lastmod ?? '')).toBe(Date.parse(entrada.actualizadoEn));
    }
  });

  it('H5-E1: todas las <loc> son absolutas y no terminan en barra (salvo la portada)', () => {
    for (const loc of urls.keys()) {
      expect(loc).toMatch(/^https:\/\/estudio\.example\//);
      if (loc !== 'https://estudio.example/') expect(loc.endsWith('/')).toBe(false);
    }
  });

  it('RSEO-005: escapa & y < en las URLs', () => {
    const conCaracteres = xmlSitemap(
      [{ tipo: 'etiqueta', slug: 'a&b<c', actualizadoEn: '2026-10-02T08:00:00+00:00' }],
      urlSitio,
    );
    expect(conCaracteres).toContain('<loc>https://estudio.example/blog/etiqueta/a&amp;b&lt;c</loc>');
    expect(conCaracteres).not.toContain('a&b<c');
  });

  it('sin entradas, sigue incluyendo la portada y /blog', () => {
    const vacio = urlsDe(xmlSitemap([], urlSitio));
    expect([...vacio.keys()]).toEqual(['https://estudio.example/', 'https://estudio.example/blog']);
  });

  it('una URL del sitio con barra final no duplica la barra', () => {
    const conBarra = urlsDe(xmlSitemap(entradas, 'https://estudio.example/'));
    expect(conBarra.has('https://estudio.example/blog')).toBe(true);
    expect([...conBarra.keys()].some((loc) => loc.includes('example//'))).toBe(false);
  });
});
