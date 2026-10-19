// Invariantes entre la base y @blog/bloques (research D8, T067). Integración contra
// Supabase local, sobre los datos de demo del seed (D18).
import { esquemaImagen, validarContenido } from '@blog/bloques';
import { describe, expect, it } from 'vitest';
import { clienteAnon, sinSupabase } from './pruebas/clientes';

describe.skipIf(sinSupabase)('invariantes de contenido (integración)', () => {
  it('el contenido y la imagen destacada de cada artículo publicado son válidos para Zod', async () => {
    const { data, error } = await clienteAnon().from('articulos').select('slug, contenido, imagen_destacada');
    if (error) throw new Error(error.message);
    expect(data.length).toBeGreaterThan(0);

    const invalidos = data.flatMap((fila) => {
      const contenido = validarContenido(fila.contenido);
      const imagen =
        fila.imagen_destacada === null ? { success: true } : esquemaImagen.safeParse(fila.imagen_destacada);
      return contenido.ok && imagen.success
        ? []
        : [{ slug: fila.slug, errores: contenido.ok ? [] : contenido.errores }];
    });
    expect(invalidos).toEqual([]);
  });
});
