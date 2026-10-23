// Conversión de los artículos existentes al documento (spec 005, RF-023 y RF-030; data-model "Conversión de los
// artículos existentes"; research D25, D26 y D31). Script de un solo uso que no se conecta a ninguna base: lee el
// export de los artículos y escribe el SQL que la migración y el corte aplican en la misma ejecución.
//
//   pnpm --filter @blog/bloques convertir-contenido --entrada articulos-nube.json --salida conversion-nube.sql
//
// La entrada es `[{ id, version, contenido }]` (`select json_agg(…) from public.articulos`). Todo o nada: si un
// artículo pierde algo al convertirse, no se escribe nada y se dice cuál y por qué. Un artículo con errores de
// validación se convierte igual (conserva lo que tiene) y se lista.
import { readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { bloquesADocumento, documentoABloques, reducirTramos } from '../src/conversion-anterior/conversion';
import { esquemaBloque, type Contenido } from '../src/conversion-anterior/esquema-bloques';
import { visibleDeBloques } from '../src/conversion-anterior/visible';
import { TIPOS_ELEMENTO, visibleDeDocumento } from '../src/elementos';
import type { Documento } from '../src/esquema';
import { validarDocumento, type ErrorElemento } from '../src/validar';

export type ArticuloExportado = { id: string; version: number; contenido: unknown };
export type ResultadoConversion =
  | { ok: true; sql: string; convertidos: number; conErrores: { id: string; errores: ErrorElemento[] }[] }
  | { ok: false; perdidas: { id: string; motivo: string }[] };

const TIPOS_DE_BLOQUE = new Set(esquemaBloque.options.map((opcion) => opcion.shape.tipo.value));
const TRIGGERS = ['a30_controlar_version', 'a90_actualizado_en', 'z90_notificar_cambio'];

const esDocumento = (valor: unknown) =>
  typeof valor === 'object' &&
  valor !== null &&
  (valor as { type?: unknown }).type === 'doc' &&
  Array.isArray((valor as { content?: unknown }).content);

/** Los bloques que no se pueden convertir sin perder algo (sin id o de un tipo que el documento no tiene). */
function bloquesSinEquivalente(contenido: unknown[]): string[] {
  return contenido.flatMap((bloque, indice): string[] => {
    const { id, tipo } = (bloque ?? {}) as { id?: unknown; tipo?: unknown };
    if (typeof id !== 'string' || id === '') return [`el bloque ${indice + 1} no tiene id`];
    if (!TIPOS_DE_BLOQUE.has(String(tipo) as never)) return [`el bloque ${indice + 1} es de un tipo desconocido: ${String(tipo)}`];
    return [];
  });
}

/** La forma mínima que acepta la base (`privado.contenido_valido`). */
const tieneFormaMinima = (documento: Documento) =>
  documento.type === 'doc' &&
  Array.isArray(documento.content) &&
  documento.content.length <= 200 &&
  documento.content.every(
    (elemento) =>
      (TIPOS_ELEMENTO as readonly string[]).includes(elemento.type) && typeof elemento.attrs?.id === 'string',
  );

/** Por qué la conversión de un contenido pierde algo, o `null` si no pierde nada. */
function perdida(contenido: Contenido, documento: Documento): string | null {
  if (!tieneFormaMinima(documento)) return 'el documento convertido no tiene la forma mínima de la base';
  if (!isDeepStrictEqual(documentoABloques(documento), reducirTramos(contenido))) {
    return 'la ida y vuelta no devuelve el contenido original';
  }
  if (!isDeepStrictEqual(visibleDeDocumento(documento), visibleDeBloques(contenido))) {
    return 'el sitio no mostraría lo mismo (texto, anclas, imágenes o enlaces)';
  }
  return null;
}

/** Un documento como literal `jsonb`: ningún texto puede cerrar el `$$` del bloque ni la comilla del literal. */
const literalJson = (documento: Documento) =>
  `'${JSON.stringify(documento).replaceAll('$', '\\u0024').replaceAll("'", "''")}'::jsonb`;

/** Un único bloque `do`, sin `begin`/`commit`: atómico en el SQL Editor, en el MCP, en `psql` y en pgTAP (D31 A3). */
function sqlDeConversion(filas: { id: string; version: number; documento: Documento }[]): string {
  const triggers = (accion: 'disable' | 'enable') => TRIGGERS.map((nombre) => `${accion} trigger ${nombre}`).join(', ');
  const actualizar =
    filas.length === 0
      ? '  actualizados := 0;'
      : [
          '  update public.articulos a set contenido = v.contenido',
          '  from (values',
          filas.map(({ id, version, documento }) => `    ('${id}'::uuid, ${version}, ${literalJson(documento)})`).join(',\n'),
          '  ) as v(id, version, contenido)',
          '  where a.id = v.id and a.version = v.version;',
          '  get diagnostics actualizados = row_count;',
        ].join('\n');
  return [
    'do $$',
    'declare',
    '  actualizados integer;',
    'begin',
    // La versión y la fecha no cambian y el sitio no recibe avisos; a50_calcular_busqueda recalcula la búsqueda.
    `  alter table public.articulos ${triggers('disable')};`,
    actualizar,
    `  if actualizados <> ${filas.length} then`,
    `    raise exception 'La conversión actualizó % de ${filas.length} artículos: alguno cambió después del export', actualizados;`,
    '  end if;',
    "  if exists (select 1 from public.articulos where jsonb_typeof(contenido) = 'array') then",
    "    raise exception 'Quedan artículos en el formato anterior: alguno se creó después del export';",
    '  end if;',
    '  alter table public.articulos validate constraint articulos_contenido_check;',
    '  alter table public.articulos validate constraint articulos_requisitos_publicacion;',
    `  alter table public.articulos ${triggers('enable')};`,
    'end',
    '$$;',
  ].join('\n');
}

/** Convierte los artículos exportados y genera el SQL, o devuelve todas las pérdidas sin generar nada. */
export function convertirArticulos(entrada: ArticuloExportado[]): ResultadoConversion {
  const perdidas: { id: string; motivo: string }[] = [];
  const conErrores: { id: string; errores: ErrorElemento[] }[] = [];
  const filas: { id: string; version: number; documento: Documento }[] = [];
  for (const { id, version, contenido } of entrada) {
    if (esDocumento(contenido)) continue; // ya convertido: la conversión es repetible
    if (!Array.isArray(contenido)) {
      perdidas.push({ id, motivo: 'el contenido no es una lista de bloques ni un documento' });
      continue;
    }
    const sinEquivalente = bloquesSinEquivalente(contenido);
    if (sinEquivalente.length > 0) {
      perdidas.push({ id, motivo: sinEquivalente.join('; ') });
      continue;
    }
    try {
      const documento = bloquesADocumento(contenido as Contenido);
      const motivo = perdida(contenido as Contenido, documento);
      if (motivo) {
        perdidas.push({ id, motivo });
        continue;
      }
      const errores = validarDocumento(documento);
      if (errores.length > 0) conErrores.push({ id, errores });
      filas.push({ id, version, documento });
    } catch (error) {
      perdidas.push({ id, motivo: `no se pudo convertir: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
  if (perdidas.length > 0) return { ok: false, perdidas };
  return { ok: true, sql: sqlDeConversion(filas), convertidos: filas.length, conErrores };
}

/** La salida del script para la persona que lo corre (los errores van por `console.error`). */
const informar = (linea: string) => process.stdout.write(`${linea}\n`);

function principal() {
  const { values } = parseArgs({ options: { entrada: { type: 'string' }, salida: { type: 'string' } } });
  if (!values.entrada || !values.salida) {
    console.error('Uso: convertir-contenido --entrada <articulos.json> --salida <conversion.sql>');
    process.exitCode = 2;
    return;
  }
  const entrada = JSON.parse(readFileSync(values.entrada, 'utf8')) as ArticuloExportado[];
  const resultado = convertirArticulos(entrada);
  if (!resultado.ok) {
    console.error(`No se generó nada: ${resultado.perdidas.length} artículo(s) perderían contenido.`);
    for (const { id, motivo } of resultado.perdidas) console.error(`  ${id}: ${motivo}`);
    process.exitCode = 1;
    return;
  }
  writeFileSync(values.salida, `${resultado.sql}\n`, 'utf8');
  informar(`Convertidos ${resultado.convertidos} de ${entrada.length} artículos → ${values.salida}`);
  if (resultado.conErrores.length > 0) {
    informar(`${resultado.conErrores.length} con errores de validación (se convierten igual; revisarlos en el panel):`);
    for (const { id, errores } of resultado.conErrores) {
      informar(`  ${id}: ${errores.map((error) => `${error.campo || 'documento'}: ${error.mensaje}`).join('; ')}`);
    }
  }
}

if (import.meta.main) principal();
