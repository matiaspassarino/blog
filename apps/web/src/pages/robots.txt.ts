// /robots.txt (RSEO-007, H5-E5): permite lo público, excluye las rutas técnicas y declara el
// sitemap. Fuera de producción el noindex lo pone el middleware (X-Robots-Tag).
import type { APIRoute } from 'astro';
import { PUBLIC_URL_SITIO } from 'astro:env/server';

export const prerender = true;

export const GET: APIRoute = () => {
  const sitemap = new URL('/sitemap.xml', PUBLIC_URL_SITIO).href;
  return new Response(['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${sitemap}`, ''].join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
