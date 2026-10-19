// /sitemap.xml (RSEO-005, H5-E1): solo URLs públicas indexables, con su fecha de modificación.
// Se invalida con el tag de la colección ante cualquier aviso.
import { listarParaSitemap } from '@blog/db';
import type { APIRoute } from 'astro';
import { PUBLIC_URL_SITIO } from 'astro:env/server';
import { cacheListado } from '../lib/cache';
import { datos } from '../lib/datos';
import { xmlSitemap } from '../lib/sitemap';

export const GET: APIRoute = async (contexto) => {
  contexto.cache.set(cacheListado());
  const entradas = await listarParaSitemap(datos);
  return new Response(xmlSitemap(entradas, PUBLIC_URL_SITIO), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
