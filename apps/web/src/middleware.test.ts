// T077 (spec 002): redirección 301 a minúsculas (RF-022, research D12).
// El middleware es `onRequest` (defineMiddleware de astro:middleware) en src/middleware.ts.
// Se prueba con un contexto mínimo simulado: url, request y redirect.
// T086 (spec 002): X-Robots-Tag fuera de producción (RSEO-007, H5-E6, research D12).
// Decisión: el middleware lee `process.env.VERCEL_ENV` en cada request (no al importar el
// módulo), así el test lo cambia con vi.stubEnv. Vercel define VERCEL_ENV en tiempo de
// ejecución ('production' | 'preview' | 'development'); en local no existe.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from './middleware';

type Contexto = Parameters<typeof onRequest>[0];
type Siguiente = Parameters<typeof onRequest>[1];

function contextoDe(direccion: string) {
  const url = new URL(direccion);
  const redirect = vi.fn(
    (destino: string, estado = 302) => new Response(null, { status: estado, headers: { Location: destino } }),
  );
  const contexto = { url, request: new Request(url), redirect } as unknown as Contexto;
  return { contexto, redirect };
}

async function ejecutar(direccion: string) {
  const { contexto } = contextoDe(direccion);
  const siguiente = vi.fn(async () => new Response('ok')) as unknown as Siguiente & ReturnType<typeof vi.fn>;
  const respuesta = (await onRequest(contexto, siguiente)) as Response;
  return { respuesta, siguiente };
}

/** El destino de la redirección, normalizado a ruta + query. */
function destinoDe(respuesta: Response) {
  const ubicacion = respuesta.headers.get('Location') ?? '';
  const url = new URL(ubicacion, 'http://localhost:4321');
  return url.pathname + url.search;
}

describe('middleware: URLs en minúsculas (RF-022)', () => {
  it('RF-022: /Blog/Mi-Articulo?x=1 responde 301 a /blog/mi-articulo?x=1', async () => {
    const { respuesta, siguiente } = await ejecutar('http://localhost:4321/Blog/Mi-Articulo?x=1');
    expect(respuesta.status).toBe(301);
    expect(destinoDe(respuesta)).toBe('/blog/mi-articulo?x=1');
    expect(siguiente).not.toHaveBeenCalled();
  });

  it('RF-022: /Blog responde 301 a /blog', async () => {
    const { respuesta } = await ejecutar('http://localhost:4321/Blog');
    expect(respuesta.status).toBe(301);
    expect(destinoDe(respuesta)).toBe('/blog');
  });

  it('RF-022: conserva la query tal cual, sin pasarla a minúsculas', async () => {
    const { respuesta } = await ejecutar('http://localhost:4321/BLOG/Categoria/Diseno?Orden=Desc&q=ABC');
    expect(respuesta.status).toBe(301);
    expect(destinoDe(respuesta)).toBe('/blog/categoria/diseno?Orden=Desc&q=ABC');
  });

  it('RF-022: una ruta en minúsculas pasa sin cambios', async () => {
    const { respuesta, siguiente } = await ejecutar('http://localhost:4321/blog/mi-articulo?x=1');
    expect(siguiente).toHaveBeenCalledOnce();
    expect(respuesta.status).toBe(200);
    expect(await respuesta.text()).toBe('ok');
  });

  it('RF-022: una ruta en minúsculas con mayúsculas solo en la query pasa sin cambios', async () => {
    const { respuesta, siguiente } = await ejecutar('http://localhost:4321/blog?Q=Hola');
    expect(siguiente).toHaveBeenCalledOnce();
    expect(respuesta.status).toBe(200);
  });

  it('RF-022: la portada pasa sin cambios', async () => {
    const { siguiente } = await ejecutar('http://localhost:4321/');
    expect(siguiente).toHaveBeenCalledOnce();
  });
});

describe('middleware: noindex fuera de producción (RSEO-007, H5-E6)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('H5-E6: con VERCEL_ENV=preview, la respuesta lleva X-Robots-Tag: noindex', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    const { respuesta, siguiente } = await ejecutar('http://localhost:4321/blog');
    expect(siguiente).toHaveBeenCalledOnce();
    expect(respuesta.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(await respuesta.text()).toBe('ok');
  });

  it('H5-E6: con VERCEL_ENV=development, la respuesta lleva X-Robots-Tag: noindex', async () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    const { respuesta } = await ejecutar('http://localhost:4321/');
    expect(respuesta.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('H5-E6: sin VERCEL_ENV (entorno local), la respuesta lleva X-Robots-Tag: noindex', async () => {
    vi.stubEnv('VERCEL_ENV', undefined);
    const { respuesta } = await ejecutar('http://localhost:4321/blog/mi-articulo');
    expect(respuesta.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('H5-E6: con VERCEL_ENV=production, la respuesta no lleva X-Robots-Tag', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const { respuesta, siguiente } = await ejecutar('http://localhost:4321/blog');
    expect(siguiente).toHaveBeenCalledOnce();
    expect(respuesta.headers.has('X-Robots-Tag')).toBe(false);
    expect(respuesta.status).toBe(200);
  });

  it('H5-E6: lee VERCEL_ENV en cada request, no al cargar el módulo', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    expect((await ejecutar('http://localhost:4321/blog')).respuesta.headers.has('X-Robots-Tag')).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect((await ejecutar('http://localhost:4321/blog')).respuesta.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it('RF-022: la redirección 301 a minúsculas se mantiene en cualquier entorno', async () => {
    for (const entorno of ['preview', 'production']) {
      vi.stubEnv('VERCEL_ENV', entorno);
      const { respuesta, siguiente } = await ejecutar('http://localhost:4321/Blog/Mi-Articulo?x=1');
      expect(respuesta.status, entorno).toBe(301);
      expect(destinoDe(respuesta), entorno).toBe('/blog/mi-articulo?x=1');
      expect(siguiente).not.toHaveBeenCalled();
    }
  });
});
