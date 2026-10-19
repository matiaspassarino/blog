// POST /api/revalidar: aviso firmado de la base → invalidación de tags y rutas (contracts/cache.md).
// Sin caché y sin prerender. La lógica está en src/lib/revalidar.ts.
import type { APIRoute } from 'astro';
import { SECRETO_REVALIDACION } from 'astro:env/server';
import { procesarAviso } from '../../lib/revalidar';

export const prerender = false;

export const ALL: APIRoute = (context) => {
  context.cache.set(false);
  return procesarAviso({
    request: context.request,
    cache: context.cache,
    secreto: SECRETO_REVALIDACION,
    ahora: Date.now(),
  });
};
