import type { DatosDe, ErrorElemento, TipoConDatos } from '@blog/bloques';

type CambiosDe<T extends TipoConDatos> = Partial<DatosDe<T>> | ((datos: DatosDe<T>) => Partial<DatosDe<T>>);

/**
 * Campos a mezclar en un elemento, con los nombres del panel (`nivel`, `ordenada`…). Una función recibe los datos
 * actuales: así dos cambios seguidos (por ejemplo dos imágenes que terminan de subir casi a la vez) se suman en lugar
 * de pisarse.
 */
export type CambiosDeElemento = { [T in TipoConDatos]: CambiosDe<T> }[TipoConDatos];

/** Lo que recibe el editor de campos de cada tipo de elemento (todos comparten la misma forma). */
export type PropsEditorBloque<T extends TipoConDatos> = {
  datos: DatosDe<T>;
  indice: number;
  errores: ErrorElemento[];
  /** Mezcla estos campos en el elemento (o los que devuelva la función); el id y el texto no cambian. */
  cambiar: (cambios: CambiosDe<T>) => void;
};
