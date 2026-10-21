// Qué acciones de estado se ofrecen para un artículo (RF-012, spec 003): solo las transiciones que permite la
// matriz de la base (RF-009 de la spec 001) y, para el admin, además "eliminar". Lógica pura.
import { puede, type EstadoArticulo, type RolMiembro } from '@blog/db';

export type AccionEstado =
  'publicar' | 'programar' | 'cancelar_programacion' | 'volver_a_borrador' | 'archivar' | 'eliminar';

type Transicion = Exclude<AccionEstado, 'eliminar'>;

const POR_ESTADO: Record<EstadoArticulo, Transicion[]> = {
  borrador: ['publicar', 'programar'],
  programado: ['cancelar_programacion', 'publicar'],
  publicado: ['volver_a_borrador', 'archivar'],
  archivado: ['volver_a_borrador'],
};

const DESTINOS: Record<Transicion, EstadoArticulo> = {
  publicar: 'publicado',
  programar: 'programado',
  cancelar_programacion: 'borrador',
  volver_a_borrador: 'borrador',
  archivar: 'archivado',
};

/** Estado al que lleva una acción de cambio de estado. */
export const destinoDe = (accion: Transicion): EstadoArticulo => DESTINOS[accion];

type Entrada = { estado: EstadoArticulo; rol: RolMiembro | null; hayCambiosSinGuardar: boolean };

/**
 * `rol` nulo es un visitante o un miembro desactivado: no ve nada. Con cambios sin guardar las acciones se
 * siguen ofreciendo, pero hay que guardar antes (`requiereGuardarAntes`): el estado se cambia sobre lo guardado.
 */
export function accionesDisponibles({ estado, rol, hayCambiosSinGuardar }: Entrada): {
  acciones: AccionEstado[];
  requiereGuardarAntes: boolean;
} {
  if (rol === null) return { acciones: [], requiereGuardarAntes: hayCambiosSinGuardar };
  const acciones: AccionEstado[] = [...POR_ESTADO[estado]];
  if (puede(rol, 'articulo.eliminar')) acciones.push('eliminar');
  return { acciones, requiereGuardarAntes: hayCambiosSinGuardar };
}
