import type { ErrorBloque } from '@blog/bloques';
import type { PostgrestError } from '@supabase/supabase-js';

export type CodigoError =
  | 'conflicto_version' // RF-008
  | 'estado_invalido' // RF-009
  | 'requisitos_publicacion' // RF-010
  | 'fecha_no_futura' // RF-011
  | 'categoria_en_uso' // RF-016
  | 'ultimo_admin' // RF-023
  | 'sin_permiso' // RLS / trigger de perfil
  | 'contenido_invalido' // check de contenido / validación Zod
  | 'slug_duplicado' // 23505 tras reintento
  | 'no_encontrado'
  | 'desconocido';

/** Forma mínima de un error de PostgREST; `PostgrestError` la cumple. */
export type ErrorPostgrest = Pick<PostgrestError, 'code' | 'message' | 'details' | 'hint'>;

export class ErrorDominio extends Error {
  readonly codigo: CodigoError;
  /** `detail` del error de la base (por ejemplo, el conteo de `categoria_en_uso`). */
  readonly detalle: string | undefined;
  /** Solo con `contenido_invalido`: los errores de la validación de bloques. */
  readonly errores: ErrorBloque[] | undefined;

  constructor(
    codigo: CodigoError,
    mensaje: string,
    opciones?: { detalle?: string; errores?: ErrorBloque[]; cause?: unknown },
  ) {
    super(mensaje, { cause: opciones?.cause });
    this.name = 'ErrorDominio';
    this.codigo = codigo;
    this.detalle = opciones?.detalle;
    this.errores = opciones?.errores;
  }
}

// Códigos que la base lanza con `raise exception using errcode = 'P0001', message = '<codigo>'`.
const CODIGOS_DE_LA_BASE = new Set<CodigoError>([
  'conflicto_version',
  'estado_invalido',
  'requisitos_publicacion',
  'fecha_no_futura',
  'categoria_en_uso',
  'ultimo_admin',
  'sin_permiso',
  'contenido_invalido',
  'no_encontrado',
]);

function codigoDe(error: ErrorPostgrest): CodigoError {
  switch (error.code) {
    case 'P0001':
      return CODIGOS_DE_LA_BASE.has(error.message as CodigoError) ? (error.message as CodigoError) : 'desconocido';
    case '42501':
      return 'sin_permiso';
    case '23505':
      return /\(slug\)/.test(error.details) ? 'slug_duplicado' : 'desconocido';
    case '23503': // FK: la referencia no existe (o se borró en una carrera); la tabla queda en `detalle`
      return 'no_encontrado';
    case '23514':
      return /contenido/.test(error.message) ? 'contenido_invalido' : 'desconocido';
    case 'PGRST116':
      return 'no_encontrado';
    default:
      return 'desconocido';
  }
}

export function traducirError(error: ErrorPostgrest): ErrorDominio {
  return new ErrorDominio(codigoDe(error), error.message, {
    detalle: error.details || undefined,
    cause: error,
  });
}
