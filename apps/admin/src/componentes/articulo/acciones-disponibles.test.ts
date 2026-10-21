// T067 y T072 (spec 003, H3-E7, E8, RF-012, RF-015): qué botones muestra AccionesEstado. Lógica pura.
// FASE ROJA: `./acciones-disponibles` no existe aún.
//
// Firmas supuestas, exportadas desde `componentes/articulo/acciones-disponibles.ts` (sin React):
//   type AccionEstado = 'publicar' | 'programar' | 'cancelar_programacion' | 'volver_a_borrador' | 'archivar' | 'eliminar'
//   accionesDisponibles({ estado: EstadoArticulo, rol: RolMiembro | null, hayCambiosSinGuardar: boolean }): {
//     acciones: AccionEstado[];            // en este orden: las transiciones de estado y, al final, 'eliminar'
//     requiereGuardarAntes: boolean;       // = hayCambiosSinGuardar: el panel pide guardar antes de cambiar el estado
//   }
//   destinoDe(accion: Exclude<AccionEstado, 'eliminar'>): EstadoArticulo
//     publicar -> 'publicado', programar -> 'programado', archivar -> 'archivado',
//     cancelar_programacion y volver_a_borrador -> 'borrador'.
// Fuente de verdad: la tabla de data-model.md ("Estados y transiciones") con `transicionesDe` y `puede` de @blog/db.
// Un rol `null` (anónimo o miembro desactivado) no ve ninguna acción.
import { transicionesDe, type EstadoArticulo, type RolMiembro } from '@blog/db';
import { describe, expect, it } from 'vitest';
import { accionesDisponibles, destinoDe } from './acciones-disponibles';

const ESTADOS: EstadoArticulo[] = ['borrador', 'programado', 'publicado', 'archivado'];
const consultar = (estado: EstadoArticulo, rol: RolMiembro | null, hayCambiosSinGuardar = false) =>
  accionesDisponibles({ estado, rol, hayCambiosSinGuardar });

describe('accionesDisponibles (H3-E7, RF-012)', () => {
  it.each([
    ['borrador', ['publicar', 'programar']],
    ['programado', ['cancelar_programacion', 'publicar']],
    ['publicado', ['volver_a_borrador', 'archivar']],
    ['archivado', ['volver_a_borrador']],
  ] as const)('H3-E7: un editor en %s ve solo %j', (estado, esperadas) => {
    expect(consultar(estado, 'editor').acciones).toEqual(esperadas);
  });

  it.each(ESTADOS)('H3-E8: el editor nunca ve "eliminar" (%s)', (estado) => {
    expect(consultar(estado, 'editor').acciones).not.toContain('eliminar');
  });

  it.each(ESTADOS)('H3-E8: el admin ve las mismas transiciones más "eliminar" al final (%s)', (estado) => {
    const delEditor = consultar(estado, 'editor').acciones;

    expect(consultar(estado, 'admin').acciones).toEqual([...delEditor, 'eliminar']);
  });

  it.each(ESTADOS)('un rol nulo no ve ninguna acción (%s)', (estado) => {
    expect(consultar(estado, null).acciones).toEqual([]);
  });

  it.each(ESTADOS)('las transiciones ofrecidas llevan a estados que permite la matriz de @blog/db (%s)', (estado) => {
    const destinos = consultar(estado, 'admin')
      .acciones.filter((a) => a !== 'eliminar')
      .map((a) => destinoDe(a as Exclude<typeof a, 'eliminar'>));

    expect([...destinos].sort()).toEqual([...transicionesDe(estado)].sort());
  });

  it('con cambios sin guardar pide guardar antes; sin cambios, no', () => {
    expect(consultar('borrador', 'editor', true).requiereGuardarAntes).toBe(true);
    expect(consultar('borrador', 'editor', false).requiereGuardarAntes).toBe(false);
  });

  it('los cambios sin guardar no cambian qué acciones se ofrecen', () => {
    expect(consultar('publicado', 'admin', true).acciones).toEqual(consultar('publicado', 'admin', false).acciones);
  });
});

describe('destinoDe', () => {
  it.each([
    ['publicar', 'publicado'],
    ['programar', 'programado'],
    ['archivar', 'archivado'],
    ['cancelar_programacion', 'borrador'],
    ['volver_a_borrador', 'borrador'],
  ] as const)('%s lleva a %s', (accion, destino) => {
    expect(destinoDe(accion)).toBe(destino);
  });
});
