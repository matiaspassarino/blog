// Ayudas de las Server Actions del panel. No puede vivir en un archivo 'use server': cada export de
// uno de esos archivos queda como un punto de entrada invocable desde el navegador.
import { obtenerMiembro, type MiembroSesion } from './sesion';
import { fallo, type ResultadoAccion } from './resultado';

/**
 * Paso 1 de las "Reglas comunes" de contracts/acciones.md: el miembro activo que llama o el resultado
 * `no_autenticado` (con el motivo) que la acción debe devolver. La interfaz navega a `/salir` si el
 * motivo es `desactivada`.
 */
export async function exigirMiembroEnAccion(): Promise<{ miembro: MiembroSesion } | { fallo: ResultadoAccion<never> }> {
  const sesion = await obtenerMiembro();
  if (sesion.miembro) return { miembro: sesion.miembro };
  return { fallo: fallo('no_autenticado', { motivo: sesion.motivo }) };
}
