import { esquemaContenido, type Contenido } from './esquema';

export type ErrorBloque = { indice: number; campo: string; mensaje: string };

/** Valida el contenido completo sin lanzar: devuelve todos los errores con su bloque y campo. */
export function validarContenido(
  entrada: unknown,
): { ok: true; contenido: Contenido } | { ok: false; errores: ErrorBloque[] } {
  const resultado = esquemaContenido.safeParse(entrada);
  if (resultado.success) return { ok: true, contenido: resultado.data };

  const errores = resultado.error.issues.map((problema) => {
    const [indice, ...resto] = problema.path;
    let campo = resto.map(String).join('.');
    // Un discriminador desconocido se reporta sobre el bloque entero: lo atribuimos a `tipo`.
    if (problema.code === 'invalid_union' && campo === '' && typeof indice === 'number') campo = 'tipo';
    return { indice: typeof indice === 'number' ? indice : -1, campo, mensaje: problema.message };
  });
  return { ok: false, errores };
}
