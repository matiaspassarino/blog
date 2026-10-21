// Matriz de permisos del panel y transiciones de estado (spec 003, research D16). Lógica pura: sirve
// para ocultar acciones y dar un mensaje claro antes de ir a la base. La verdad sigue siendo RLS y
// los triggers (constitución §III.5, §V.4): ocultar un botón no reemplaza a la base.
import type { EstadoArticulo, RolMiembro } from './tipos-dominio';

/** Una por fila de la tabla "Requisitos de permisos" de la spec 003. */
export const ACCIONES = [
  'acceso.ingreso',
  'acceso.definir_contrasena',
  'panel.ver',
  'articulo.crear',
  'articulo.editar',
  'articulo.vista_previa',
  'articulo.cambiar_estado',
  'articulo.eliminar',
  'medio.subir',
  'taxonomia.gestionar',
  'perfil.editar_propio',
  'equipo.ver',
  'equipo.gestionar',
] as const;

export type Accion = (typeof ACCIONES)[number];

// Las acciones de acceso las puede cualquiera: la segunda, solo con un enlace válido, que lo verifica Auth.
const PUBLICAS: readonly Accion[] = ['acceso.ingreso', 'acceso.definir_contrasena'];
const SOLO_ADMIN: readonly Accion[] = ['articulo.eliminar', 'equipo.ver', 'equipo.gestionar'];

/**
 * `rol` es `null` para un visitante sin sesión y para un miembro desactivado, que se comporta
 * como anónimo (spec 003, "Requisitos de permisos").
 */
export function puede(rol: RolMiembro | null, accion: Accion): boolean {
  if (PUBLICAS.includes(accion)) return true;
  if (rol === null) return false;
  if (SOLO_ADMIN.includes(accion)) return rol === 'admin';
  return true;
}

const TRANSICIONES: Record<EstadoArticulo, readonly EstadoArticulo[]> = {
  borrador: ['publicado', 'programado', 'archivado'],
  programado: ['borrador', 'archivado'],
  publicado: ['borrador', 'archivado'],
  archivado: ['borrador'],
};

/** Estados a los que se puede pasar desde `estado` (RF-009). La base vuelve a validar la transición. */
export function transicionesDe(estado: EstadoArticulo): EstadoArticulo[] {
  return [...TRANSICIONES[estado]];
}
