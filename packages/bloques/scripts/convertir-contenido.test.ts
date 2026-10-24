// T113 (spec 005, Historia 5; RF-023, RF-030; data-model "Conversión de los artículos existentes"; research D25,
// D26 y D31 A3, C8 y C9): el script de un solo uso que convierte los artículos exportados al documento y genera el
// SQL de la conversión. Esta prueba no toca la base ni el disco (salvo leer la *fixture*).
//
// FASE ROJA: `./convertir-contenido` no existe. API que se prueba (T120), exportada del script y separada de la
// lectura de argumentos y archivos (que va en `principal()` y solo corre con `import.meta.main`):
//
//   type ArticuloExportado = { id: string; version: number; contenido: unknown };
//   type ResultadoConversion =
//     | { ok: true; sql: string; convertidos: number; conErrores: { id: string; errores: ErrorElemento[] }[] }
//     | { ok: false; perdidas: { id: string; motivo: string }[] };
//   function convertirArticulos(entrada: ArticuloExportado[]): ResultadoConversion;
//
// - Solo se convierten los `contenido` que son un arreglo (formato anterior). Uno que ya es un documento
//   (`type: 'doc'` con `content` arreglo) no se toca ni aparece en el SQL. Cualquier otra forma es una pérdida.
// - Pérdida (bloquea, todo o nada): el resultado no tiene la forma mínima (`type`, `content`, tipos conocidos y
//   `attrs.id` texto), la ida y vuelta (`documentoABloques`) no da `reducirTramos(contenido)` o `visibleDeBloques`
//   no es igual a `visibleDeDocumento`. Con una sola, `ok: false`, sin `sql`, y se listan **todas** con el id y el
//   motivo (un error al convertir también es una pérdida, con su mensaje).
// - Validez (informa): `validarDocumento` (estricto). Un artículo con errores se convierte igual y va a `conErrores`.
// - `sql` es **un único bloque** `do $$ … $$;` sin `begin`/`commit` con los pasos del data-model, en este orden:
//   desactivar `a30_controlar_version`, `a90_actualizado_en` y `z90_notificar_cambio`; `update public.articulos a
//   set contenido = v.contenido from (values …) as v(id, version, contenido) where a.id = v.id and a.version =
//   v.version`; `get diagnostics … = row_count` y `raise exception` si no es la cantidad de convertidos; `raise
//   exception` si queda algún `jsonb_typeof(contenido) = 'array'`; `validate constraint` de
//   `articulos_contenido_check` y `articulos_requisitos_publicacion`; volver a activar los tres triggers.
//   Cada fila de `values` es `('<id>'::uuid, <version>, '<json>'::jsonb)`, con `<json>` = `JSON.stringify` del
//   documento con `'` duplicada y `$` escrito `\u0024` (así ningún texto cierra el `$$`).
//
// *Fixture* para pgTAP (T114): `supabase/tests/fixtures/conversion-corpus.psql` (extensión `.psql`: `supabase test
// db` no la corre como prueba) con el SQL generado para ENTRADA_FIXTURE, envuelto para que psql lo guarde en la
// variable `sql_conversion`:
//   -- comentarios
//   select $fixture$
//   <sql>
//   $fixture$ as sql_conversion \gset
// Se regenera con `ACTUALIZAR_FIXTURE=1 pnpm --filter @blog/bloques exec vitest run scripts/convertir-contenido.test.ts`
// (T120); sin la variable, la prueba compara y falla si el SQL se desvió.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bloquesADocumento } from '../src/conversion-anterior/conversion';
import type { Contenido } from '../src/conversion-anterior/esquema-bloques';
import { CORPUS_CONTENIDOS } from '../src/pruebas/corpus-contenido';
import { convertirArticulos, type ArticuloExportado } from './convertir-contenido';

const RUTA_FIXTURE = fileURLToPath(new URL('../../../supabase/tests/fixtures/conversion-corpus.psql', import.meta.url));

const ID_BORRADOR = 'c0a00000-0000-4000-8000-000000000001';
const ID_PUBLICADO = 'c0a00000-0000-4000-8000-000000000002';
const ID_DOCUMENTO = 'c0a00000-0000-4000-8000-000000000003';
const ID_BLOQUE = 'b0a00000-0000-4000-8000-000000000001';

const delCorpus = (nombre: string): Contenido => {
  const encontrado = CORPUS_CONTENIDOS.find((caso) => caso.nombre === nombre);
  if (!encontrado) throw new Error(`Falta "${nombre}" en el corpus`);
  return encontrado.contenido;
};

