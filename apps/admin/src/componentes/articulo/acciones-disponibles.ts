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

export const ETIQUETAS: Record<AccionEstado, string> = {
  publicar: 'Publicar',
  programar: 'Programar',
  cancelar_programacion: 'Cancelar programación',
  volver_a_borrador: 'Volver a borrador',
  archivar: 'Archivar',
  eliminar: 'Eliminar',
};

export const ANUNCIOS: Record<EstadoArticulo, string> = {
  borrador: 'El artículo volvió a borrador',
  programado: 'El artículo quedó programado',
  publicado: 'El artículo se publicó',
  archivado: 'El artículo se archivó',
};

// Barra fija del editor (spec 004, RF-005 y RF-019): las posiciones son fijas y solo cambia el nivel.
export type AccionBarra = 'guardar' | AccionEstado | 'vista_previa';

type EntradaBarra = Entrada & { guardado: boolean };

const ORDEN_TRANSICIONES: Transicion[] = [
  'publicar',
  'programar',
  'cancelar_programacion',
  'volver_a_borrador',
  'archivar',
];

/**
 * La acción con el máximo peso: "Publicar" solo en un borrador guardado sin cambios; en cualquier otro caso
 * (artículo nuevo, cambios pendientes, programado, publicado o archivado) es "Guardar".
 */
export function accionPrincipalEditor({
  estado,
  guardado,
  hayCambiosSinGuardar,
}: Omit<EntradaBarra, 'rol'>): 'guardar' | 'publicar' {
  return guardado && estado === 'borrador' && !hayCambiosSinGuardar ? 'publicar' : 'guardar';
}

/** Un artículo nuevo siempre puede guardar (así muestra qué falta); uno guardado, solo con cambios. */
export function guardarHabilitado({
  guardado,
  hayCambiosSinGuardar,
  ocupado,
}: {
  guardado: boolean;
  hayCambiosSinGuardar: boolean;
  ocupado: boolean;
}): boolean {
  return !ocupado && (!guardado || hayCambiosSinGuardar);
}

/**
 * Qué acciones van en la barra y cuáles en "Más acciones" (por debajo de 42 rem): en la barra quedan "Guardar" y
 * la primera transición del orden fijo; el resto, "Vista previa" y "Eliminar" (solo admin, al final) van al menú.
 * Un artículo nuevo solo tiene "Guardar".
 */
export function distribuirBarraEditor({ guardado, ...entrada }: EntradaBarra): {
  enBarra: AccionBarra[];
  enMenu: AccionBarra[];
} {
  if (!guardado) return { enBarra: ['guardar'], enMenu: [] };
  const { acciones } = accionesDisponibles(entrada);
  const transiciones = ORDEN_TRANSICIONES.filter((accion) => acciones.includes(accion));
  const [primera, ...resto] = transiciones;
  return {
    enBarra: primera ? ['guardar', primera] : ['guardar'],
    enMenu: [...resto, 'vista_previa', ...(acciones.includes('eliminar') ? (['eliminar'] as const) : [])],
  };
}
