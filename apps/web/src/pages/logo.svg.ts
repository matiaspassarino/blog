// Logo como archivo (/logo.svg) para el JSON-LD de Organization, que necesita una URL real.
// Sale de @blog/ui/identidad: la identidad sigue teniendo una sola fuente (§VII.6).
import { identidad } from '@blog/ui/identidad';
import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(decodeURIComponent(identidad.logo.src.replace(/^data:image\/svg\+xml,/, '')), {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
