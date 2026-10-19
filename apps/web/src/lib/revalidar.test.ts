// T076 (spec 002): recepción del aviso de cambio en POST /api/revalidar (contracts/cache.md,
// "POST /api/revalidar"; research D1-D4; H4-E1, H4-E2, H4-E3).
// Vive en src/lib y no en src/pages, donde Astro lo tomaría como ruta (análisis I2).
//
// Firma elegida (la implementa T081):
//   procesarAviso({ request, cache, secreto, ahora }): Promise<Response>
//   - request: el Request recibido (lee X-Blog-Marca-Tiempo, X-Blog-Firma y el texto crudo).
//   - cache: Pick<CacheLike, 'invalidate'> (en la página, context.cache).
//   - secreto: SECRETO_REVALIDACION.
//   - ahora: milisegundos epoch (Date.now()), igual que verificarAviso.
// Respuestas JSON; todas llevan Cache-Control: no-store.
import { TAG_ARTICULOS, tagArticulo, tagCategoria } from '@blog/db';
import { firmarAviso } from './pruebas/firmar-aviso';
import { describe, expect, it, vi } from 'vitest';
import { procesarAviso } from './revalidar';

const SECRETO = 'secreto-de-prueba';
const MARCA = 1_792_411_200; // 2026-10-19T12:00:00Z en segundos
const AHORA = MARCA * 1000;
const ID = '5b0c0000-0000-4000-8000-000000000001';
const CUERPO_VALIDO = JSON.stringify({
  tipo: 'articulo',
  id: ID,
  slugs: ['b', 'a'],
  ocurrido_en: '2026-10-19T12:00:00Z',
});
const URL_REVALIDAR = 'http://localhost/api/revalidar';

const firmar = (cuerpo: string, marca: string | number = MARCA, secreto = SECRETO) =>
  firmarAviso(cuerpo, marca, secreto);

/** Un POST como el que emite notificar_cambio_publico. */
function avisoFirmado(cuerpo = CUERPO_VALIDO, encabezados: Record<string, string> = {}) {
  return new Request(URL_REVALIDAR, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Blog-Marca-Tiempo': String(MARCA),
      'X-Blog-Firma': firmar(cuerpo),
      ...encabezados,
    },
    body: cuerpo,
  });
}

function cacheEspiada(invalidate = vi.fn().mockResolvedValue(undefined)) {
  return { invalidate };
}

async function procesar(request: Request, cache = cacheEspiada(), ahora = AHORA) {
  const respuesta = await procesarAviso({ request, cache, secreto: SECRETO, ahora });
  return { respuesta, cache };
}

