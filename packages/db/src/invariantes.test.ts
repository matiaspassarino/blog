// Invariantes entre la base y @blog/bloques (research D8, T067). Integración contra
// Supabase local, sobre los datos de demo del seed (D18).
// privado no está expuesto por PostgREST: tipos_bloque() se lee como postgres con
// `supabase db query --local`, el mismo CLI que usa el globalSetup (pruebas/entorno.ts).
import { execFileSync } from 'node:child_process';
import { esquemaImagen, TIPOS_BLOQUE, validarContenido } from '@blog/bloques';
import { describe, expect, it } from 'vitest';
import { clienteAnon, sinSupabase } from './pruebas/clientes';

/**
 * Ejecuta una consulta de solo lectura en la base local y devuelve sus filas. `--agent no`
 * fija el formato (un arreglo de filas): si el CLI detecta un agente, envuelve el resultado.
 */
function consultarComoPostgres<T>(sql: string): T[] {
  const salida = execFileSync('supabase', ['db', 'query', '--local', sql, '--output-format', 'json', '--agent', 'no'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(salida) as T[];
}

describe.skipIf(sinSupabase)('invariantes de contenido (integración)', () => {
  it('D8: privado.tipos_bloque() tiene los mismos tipos que TIPOS_BLOQUE', () => {
    const [fila] = consultarComoPostgres<{ tipos: string[] }>('select to_jsonb(privado.tipos_bloque()) as tipos');

    expect(fila?.tipos.toSorted()).toEqual([...TIPOS_BLOQUE].sort());
  });

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
