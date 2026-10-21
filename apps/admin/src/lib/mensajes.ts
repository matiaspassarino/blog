// Mensajes de error en español y sin jerga (RF-023). Texto de contracts/acciones.md, "Códigos y mensajes".
import type { CodigoError } from '@blog/db';

/** Códigos propios del panel, además de los del dominio de @blog/db. */
export type CodigoPanel = 'no_autenticado' | 'imagen_invalida' | 'credenciales_invalidas' | 'cuenta_desactivada';

export type CodigoMensaje = CodigoError | CodigoPanel;

const FIJOS: Partial<Record<CodigoMensaje, string>> = {
  no_autenticado: 'Tu sesión terminó. Ingresa de nuevo para seguir.',
  sin_permiso: 'No tienes permiso para hacer esto.',
  conflicto_version: 'Alguien guardó cambios más nuevos en este artículo.',
  estado_invalido: 'Esa acción no está disponible para el estado actual del artículo.',
  fecha_no_futura: 'Elige una fecha y hora que todavía no hayan pasado.',
  ultimo_admin: 'Siempre tiene que quedar al menos un administrador activo.',
  contenido_invalido: 'Revisa los campos marcados.',
  slug_duplicado: 'Esa dirección ya está en uso.',
  no_encontrado: 'Ya no existe. Puede que lo hayan eliminado.',
  credenciales_invalidas: 'El correo o la contraseña no son correctos.',
  cuenta_desactivada: 'Tu cuenta está desactivada. Habla con un administrador.',
  desconocido: 'Algo salió mal. Prueba de nuevo en unos minutos.',
};

/** `detalle` completa los mensajes que lo necesitan (qué falta, cuántos artículos, el motivo). */
export function mensajeDeError(codigo: CodigoMensaje, detalle?: string): string {
  switch (codigo) {
    case 'requisitos_publicacion':
      return detalle ? `Para publicar falta: ${detalle}.` : 'Para publicar falta completar el artículo.';
    case 'categoria_en_uso': {
      const cantidad = Number(detalle);
      if (!detalle || Number.isNaN(cantidad)) return 'No se puede eliminar: todavía la usan artículos.';
      return `No se puede eliminar: ${cantidad === 1 ? 'la usa 1 artículo' : `la usan ${cantidad} artículos`}.`;
    }
    case 'imagen_invalida':
      return detalle ?? 'La imagen no se puede usar. Solo se aceptan JPEG, PNG, WebP o AVIF de hasta 5 MB.';
    case 'validacion':
      return detalle ?? 'Revisa los datos ingresados.';
    default:
      return FIJOS[codigo] ?? FIJOS.desconocido ?? '';
  }
}