describe('procesarAviso', () => {
  describe('método', () => {
    it.each(['GET', 'PUT', 'DELETE'])('%s responde 405 sin invalidar nada', async (metodo) => {
      const { respuesta, cache } = await procesar(new Request(URL_REVALIDAR, { method: metodo }));
      expect(respuesta.status).toBe(405);
      expect(cache.invalidate).not.toHaveBeenCalled();
    });
  });

  describe('firma (401)', () => {
    async function esperarNoAutorizado(request: Request, ahora = AHORA) {
      const { respuesta, cache } = await procesar(request, cacheEspiada(), ahora);
      expect(respuesta.status).toBe(401);
      expect(await respuesta.json()).toEqual({ error: 'no_autorizado' });
      expect(cache.invalidate).not.toHaveBeenCalled();
    }

    it('H4-E2: firma incorrecta → 401 {"error":"no_autorizado"} sin llamar a invalidate', async () => {
      await esperarNoAutorizado(avisoFirmado(CUERPO_VALIDO, { 'X-Blog-Firma': firmar(CUERPO_VALIDO, MARCA, 'otro') }));
    });

    it('H4-E2: sin X-Blog-Firma → 401', async () => {
      const request = avisoFirmado();
      request.headers.delete('X-Blog-Firma');
      await esperarNoAutorizado(request);
    });

    it('H4-E2: sin X-Blog-Marca-Tiempo → 401', async () => {
      const request = avisoFirmado();
      request.headers.delete('X-Blog-Marca-Tiempo');
      await esperarNoAutorizado(request);
    });

    it('H4-E2: marca de tiempo de más de 5 minutos → 401', async () => {
      await esperarNoAutorizado(avisoFirmado(), AHORA + 301_000);
    });

    it('la firma se verifica primero: un cuerpo no JSON mal firmado da 401, no 400', async () => {
      await esperarNoAutorizado(avisoFirmado('no es json', { 'X-Blog-Firma': firmar('otro cuerpo') }));
    });

    it('la firma se verifica primero: un cuerpo fuera del esquema mal firmado da 401, no 400', async () => {
      const fueraDelEsquema = JSON.stringify({ tipo: 'pagina' });
      await esperarNoAutorizado(avisoFirmado(fueraDelEsquema, { 'X-Blog-Firma': firmar(CUERPO_VALIDO) }));
    });
  });

  describe('cuerpo (400)', () => {
    it.each([
      ['no es JSON', 'no es json'],
      ['está vacío', ''],
      ['es JSON fuera del esquema', JSON.stringify({ tipo: 'pagina', id: ID, slugs: ['b'], ocurrido_en: 'x' })],
      [
        'tiene slugs vacíos',
        JSON.stringify({ tipo: 'articulo', id: ID, slugs: [], ocurrido_en: '2026-10-19T12:00:00Z' }),
      ],
    ])(
      'firma válida y un cuerpo que %s → 400 {"error":"peticion_invalida"} sin llamar a invalidate',
      async (_, cuerpo) => {
        const { respuesta, cache } = await procesar(avisoFirmado(cuerpo));
        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({ error: 'peticion_invalida' });
        expect(cache.invalidate).not.toHaveBeenCalled();
      },
    );
  });

  describe('aviso aceptado (200)', () => {
    it('H4-E1: responde 200 con { tags, rutas } de invalidacionesDe', async () => {
      const { respuesta } = await procesar(avisoFirmado());
      expect(respuesta.status).toBe(200);
      expect(await respuesta.json()).toEqual({
        tags: [TAG_ARTICULOS, tagArticulo(ID)],
        rutas: ['/blog/b', '/blog/a'],
      });
    });

    it('H4-E1: invalida los tags y cada ruta en el proveedor de caché', async () => {
      const { cache } = await procesar(avisoFirmado());
      expect(cache.invalidate).toHaveBeenCalledWith({ tags: [TAG_ARTICULOS, tagArticulo(ID)] });
      expect(cache.invalidate).toHaveBeenCalledWith({ path: '/blog/b' });
      expect(cache.invalidate).toHaveBeenCalledWith({ path: '/blog/a' });
      expect(cache.invalidate).toHaveBeenCalledTimes(3);
    });

    it('H4-E1: espera a que termine la invalidación antes de responder', async () => {
      let terminadas = 0;
      const cache = cacheEspiada(
        vi.fn(async () => {
          await new Promise((resolver) => setTimeout(resolver, 5));
          terminadas += 1;
        }),
      );
      await procesar(avisoFirmado(), cache);
      expect(terminadas).toBe(3);
    });

    it('H4-E6: un aviso de categoría invalida su tag y sus rutas', async () => {
      const cuerpo = JSON.stringify({
        tipo: 'categoria',
        id: ID,
        slugs: ['marketing-digital', 'marketing'],
        ocurrido_en: '2026-10-19T12:00:00Z',
      });
      const { respuesta, cache } = await procesar(avisoFirmado(cuerpo));
      expect(respuesta.status).toBe(200);
      expect(cache.invalidate).toHaveBeenCalledWith({ tags: [TAG_ARTICULOS, tagCategoria(ID)] });
      expect(cache.invalidate).toHaveBeenCalledWith({ path: '/blog/categoria/marketing' });
    });

    it('acepta el cuerpo tal como lo serializa la base (jsonb::text, con espacios y campos extra)', async () => {
      const cuerpo = `{"id": "${ID}", "tipo": "articulo", "slugs": ["b"], "etiquetas": ["seo"], "categorias": ["diseno"], "ocurrido_en": "2026-10-19T12:00:00.123456+00:00"}`;
      const { respuesta } = await procesar(avisoFirmado(cuerpo));
      expect(respuesta.status).toBe(200);
    });

    it('H4-E3: el mismo aviso dos veces da respuestas idénticas', async () => {
      const primera = await procesar(avisoFirmado());
      const segunda = await procesar(avisoFirmado());
      expect(segunda.respuesta.status).toBe(primera.respuesta.status);
      expect(await segunda.respuesta.json()).toEqual(await primera.respuesta.json());
      expect(segunda.cache.invalidate.mock.calls).toEqual(primera.cache.invalidate.mock.calls);
    });
  });

  describe('falla del proveedor (502)', () => {
    it('si invalidate falla → 502 {"error":"invalidacion_fallida"}', async () => {
      const cache = cacheEspiada(vi.fn().mockRejectedValue(new Error('el proveedor no responde')));
      const { respuesta } = await procesar(avisoFirmado(), cache);
      expect(respuesta.status).toBe(502);
      expect(await respuesta.json()).toEqual({ error: 'invalidacion_fallida' });
    });
  });

  describe('sin caché', () => {
    it.each([
      ['200', () => avisoFirmado()],
      ['401', () => avisoFirmado(CUERPO_VALIDO, { 'X-Blog-Firma': 'sha256=00' })],
      ['400', () => avisoFirmado('no es json')],
    ])('la respuesta %s no se cachea (Cache-Control: no-store) y es JSON', async (_, crearRequest) => {
      const { respuesta } = await procesar(crearRequest());
      expect(respuesta.headers.get('Cache-Control')).toContain('no-store');
      expect(respuesta.headers.get('Content-Type')).toContain('application/json');
    });
  });
});
