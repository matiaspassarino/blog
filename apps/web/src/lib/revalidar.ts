// Recepción del aviso de cambio (specs/002-sitio-publico/contracts/cache.md, "POST /api/revalidar").
// Orden: firma (401) → contrato (400) → invalidación (200 o 502). La página
// src/pages/api/revalidar.ts es una capa fina sobre esta función.
import { invalidacionesDe, leerCambioPublico, type CambioPublico } from '@blog/db';
import type { InvalidateOptions } from 'astro';
import { verificarAviso } from './aviso';

type CacheInvalidable = { invalidate(opciones: InvalidateOptions): Promise<void> };

type Opciones = { request: Request; cache: CacheInvalidable; secreto: string; ahora: number };

const responder = (estado: number, cuerpo: object) =>
  new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export async function procesarAviso({ request, cache, secreto, ahora }: Opciones): Promise<Response> {
  if (request.method !== 'POST') return responder(405, { error: 'metodo_no_permitido' });

  const cuerpo = await request.text();
  const firmado = verificarAviso({
    cuerpo,
    marca: request.headers.get('X-Blog-Marca-Tiempo'),
    firma: request.headers.get('X-Blog-Firma'),
    secreto,
    ahora,
  });
  if (!firmado) return responder(401, { error: 'no_autorizado' });

  let cambio: CambioPublico;
  try {
    cambio = leerCambioPublico(JSON.parse(cuerpo));
  } catch {
    return responder(400, { error: 'peticion_invalida' });
  }

  // Idempotente: invalidar dos veces es lo mismo que una (H4-E3).
  const { tags, rutas } = invalidacionesDe(cambio);
  try {
    await cache.invalidate({ tags });
    await Promise.all(rutas.map((path) => cache.invalidate({ path })));
  } catch {
    return responder(502, { error: 'invalidacion_fallida' });
  }
  return responder(200, { tags, rutas });
}
