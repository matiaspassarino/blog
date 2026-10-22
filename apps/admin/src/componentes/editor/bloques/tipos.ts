import type { BloqueDe, ErrorBloque, TipoBloque } from '@blog/bloques';

/** Lo que recibe el editor de cada tipo de bloque (todos comparten la misma forma). */
export type PropsEditorBloque<T extends TipoBloque> = {
  bloque: BloqueDe<T>;
  indice: number;
  errores: ErrorBloque[];
  /** Mezcla estos campos en el bloque (o los que devuelva la función); el id y el tipo no cambian. */
  cambiar: (cambios: Partial<BloqueDe<T>> | ((bloque: BloqueDe<T>) => Partial<BloqueDe<T>>)) => void;
};
