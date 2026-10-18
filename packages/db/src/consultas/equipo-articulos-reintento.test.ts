// Reintento ante slug_duplicado (research D23): unitario, con un cliente simulado.
import { describe, expect, it, vi } from 'vitest';
import type { ClienteBlog } from '../cliente';
import { crearArticulo } from './equipo-articulos';

const colision = {
  data: null,
  error: {
    code: '23505',
    message: 'duplicate key value violates unique constraint "articulos_slug_key"',
    details: 'Key (slug)=(hola) already exists.',
    hint: '',
  },
};

function clienteSimulado(respuestas: unknown[]) {
  const single = vi.fn(async () => respuestas.shift());
  const insert = vi.fn(() => ({ select: () => ({ single }) }));
  const cliente = { from: vi.fn(() => ({ insert })) } as unknown as ClienteBlog;
  return { cliente, insert };
}

describe('crearArticulo: reintento por slug duplicado', () => {
  it('reintenta una vez si dos escrituras calcularon el mismo slug', async () => {
    const creado = { id: 'a1', titulo: 'Hola', slug: 'hola-2' };
    const { cliente, insert } = clienteSimulado([colision, { data: creado, error: null }]);

    await expect(crearArticulo(cliente, { titulo: 'Hola' })).resolves.toEqual(creado);
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('si la colisión se repite, propaga slug_duplicado', async () => {
    const { cliente, insert } = clienteSimulado([colision, colision]);

    await expect(crearArticulo(cliente, { titulo: 'Hola' })).rejects.toMatchObject({ codigo: 'slug_duplicado' });
    expect(insert).toHaveBeenCalledTimes(2);
  });
});
