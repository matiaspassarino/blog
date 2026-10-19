// /rss.xml (RSEO-006, H5-E2): los 20 publicados más recientes con enlaces absolutos.
import { listarArticulosPublicados } from '@blog/db';
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { PUBLIC_URL_SITIO } from 'astro:env/server';
import { landing } from '../contenido/landing';
import { cacheListado } from '../lib/cache';
import { datos } from '../lib/datos';

const ARTICULOS_EN_EL_FEED = 20;

export const GET: APIRoute = async (contexto) => {
  contexto.cache.set(cacheListado());
  const { items } = await listarArticulosPublicados(datos, { porPagina: ARTICULOS_EN_EL_FEED });
  return rss({
    title: landing.sitio.nombre,
    description: landing.blog.descripcion,
    site: PUBLIC_URL_SITIO,
    customData: '<language>es-ar</language>',
    items: items.map((articulo) => ({
      title: articulo.titulo,
      link: new URL(`/blog/${articulo.slug}`, PUBLIC_URL_SITIO).href,
      description: articulo.extracto ?? undefined,
      pubDate: new Date(articulo.publicado_en),
      categories: articulo.categoria ? [articulo.categoria.nombre] : undefined,
    })),
  });
};
