// Middleware del sitio (specs/002-sitio-publico/research.md D12): URLs canónicas en minúsculas
// con un 301 que conserva la query (RF-022). La barra final la resuelve trailingSlash: 'never'.
import { defineMiddleware } from 'astro:middleware';

// Los assets generados (/_astro/…) llevan hashes con mayúsculas: no se tocan.
const EXCLUIDAS = /^\/_(astro|image|server-islands)\//;

export const onRequest = defineMiddleware((contexto, siguiente) => {
  const { pathname, search } = contexto.url;
  if (pathname !== pathname.toLowerCase() && !EXCLUIDAS.test(pathname)) {
    return contexto.redirect(`${pathname.toLowerCase()}${search}`, 301);
  }
  return siguiente();
});
