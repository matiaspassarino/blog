import type { Elemento } from '@blog/bloques';

/**
 * Lo que está seleccionado en el lienzo. Un rango de texto, aunque cruce párrafos, es `texto`; `elementos` solo
 * existe en el modo elementos (contracts/atajos.md).
 */
/** El elemento de primer nivel seleccionado entero (con un clic en un elemento especial o con `Esc`). */
export type ElementoActivo = {
  id: string;
  /** Posición en el documento, desde 1. */
  posicion: number;
  /** Índice del elemento en el documento, desde 0 (los ids de los campos del panel). */
  indice: number;
  /** `insertar`: lo acaba de crear «Insertar» y el panel se abre con el foco en su primer campo. */
  origen: 'puntero' | 'insertar' | 'insertar-texto';
};

export type SeleccionDelDocumento =
  { tipo: 'texto' } | { tipo: 'elementos'; desde: number; hasta: number; elementos: Elemento[]; modo?: boolean };
