// T067 y T072 (spec 003, H3-E7, E8, RF-012, RF-015): qué acciones de estado se ofrecen. Lógica pura.
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
import {
  accionesDisponibles,
  accionPrincipalEditor,
  destinoDe,
  distribuirBarraEditor,
  guardarHabilitado,
  type AccionBarra,
} from './acciones-disponibles';

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

// T013 (spec 004, RF-005, RF-019, H1 esc. 2 y 3; research D7; data-model.md "Acción principal del editor" y "Barra del
// editor").
//
// Firmas supuestas (contracts/componentes.md):
//   type AccionBarra = 'guardar' | AccionEstado | 'vista_previa'
//   accionPrincipalEditor({ estado, guardado, hayCambiosSinGuardar }): 'guardar' | 'publicar'
//   guardarHabilitado({ guardado, hayCambiosSinGuardar, ocupado }): boolean
//   distribuirBarraEditor({ estado, rol, guardado, hayCambiosSinGuardar }): { enBarra: AccionBarra[]; enMenu: AccionBarra[] }
describe('accionPrincipalEditor (RF-005, H1 esc. 2 y 3)', () => {
  const principal = (estado: EstadoArticulo, guardado: boolean, hayCambiosSinGuardar: boolean) =>
    accionPrincipalEditor({ estado, guardado, hayCambiosSinGuardar });

  it.each([true, false])(
    'RF-005: un artículo nuevo (sin guardar) siempre tiene "guardar" como principal (cambios: %s)',
    (cambios) => {
      expect(principal('borrador', false, cambios)).toBe('guardar');
    },
  );

  it('H1-E3: un borrador guardado sin cambios tiene "publicar" como principal', () => {
    expect(principal('borrador', true, false)).toBe('publicar');
  });

  it('H1-E3: al modificar cualquier campo de un borrador, "guardar" pasa a ser la principal', () => {
    expect(principal('borrador', true, true)).toBe('guardar');
  });

  it.each(['programado', 'publicado', 'archivado'] as const)(
    'RF-005: un artículo %s tiene "guardar" como principal, con y sin cambios',
    (estado) => {
      expect(principal(estado, true, false)).toBe('guardar');
      expect(principal(estado, true, true)).toBe('guardar');
    },
  );
});

describe('guardarHabilitado (RF-005, casos borde)', () => {
  it('un artículo nuevo siempre puede guardar (muestra qué falta completar), salvo que esté ocupado', () => {
    expect(guardarHabilitado({ guardado: false, hayCambiosSinGuardar: false, ocupado: false })).toBe(true);
    expect(guardarHabilitado({ guardado: false, hayCambiosSinGuardar: true, ocupado: false })).toBe(true);
    expect(guardarHabilitado({ guardado: false, hayCambiosSinGuardar: true, ocupado: true })).toBe(false);
  });

  it('un artículo guardado solo puede guardar con cambios', () => {
    expect(guardarHabilitado({ guardado: true, hayCambiosSinGuardar: true, ocupado: false })).toBe(true);
    expect(guardarHabilitado({ guardado: true, hayCambiosSinGuardar: false, ocupado: false })).toBe(false);
  });

  it('un artículo guardado ocupado no puede guardar, aunque tenga cambios', () => {
    expect(guardarHabilitado({ guardado: true, hayCambiosSinGuardar: true, ocupado: true })).toBe(false);
    expect(guardarHabilitado({ guardado: true, hayCambiosSinGuardar: false, ocupado: true })).toBe(false);
  });
});

