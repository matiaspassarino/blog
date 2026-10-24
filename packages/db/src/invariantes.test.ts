// Invariantes entre la base y @blog/bloques (research D8, T067). Integración contra
// Supabase local, sobre los datos de demo del seed (D18).
// privado no está expuesto por PostgREST: tipos_elemento() se lee como postgres con
// `supabase db query --local`, el mismo CLI que usa el globalSetup (pruebas/entorno.ts).
//
// T098 (spec 005, ampliación; research D31 C5): `TIPOS_ELEMENTO` (T101) frente a `privado.tipos_elemento()` (T105) y
// cada contenido publicado válido para `validarDocumento` (T102). La base ya acepta la forma de la tabla (data-model:
// la base trabaja sobre la forma, no sobre el esquema completo) y el esquema de TypeScript la suma en T138: hasta
// entonces `table` es el único tipo de más en la base (al hacer T138, `TIPOS_SOLO_EN_LA_BASE` queda vacío).
import { execFileSync } from 'node:child_process';
import { esquemaImagen, TIPOS_ELEMENTO, validarDocumento } from '@blog/bloques';
import { describe, expect, it } from 'vitest';
import { clienteAnon, sinSupabase } from './pruebas/clientes';

const TIPOS_SOLO_EN_LA_BASE: string[] = [];

/**
 * El artículo del seed con tablas, alineación y formatos nuevos (T106, CE-008) usa lo que el esquema de TypeScript
 * suma en las Fases 12 (T130) y 13 (T138). Al cerrar T138, vacío.
 */
const LO_DE_FASES_POSTERIORES: string[] = [];
const usaLoDeFasesPosteriores = (contenido: unknown) =>
  LO_DE_FASES_POSTERIORES.some((marcador) => JSON.stringify(contenido).includes(marcador));

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
  it('D8: privado.tipos_elemento() tiene los tipos de TIPOS_ELEMENTO (más la tabla hasta T138)', () => {
    const [fila] = consultarComoPostgres<{ tipos: string[] }>('select to_jsonb(privado.tipos_elemento()) as tipos');

    expect(fila?.tipos.toSorted()).toEqual([...TIPOS_ELEMENTO, ...TIPOS_SOLO_EN_LA_BASE].sort());
  });

  it('el contenido y la imagen destacada de cada artículo publicado son válidos (validarDocumento y Zod)', async () => {
    const { data, error } = await clienteAnon().from('articulos').select('slug, contenido, imagen_destacada');
    if (error) throw new Error(error.message);
    expect(data.length).toBeGreaterThan(0);

    const invalidos = data
      .filter((fila) => !usaLoDeFasesPosteriores(fila.contenido))
      .flatMap((fila) => {
        const errores = validarDocumento(fila.contenido, { publicar: true });
        const imagen =
          fila.imagen_destacada === null ? { success: true } : esquemaImagen.safeParse(fila.imagen_destacada);
        return errores.length === 0 && imagen.success ? [] : [{ slug: fila.slug, errores }];
      });
    expect(invalidos).toEqual([]);
  });
});