/**
 * La entrada de la *fixture* de pgTAP: un borrador y un publicado en el formato anterior, con estos ids y la
 * versión 1. `conversion.test.sql` inserta exactamente estos artículos.
 */
const ENTRADA_FIXTURE: ArticuloExportado[] = [
  { id: ID_BORRADOR, version: 1, contenido: delCorpus('párrafos con dos, tres y cuatro líneas en blanco') },
  { id: ID_PUBLICADO, version: 1, contenido: delCorpus('artículo del seed: JavaScript moderno') },
];

/** Todo el corpus (incluye el contenido anterior de cada artículo del seed) con ids de artículo deterministas. */
const ENTRADA_CORPUS: ArticuloExportado[] = CORPUS_CONTENIDOS.map(({ contenido }, i) => ({
  id: `c0b00000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  version: i + 1,
  contenido,
}));

const DOCUMENTO_VIGENTE = {
  type: 'doc',
  content: [{ type: 'paragraph', attrs: { id: ID_BLOQUE }, content: [{ type: 'text', text: 'Ya convertido' }] }],
};

function convertir(entrada: ArticuloExportado[]) {
  const resultado = convertirArticulos(entrada);
  if (!resultado.ok) throw new Error(`Se esperaba una conversión sin pérdidas: ${JSON.stringify(resultado.perdidas)}`);
  return resultado;
}

/** El SQL en minúsculas y con los espacios reducidos a uno. */
const compacto = (sql: string) => sql.toLowerCase().replace(/\s+/g, ' ');

/** El literal de un documento tal como va en el SQL. */
const literalJson = (documento: unknown) =>
  `'${JSON.stringify(documento).replaceAll('$', '\\u0024').replaceAll("'", "''")}'::jsonb`;

/** Comprueba que los fragmentos aparecen en este orden y devuelve sus posiciones. */
function enOrden(texto: string, fragmentos: (string | RegExp)[]) {
  let desde = 0;
  return fragmentos.map((fragmento) => {
    const resto = texto.slice(desde);
    const posicion = typeof fragmento === 'string' ? resto.indexOf(fragmento) : (resto.match(fragmento)?.index ?? -1);
    expect(posicion, `falta (o está fuera de orden): ${String(fragmento)}`).toBeGreaterThanOrEqual(0);
    desde += Math.max(posicion, 0) + 1;
    return desde - 1;
  });
}

const PRIMERA_LINEA = 'select $fixture$\n';
const ULTIMA_LINEA = '\n$fixture$ as sql_conversion \\gset\n';

function comoFixture(sql: string) {
  return [
    '-- Generado por scripts/convertir-contenido.test.ts (ACTUALIZAR_FIXTURE=1) desde el corpus del formato anterior.',
    '-- No editar a mano. Lo usa supabase/tests/conversion.test.sql con \\ir (variable psql `sql_conversion`).',
    '-- Se elimina después del corte (data-model, "Conversión de los artículos existentes", paso 5).',
    `${PRIMERA_LINEA}${sql.trim()}${ULTIMA_LINEA}`,
  ].join('\n');
}

function sqlDeLaFixture(): string {
  const contenido = readFileSync(RUTA_FIXTURE, 'utf8').replaceAll('\r\n', '\n');
  const inicio = contenido.indexOf(PRIMERA_LINEA);
  const fin = contenido.lastIndexOf(ULTIMA_LINEA);
  if (inicio < 0 || fin < inicio) throw new Error('La fixture no tiene la envoltura `select $fixture$ … \\gset`');
  return contenido.slice(inicio + PRIMERA_LINEA.length, fin).trim();
}

describe('convertirArticulos: el SQL de la conversión (data-model, paso 3; D31 A3)', () => {
  it('RF-023: con el corpus y el contenido anterior del seed convierte todo sin pérdidas ni errores de validación', () => {
    const resultado = convertir(ENTRADA_CORPUS);

    expect(resultado.convertidos).toBe(ENTRADA_CORPUS.length);
    expect(resultado.conErrores).toEqual([]);
  });

  it('D31 A3: es un único bloque do $$ … $$ sin begin ni commit', () => {
    const { sql } = convertir(ENTRADA_FIXTURE);
    const limpio = sql.trim();

    expect(limpio).toMatch(/^do \$\$/i);
    expect(limpio).toMatch(/\$\$;?$/);
    expect(limpio.match(/\$\$/g)).toHaveLength(2);
    expect(compacto(limpio)).not.toMatch(/\b(commit|rollback|start transaction|savepoint)\b/);
    expect(compacto(limpio)).not.toMatch(/(^|;)\s*begin\s*(;|transaction|work)/);
  });

  it('RF-023: sigue los pasos del data-model en orden', () => {
    const sql = compacto(convertir(ENTRADA_FIXTURE).sql);

    const [, actualizar] = enOrden(sql, [
      'alter table public.articulos',
      'update public.articulos a set contenido = v.contenido from (values',
      ') as v(id, version, contenido) where a.id = v.id and a.version = v.version',
      /get diagnostics \w+ :?= row_count/,
      'raise exception',
      /jsonb_typeof\(\s*(\w+\.)?contenido\s*\) = 'array'/,
      'raise exception',
      'validate constraint articulos_contenido_check',
      'validate constraint articulos_requisitos_publicacion',
    ]);
    for (const trigger of ['a30_controlar_version', 'a90_actualizado_en', 'z90_notificar_cambio']) {
      const desactivar = sql.indexOf(`disable trigger ${trigger}`);
      const activar = sql.lastIndexOf(`enable trigger ${trigger}`);
      expect(desactivar, `desactiva ${trigger} antes del update`).toBeGreaterThanOrEqual(0);
      expect(desactivar).toBeLessThan(actualizar!);
      expect(activar, `vuelve a activar ${trigger} al final`).toBeGreaterThan(
        sql.indexOf('validate constraint articulos_requisitos_publicacion'),
      );
    }
  });

  it('RF-023: no toca la búsqueda ni usa session_replication_role (a50 recalcula y n10 no se toca)', () => {
    const sql = compacto(convertir(ENTRADA_FIXTURE).sql);

    expect(sql).not.toContain('a50_calcular_busqueda');
    expect(sql).not.toContain('n10_notificar_borrado');
    expect(sql).not.toMatch(/disable trigger (all|user)\b/);
    expect(sql).not.toContain('session_replication_role');
  });

  it('D25: comprueba que el update tocó exactamente los artículos convertidos', () => {
    const sql = compacto(convertir(ENTRADA_CORPUS).sql);

    expect(sql).toMatch(
      new RegExp(`get diagnostics (\\w+) :?= row_count;[^]*?\\1 (<>|!=|is distinct from) ${ENTRADA_CORPUS.length}\\b`),
    );
  });

  it('RF-023: cada artículo convertido va con su id, su versión y el documento de bloquesADocumento', () => {
    const { sql } = convertir(ENTRADA_FIXTURE);

    for (const { id, version, contenido } of ENTRADA_FIXTURE) {
      const fila = `('${id}'::uuid, ${version}, ${literalJson(bloquesADocumento(contenido as Contenido))})`;
      expect(sql).toContain(fila);
    }
  });

  it('D25: las comillas y los $$ de un texto no rompen el bloque', () => {
    const contenido: Contenido = [{ id: ID_BLOQUE, tipo: 'parrafo', texto: "Con 'comillas' y $$dólares$$ sueltos" }];
    const { sql } = convertir([{ id: ID_BORRADOR, version: 3, contenido }]);

    expect(sql.match(/\$\$/g)).toHaveLength(2);
    expect(sql).toContain(`('${ID_BORRADOR}'::uuid, 3, ${literalJson(bloquesADocumento(contenido))})`);
  });

  it('D25: un artículo que ya es un documento no se toca (la conversión es repetible)', () => {
    const resultado = convertir([...ENTRADA_FIXTURE, { id: ID_DOCUMENTO, version: 7, contenido: DOCUMENTO_VIGENTE }]);

    expect(resultado.convertidos).toBe(ENTRADA_FIXTURE.length);
    expect(resultado.sql).not.toContain(ID_DOCUMENTO);
    expect(resultado.sql).not.toContain('Ya convertido');
    expect(compacto(resultado.sql)).toMatch(/(<>|!=|is distinct from) 2\b/);
  });

  it('D25: si todos ya son documentos, no convierte ninguno', () => {
    const resultado = convertir([{ id: ID_DOCUMENTO, version: 7, contenido: DOCUMENTO_VIGENTE }]);

    expect(resultado.convertidos).toBe(0);
    expect(resultado.conErrores).toEqual([]);
    expect(resultado.sql).not.toContain(ID_DOCUMENTO);
  });
});

describe('convertirArticulos: pérdida (bloquea) y validez (informa) (D25 y D26)', () => {
  it('D25: un tipo de bloque desconocido es una pérdida: no genera nada e indica cuál y por qué', () => {
    const resultado = convertirArticulos([
      ...ENTRADA_FIXTURE,
      { id: ID_DOCUMENTO, version: 1, contenido: [{ id: ID_BLOQUE, tipo: 'tabla', filas: [] }] },
    ]);

    expect(resultado.ok).toBe(false);
    expect('sql' in resultado).toBe(false);
    if (resultado.ok) return;
    expect(resultado.perdidas).toHaveLength(1);
    expect(resultado.perdidas[0]?.id).toBe(ID_DOCUMENTO);
    expect(resultado.perdidas[0]?.motivo).toMatch(/tabla/);
  });

  it('D25: un bloque sin id es una pérdida (no tendría attrs.id)', () => {
    const resultado = convertirArticulos([
      { id: ID_BORRADOR, version: 1, contenido: [{ tipo: 'parrafo', texto: 'Sin id' }] },
    ]);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.perdidas).toEqual([{ id: ID_BORRADOR, motivo: expect.stringMatching(/\bid\b/i) }]);
  });

  it('D25: un contenido que no es un arreglo ni un documento es una pérdida', () => {
    const resultado = convertirArticulos([{ id: ID_BORRADOR, version: 1, contenido: { tipo: 'raro' } }]);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.perdidas.map((perdida) => perdida.id)).toEqual([ID_BORRADOR]);
    expect(resultado.perdidas[0]?.motivo).not.toBe('');
  });

  it('D25: informa todas las pérdidas, no solo la primera', () => {
    const resultado = convertirArticulos([
      { id: ID_BORRADOR, version: 1, contenido: [{ id: ID_BLOQUE, tipo: 'tabla' }] },
      ...ENTRADA_FIXTURE.slice(1),
      { id: ID_DOCUMENTO, version: 1, contenido: [{ tipo: 'separador' }] },
    ]);

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.perdidas.map((perdida) => perdida.id)).toEqual([ID_BORRADOR, ID_DOCUMENTO]);
  });

  it('caso borde: un borrador viejo con campos vacíos se convierte igual y aparece en la lista con sus errores', () => {
    const cta = { id: ID_BLOQUE, tipo: 'cta', titulo: '', etiquetaBoton: '', url: '' };
    const resultado = convertir([...ENTRADA_FIXTURE, { id: ID_DOCUMENTO, version: 2, contenido: [cta] }]);

    expect(resultado.convertidos).toBe(3);
    expect(resultado.sql).toContain(ID_DOCUMENTO);
    expect(resultado.conErrores.map((articulo) => articulo.id)).toEqual([ID_DOCUMENTO]);
    expect(resultado.conErrores[0]?.errores.map((error) => error.campo)).toEqual(
      expect.arrayContaining(['titulo', 'etiquetaBoton', 'url']),
    );
    expect(resultado.conErrores[0]?.errores.every((error) => error.id === ID_BLOQUE)).toBe(true);
  });

  it('caso borde: un publicado con una imagen sin texto alternativo se convierte igual y queda en la lista', () => {
    const imagen = {
      id: ID_BLOQUE,
      tipo: 'imagen',
      imagen: { ruta: 'articulos/vieja.png', ancho: 800, alto: 600, decorativa: false },
    };
    const resultado = convertir([{ id: ID_PUBLICADO, version: 4, contenido: [imagen] }]);

    expect(resultado.convertidos).toBe(1);
    expect(resultado.sql).toContain(`('${ID_PUBLICADO}'::uuid, 4, `);
    expect(resultado.conErrores).toEqual([
      { id: ID_PUBLICADO, errores: [expect.objectContaining({ indice: 0, id: ID_BLOQUE, campo: 'imagen.alt' })] },
    ]);
  });
});

describe('la fixture de pgTAP no se desvía (data-model, conversion.test.sql)', () => {
  it('RF-023: el SQL generado para el corpus de la fixture es el de supabase/tests/fixtures/conversion-corpus.psql', () => {
    const { sql } = convertir(ENTRADA_FIXTURE);
    if (process.env.ACTUALIZAR_FIXTURE) writeFileSync(RUTA_FIXTURE, comoFixture(sql), 'utf8');

    expect(sqlDeLaFixture()).toBe(sql.trim());
  });
});
