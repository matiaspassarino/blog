// Sitemap propio (specs/002-sitio-publico/research.md D14, RSEO-005): las rutas son dinámicas y
// cambian con cada aviso, así que no sirve la integración de build.
import type { EntradaSitemap } from '@blog/db';

const PREFIJO = {
  articulo: '/blog/',
  categoria: '/blog/categoria/',
  etiqueta: '/blog/etiqueta/',
  autor: '/blog/autor/',
};

const escaparXml = (texto: string) =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const url = (loc: string, lastmod?: string) =>
  `  <url><loc>${escaparXml(loc)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''}</url>`;

/** Portada, /blog y una URL por entrada pública. La portada y /blog llevan la fecha más reciente. */
export function xmlSitemap(entradas: EntradaSitemap[], urlSitio: string): string {
  const base = urlSitio.replace(/\/+$/, '');
  const masReciente = entradas.reduce<string | undefined>(
    (max, e) => (!max || Date.parse(e.actualizadoEn) > Date.parse(max) ? e.actualizadoEn : max),
    undefined,
  );
  const lineas = [
    url(`${base}/`, masReciente),
    url(`${base}/blog`, masReciente),
    ...entradas.map((e) => url(`${base}${PREFIJO[e.tipo]}${e.slug}`, e.actualizadoEn)),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lineas.join('\n')}\n</urlset>\n`;
}
