// T012 (spec 003): matriz de permisos del panel (RF-003, CE-002, D16) y transiciones de estado
// (data-model "Estados y transiciones"). Funciones puras: sin base de datos.
// Firmas supuestas (T027): `ACCIONES` (arreglo de ids), `puede(rol | null, accion)` y
// `transicionesDe(estado)`, exportadas desde './permisos'.
import { describe, expect, it } from 'vitest';
import type { EstadoArticulo, RolMiembro } from './tipos-dominio';
import { ACCIONES, puede, transicionesDe } from './permisos';

type Rol = RolMiembro | null;
const ROLES: Rol[] = [null, 'editor', 'admin'];

// Tabla "Requisitos de permisos" de la spec: [anónimo, editor, admin].
const MATRIZ = {
  'acceso.ingreso': [true, true, true],
  'acceso.definir_contrasena': [true, true, true],
  'panel.ver': [false, true, true],
  'articulo.crear': [false, true, true],
  'articulo.editar': [false, true, true],
  'articulo.vista_previa': [false, true, true],
  'articulo.cambiar_estado': [false, true, true],
  'articulo.eliminar': [false, false, true],
  'medio.subir': [false, true, true],
  'taxonomia.gestionar': [false, true, true],
  'perfil.editar_propio': [false, true, true],
  'equipo.ver': [false, false, true],
  'equipo.gestionar': [false, false, true],
} as const;

const casos = Object.entries(MATRIZ).flatMap(([accion, esperados]) =>
  ROLES.map((rol, i) => ({ accion, rol, esperado: esperados[i] as boolean })),
);

describe('ACCIONES', () => {
  it('CE-002: define exactamente las acciones de la tabla de permisos de la spec', () => {
    expect([...ACCIONES].sort()).toEqual(Object.keys(MATRIZ).sort());
  });
});

describe('puede', () => {
  it.each(casos)('CE-002: $accion con rol $rol es $esperado', ({ accion, rol, esperado }) => {
    expect(puede(rol, accion as (typeof ACCIONES)[number])).toBe(esperado);
  });

  it('CE-002: la matriz cubre cada acción de ACCIONES para los tres roles', () => {
    for (const accion of ACCIONES) {
      for (const rol of ROLES) {
        expect(typeof puede(rol, accion), `${accion} / ${rol}`).toBe('boolean');
      }
    }
  });

  it('RF-003: un anónimo (null) solo puede lo público: ingreso y definir contraseña', () => {
    const permitidas = ACCIONES.filter((accion) => puede(null, accion));

    expect([...permitidas].sort()).toEqual(['acceso.definir_contrasena', 'acceso.ingreso']);
  });

  it('RF-003: el admin puede todo lo que puede un editor', () => {
    for (const accion of ACCIONES) {
      if (puede('editor', accion)) expect(puede('admin', accion), accion).toBe(true);
    }
  });
});

describe('transicionesDe', () => {
  const ESPERADAS: Record<EstadoArticulo, EstadoArticulo[]> = {
    borrador: ['publicado', 'programado', 'archivado'],
    programado: ['borrador', 'archivado'],
    publicado: ['borrador', 'archivado'],
    archivado: ['borrador'],
  };

  it.each(Object.entries(ESPERADAS) as [EstadoArticulo, EstadoArticulo[]][])(
    'RF-009: desde %s ofrece exactamente %j',
    (estado, destinos) => {
      expect([...transicionesDe(estado)].sort()).toEqual([...destinos].sort());
    },
  );

  it('RF-009: ningún estado ofrece pasar a sí mismo', () => {
    for (const estado of Object.keys(ESPERADAS) as EstadoArticulo[]) {
      expect(transicionesDe(estado)).not.toContain(estado);
    }
  });
});
