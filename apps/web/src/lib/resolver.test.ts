// T023 (spec 002): resolución única "entidad → 301 → 404" (contracts/rutas.md, "Reglas
// transversales"; research D13). La usan el artículo y las páginas de taxonomía.
import { ErrorDominio } from '@blog/db';
import { describe, expect, it, vi } from 'vitest';
import { resolverEntidad } from './resolver';

const entidad = { id: 'a1', slug: 'mi-articulo' };

describe('resolverEntidad', () => {
  it('RF-006: si buscar encuentra la entidad, devuelve { tipo: entidad, valor }', async () => {
    const buscar = vi.fn(async () => entidad);
    const redireccion = vi.fn(async () => 'otro-slug');

    const resultado = await resolverEntidad({ buscar, redireccion, prefijo: '/blog/' });

    expect(resultado).toEqual({ tipo: 'entidad', valor: entidad });
  });

  it('no llama a redireccion cuando encuentra la entidad', async () => {
    const redireccion = vi.fn(async () => 'otro-slug');

    await resolverEntidad({ buscar: async () => entidad, redireccion, prefijo: '/blog/' });

    expect(redireccion).not.toHaveBeenCalled();
  });

  it('RF-021: si no la encuentra y hay redirección, devuelve el destino con el prefijo y el slug nuevo', async () => {
    const resultado = await resolverEntidad({
      buscar: async () => null,
      redireccion: async () => 'slug-nuevo',
      prefijo: '/blog/categoria/',
    });

    expect(resultado).toEqual({ tipo: 'redireccion', destino: '/blog/categoria/slug-nuevo' });
  });

  it('RF-006: si no la encuentra y no hay redirección, devuelve { tipo: no_encontrado }', async () => {
    const redireccion = vi.fn(async () => null);

    const resultado = await resolverEntidad({ buscar: async () => null, redireccion, prefijo: '/blog/' });

    expect(resultado).toEqual({ tipo: 'no_encontrado' });
    expect(redireccion).toHaveBeenCalledTimes(1);
  });

  it('D13 (caso borde "la base no responde"): propaga un ErrorDominio distinto de no_encontrado, sin convertirlo en 404', async () => {
    const falla = new ErrorDominio('desconocido', 'La base no responde');
    const redireccion = vi.fn(async () => null);

    await expect(
      resolverEntidad({
        buscar: async () => {
          throw falla;
        },
        redireccion,
        prefijo: '/blog/',
      }),
    ).rejects.toBe(falla);
    expect(redireccion).not.toHaveBeenCalled();
  });

  it('D13: también propaga un error de la redirección', async () => {
    const falla = new ErrorDominio('desconocido', 'La base no responde');

    await expect(
      resolverEntidad({
        buscar: async () => null,
        redireccion: async () => {
          throw falla;
        },
        prefijo: '/blog/',
      }),
    ).rejects.toBe(falla);
  });
});
