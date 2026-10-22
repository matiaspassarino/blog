// Ayudas de las Server Actions del panel. No puede vivir en un archivo 'use server': cada export de
// uno de esos archivos queda como un punto de entrada invocable desde el navegador.
import type { Accion, ClienteBlog } from '@blog/db';
import { puede } from '@blog/db';
import { fallo, envolverAccion, type ResultadoAccion } from './resultado';
import { obtenerMiembro, type MiembroSesion } from './sesion';
import { crearClienteDeSesion } from './supabase';

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

type Contexto = { miembro: MiembroSesion; cliente: ClienteBlog };

/**
 * Pasos 1, 2, 4 y 5 de las "Reglas comunes": exige un miembro activo, comprueba el permiso, crea el
 * cliente con su sesión y traduce los errores a `ResultadoAccion`. La acción solo valida su entrada y
 * llama a `@blog/db`. La base vuelve a comprobar todo con RLS (RF-003).
 */
export function conPermiso<T>(accion: Accion, ejecutar: (contexto: Contexto) => Promise<ResultadoAccion<T>>) {
  return envolverAccion(async () => {
    const sesion = await exigirMiembroEnAccion();
    if ('fallo' in sesion) return sesion.fallo;
    if (!puede(sesion.miembro.rol, accion)) return fallo('sin_permiso');
    return ejecutar({ miembro: sesion.miembro, cliente: await crearClienteDeSesion() });
  });
}
