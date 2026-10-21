// Resultado tipado de las Server Actions (contracts/acciones.md, "Reglas comunes").
import { ErrorDominio } from '@blog/db';
import type { ErrorBloque } from '@blog/bloques';
import { unstable_rethrow } from 'next/navigation';
import type { MotivoSesion } from './sesion';
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
      motivo?: MotivoSesion;
    };

/** La base dice qué le falta al artículo con una palabra técnica; la persona necesita una frase (RF-013). */
const FALTANTES: Record<string, string> = { categoria: 'sin categoría', contenido: 'sin bloques' };

export function exito<T>(datos: T): ResultadoAccion<T> {
  return { ok: true, datos };
}

export function fallo(
  codigo: CodigoMensaje,
  extra: { detalle?: string; errores?: ErrorBloque[]; motivo?: MotivoSesion } = {},
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
      const detalle =
        error.codigo === 'requisitos_publicacion' && error.detalle
          ? (FALTANTES[error.detalle] ?? error.detalle)
          : error.detalle;
      return fallo(error.codigo, { detalle, errores: error.errores });
    }
    console.error('Error inesperado en una acción del panel', error);
    return fallo('desconocido');
  }
}
