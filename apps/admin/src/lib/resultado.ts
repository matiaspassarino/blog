// Resultado tipado de las Server Actions (contracts/acciones.md, "Reglas comunes").
import { ErrorDominio } from '@blog/db';
import type { ErrorBloque } from '@blog/bloques';
import { unstable_rethrow } from 'next/navigation';
import { mensajeDeError, type CodigoMensaje } from './mensajes';

export type ResultadoAccion<T = void> =
  | { ok: true; datos: T }
  | {
      ok: false;
      codigo: CodigoMensaje;
      mensaje: string;
      errores?: ErrorBloque[];
      detalle?: string;
      /** Solo con `no_autenticado`: la interfaz navega a `/salir` si es `desactivada`. */
      motivo?: 'sin_sesion' | 'desactivada';
    };

export function exito<T>(datos: T): ResultadoAccion<T> {
  return { ok: true, datos };
}

export function fallo(
  codigo: CodigoMensaje,
  extra: { detalle?: string; errores?: ErrorBloque[]; motivo?: 'sin_sesion' | 'desactivada' } = {},
): ResultadoAccion<never> {
  return { ok: false, codigo, mensaje: mensajeDeError(codigo, extra.detalle), ...extra };
}

/**
 * Ejecuta una acción y convierte `ErrorDominio` en resultado. Los errores de control de flujo de Next
 * (`redirect`, `notFound`, `forbidden`, `unauthorized`) se relanzan; un error inesperado se registra
 * en el servidor y se devuelve como `desconocido`, sin detalles técnicos.
 */
export async function envolverAccion<T>(accion: () => Promise<ResultadoAccion<T>>): Promise<ResultadoAccion<T>> {
  try {
    return await accion();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ErrorDominio) {
      return fallo(error.codigo, { detalle: error.detalle, errores: error.errores });
    }
    console.error('Error inesperado en una acción del panel', error);
    return fallo('desconocido');
  }
}
