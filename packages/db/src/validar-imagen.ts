// Validación de imágenes sueltas (imagen destacada, avatar) con el esquema de @blog/bloques.
import { esquemaImagen, type ErrorElemento } from '@blog/bloques';
import type { Json } from './tipos';

/**
 * Devuelve la imagen parseada (con sus valores por defecto) o los errores, con
 * `indice: -1` y `campo: '<campo>.<ruta>'`, el mismo formato que los de los elementos del documento.
 */
export function validarImagen(
  valor: unknown,
  campo: string,
): { ok: true; imagen: Json } | { ok: false; errores: ErrorElemento[] } {
  const resultado = esquemaImagen.safeParse(valor);
  if (resultado.success) return { ok: true, imagen: resultado.data as Json };
  return {
    ok: false,
    errores: resultado.error.issues.map((problema) => ({
      indice: -1,
      id: '',
      campo: [campo, ...problema.path.map(String)].join('.'),
      mensaje: problema.message,
    })),
  };
}
