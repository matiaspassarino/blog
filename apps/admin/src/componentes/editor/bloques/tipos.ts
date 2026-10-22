import type { Bloque, BloqueDe, ErrorBloque, TipoBloque } from '@blog/bloques';

/**
 * Campos a mezclar en un bloque. Una función recibe el bloque actual: así dos cambios seguidos (por ejemplo dos
 * imágenes que terminan de subir casi a la vez) se suman en lugar de pisarse.
 */
export type CambiosDeBloque = Partial<Bloque> | ((bloque: Bloque) => Partial<Bloque>);

/** Lo que recibe el editor de cada tipo de bloque (todos comparten la misma forma). */
export type PropsEditorBloque<T extends TipoBloque> = {
  bloque: BloqueDe<T>;
  indice: number;
  errores: ErrorBloque[];
  /** Mezcla estos campos en el bloque (o los que devuelva la función); el id y el tipo no cambian. */
  cambiar: (cambios: Partial<BloqueDe<T>> | ((bloque: BloqueDe<T>) => Partial<BloqueDe<T>>)) => void;
};
