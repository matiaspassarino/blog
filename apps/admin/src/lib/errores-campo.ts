// Errores de validación del editor ubicados en pantalla (RF-006, CE-004): a qué campo apunta cada
// `ErrorBloque` para señalarlo, enfocarlo y enlazarlo desde el resumen de errores.
import type { ErrorBloque } from '@blog/bloques';

/**
 * `bloque-<indice>-<campo>` para un bloque; con `indice: -1` (imagen destacada, avatar) es
 * `campo-<primer segmento del campo>`, por ejemplo `imagen_destacada.alt` → `campo-imagen_destacada`.
 */
export function idDeCampo({ indice, campo }: ErrorBloque): string {
  if (indice < 0) return `campo-${campo.split('.')[0]}`;
  return `bloque-${indice}-${campo}`;
}

/** Errores por índice de bloque (`-1` es la imagen destacada); un bloque sin errores no aparece. */
export function agruparPorBloque(errores: ErrorBloque[]): Map<number, ErrorBloque[]> {
  const mapa = new Map<number, ErrorBloque[]>();
  for (const error of errores) mapa.set(error.indice, [...(mapa.get(error.indice) ?? []), error]);
  return mapa;
}

/** Id del primer campo con error por orden de pantalla (la destacada primero, luego los bloques). */
export function primerCampoInvalido(errores: ErrorBloque[]): string | null {
  const primero = [...errores].sort((a, b) => a.indice - b.indice)[0];
  return primero ? idDeCampo(primero) : null;
}
