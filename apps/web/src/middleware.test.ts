// T077 (spec 002): redirección 301 a minúsculas (RF-022, research D12).
// El middleware es `onRequest` (defineMiddleware de astro:middleware) en src/middleware.ts.
// Se prueba con un contexto mínimo simulado: url, request y redirect.
import { describe, expect, it, vi } from 'vitest';
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
