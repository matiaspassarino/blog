// Middleware del sitio (specs/002-sitio-publico/research.md D12):
// - URLs canónicas en minúsculas con un 301 que conserva la query (RF-022). La barra final la
//   resuelve trailingSlash: 'never'.
// - Fuera de producción, X-Robots-Tag: noindex (RSEO-007, H5-E6). VERCEL_ENV se lee en cada
//   request: lo define Vercel en runtime ('production', 'preview' o 'development').
import { defineMiddleware } from 'astro:middleware';

// Los assets generados (/_astro/…) llevan hashes con mayúsculas: no se tocan.
const EXCLUIDAS = /^\/_(astro|image|server-islands)\//;

export const onRequest = defineMiddleware(async (contexto, siguiente) => {
  const { pathname, search } = contexto.url;
  if (pathname !== pathname.toLowerCase() && !EXCLUIDAS.test(pathname)) {
    return contexto.redirect(`${pathname.toLowerCase()}${search}`, 301);
  }
  const respuesta = await siguiente();
  if (process.env.VERCEL_ENV !== 'production') respuesta.headers.set('X-Robots-Tag', 'noindex');
  return respuesta;
});