describe('distribuirBarraEditor (RF-005, RF-019; orden fijo y qué va a "Más acciones")', () => {
  type Caso = { estado: EstadoArticulo; enBarra: AccionBarra[]; enMenu: AccionBarra[] };
  // Orden fijo: Guardar · Publicar · (Programar | Cancelar programación | Volver a borrador) · Archivar · Vista previa · Eliminar.
  // En la barra quedan "Guardar" y la primera transición del orden fijo; el resto va al menú (data-model.md).
  const CASOS: Caso[] = [
    { estado: 'borrador', enBarra: ['guardar', 'publicar'], enMenu: ['programar', 'vista_previa'] },
    { estado: 'programado', enBarra: ['guardar', 'publicar'], enMenu: ['cancelar_programacion', 'vista_previa'] },
    { estado: 'publicado', enBarra: ['guardar', 'volver_a_borrador'], enMenu: ['archivar', 'vista_previa'] },
    { estado: 'archivado', enBarra: ['guardar', 'volver_a_borrador'], enMenu: ['vista_previa'] },
  ];
  const distribuir = (estado: EstadoArticulo, rol: RolMiembro | null, hayCambiosSinGuardar: boolean) =>
    distribuirBarraEditor({ estado, rol, guardado: true, hayCambiosSinGuardar });

  describe.each(CASOS)('un $estado guardado', ({ estado, enBarra, enMenu }) => {
    it.each([true, false])(
      'RF-019: un editor ve en la barra solo guardar y la primera transición, y el resto en el menú sin eliminar (cambios: %s)',
      (cambios) => {
        expect(distribuir(estado, 'editor', cambios)).toEqual({ enBarra, enMenu });
      },
    );

    it.each([true, false])('RF-005: el admin suma "eliminar" al final del menú (cambios: %s)', (cambios) => {
      expect(distribuir(estado, 'admin', cambios)).toEqual({ enBarra, enMenu: [...enMenu, 'eliminar'] });
    });

    it.each(['editor', 'admin'] as const)('el orden fijo se conserva al juntar barra y menú (%s)', (rol) => {
      const { enBarra: barra, enMenu: menu } = distribuir(estado, rol, false);
      const todas = [...barra, ...menu];

      expect(todas[0]).toBe('guardar');
      expect(todas.at(-1)).toBe(rol === 'admin' ? 'eliminar' : 'vista_previa');
      expect(todas.indexOf('vista_previa')).toBe(rol === 'admin' ? todas.length - 2 : todas.length - 1);
      expect(new Set(todas).size, 'sin acciones repetidas').toBe(todas.length);
    });

    it('"guardar" siempre está en la barra y en la primera posición', () => {
      expect(distribuir(estado, 'admin', false).enBarra[0]).toBe('guardar');
    });
  });

  it('H1-E2: las acciones de estado son las de accionesDisponibles (nada de más, nada de menos)', () => {
    for (const { estado } of CASOS) {
      const { enBarra, enMenu } = distribuir(estado, 'admin', false);
      const deEstado = [...enBarra, ...enMenu].filter((a) => a !== 'guardar' && a !== 'vista_previa');

      expect([...deEstado].sort()).toEqual([...consultar(estado, 'admin').acciones].sort());
    }
  });

  it('"eliminar" nunca está en la barra: solo el admin lo ve, al final y en el menú', () => {
    for (const { estado } of CASOS) {
      expect(distribuir(estado, 'admin', false).enBarra).not.toContain('eliminar');
      expect(distribuir(estado, 'editor', false).enMenu).not.toContain('eliminar');
    }
  });

  describe('un artículo nuevo (sin guardar)', () => {
    const nuevo = (rol: RolMiembro, hayCambiosSinGuardar: boolean) =>
      distribuirBarraEditor({ estado: 'borrador', rol, guardado: false, hayCambiosSinGuardar });

    it.each(['editor', 'admin'] as const)(
      'RF-005: solo tiene "guardar" en la barra y el menú queda vacío (%s)',
      (rol) => {
        expect(nuevo(rol, false)).toEqual({ enBarra: ['guardar'], enMenu: [] });
        expect(nuevo(rol, true)).toEqual({ enBarra: ['guardar'], enMenu: [] });
      },
    );

    it('no tiene "vista previa" ni "eliminar", tampoco para el admin', () => {
      const { enBarra, enMenu } = nuevo('admin', true);

      expect([...enBarra, ...enMenu]).not.toContain('vista_previa');
      expect([...enBarra, ...enMenu]).not.toContain('eliminar');
    });
  });
});
