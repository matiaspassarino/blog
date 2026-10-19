// T078: redirecciones permanentes a la URL vigente (spec 002, H4-E4, H4-E5; RF-021, RF-022, CE-005).
// Datos del seed (supabase/seed.sql, T012):
// - El artículo renombrado dos veces: `escribir-para-la-web-claridad-antes-que-todo` →
//   `escribir-para-la-web` → `claridad-al-escribir-para-la-web` (vigente).
// - Categoría `marketing` → `marketing-digital`; etiqueta `redes-sociales` → `redes`.
// Se pide cada ruta sin seguir redirecciones (maxRedirects: 0) para comprobar el código y que el
// destino es la URL vigente en un solo salto.
// La barra final la redirige Vercel con un 308, no `astro dev`: se verifica en el preview (T099).
import { expect, test, type APIRequestContext } from '@playwright/test';

const ARTICULO_VIGENTE = '/blog/claridad-al-escribir-para-la-web';

async function esperar301(request: APIRequestContext, ruta: string, destino: string) {
  const respuesta = await request.get(ruta, { maxRedirects: 0 });
  expect(respuesta.status(), `${ruta} debería responder 301`).toBe(301);
  const ubicacion = respuesta.headers().location ?? '';
  expect(new URL(ubicacion, 'http://localhost:4321').pathname, `${ruta} debería redirigir a ${destino}`).toBe(destino);

  // Un solo salto: el destino responde 200, no otra redirección.
  const final = await request.get(destino, { maxRedirects: 0 });
  expect(final.status(), `${destino} debería responder 200 sin redirigir`).toBe(200);
}

test.describe('Redirecciones de slugs anteriores (RF-021)', () => {
  test('H4-E5: el slug original del artículo renombrado dos veces redirige con un 301 directo a la URL vigente', async ({
    request,
  }) => {
    await esperar301(request, '/blog/escribir-para-la-web-claridad-antes-que-todo', ARTICULO_VIGENTE);
  });

  test('H4-E4: el slug intermedio del artículo redirige con un 301 a la URL vigente', async ({ request }) => {
    await esperar301(request, '/blog/escribir-para-la-web', ARTICULO_VIGENTE);
  });

  test('H4-E4: el slug anterior de la categoría redirige con un 301 a la categoría vigente', async ({ request }) => {
    await esperar301(request, '/blog/categoria/marketing', '/blog/categoria/marketing-digital');
  });

  test('H4-E4: el slug anterior de la etiqueta redirige con un 301 a la etiqueta vigente', async ({ request }) => {
    await esperar301(request, '/blog/etiqueta/redes-sociales', '/blog/etiqueta/redes');
  });
});

test.describe('URLs canónicas en minúsculas (RF-022)', () => {
  test('RF-022: /Blog redirige con un 301 a /blog', async ({ request }) => {
    await esperar301(request, '/Blog', '/blog');
  });
});
