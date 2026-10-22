import type { Bloque } from '@blog/bloques';

/**
 * Lo que está seleccionado en el lienzo. Un rango de texto, aunque cruce párrafos, es `texto`; `elementos` solo
 * existe en el modo elementos (contracts/atajos.md).
 */
export type SeleccionDelDocumento =
  { tipo: 'texto' } | { tipo: 'elementos'; desde: number; hasta: number; bloques: Bloque[] };
