// T037 (spec 005, RF-005; contracts/componentes.md "MenuInsertar y menu-insercion.ts"): la lista de elementos
// insertables y su filtro, puros. El menú (React, foco, teclado) se prueba en E2E.
// FASE ROJA: `./menu-insercion` no existe. API supuesta:
//   type ItemDeInsercion = { id: string; nombre: string; descripcion: string; grupo: 'texto' | 'especial'; insertar: (editor) => void }
//   ITEMS: ItemDeInsercion[]            en este orden de grupos: texto primero y especiales después
//   filtrarItems(consulta: string): ItemDeInsercion[]
//     sin tildes ni mayúsculas, por nombre y descripción; consulta vacía = todos; los que coinciden por nombre van
//     antes que los que coinciden solo por descripción; ignora una «/» inicial (la consulta de `@tiptap/suggestion`
//     no la trae, pero escribir «/tit» a mano debe dar lo mismo que «tit»).
// Ids supuestos (el prefijo es el `TipoBloque` de @blog/bloques, para no repetir los nombres en una tabla paralela):
//   parrafo · titulo-2 · titulo-3 · titulo-4 · cita · lista-vinietas · lista-numerada · imagen · galeria · cta · video ·
//   codigo · separador
// Los nombres salen de `nombreDeTipo` (../anuncios): el nombre de cada item empieza con el nombre del tipo (con
// mayúscula inicial), sin una tabla de nombres propia.
import type { TipoBloque } from '@blog/bloques';
import { describe, expect, it } from 'vitest';
import { nombreDeTipo } from '../anuncios';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { estadoDe, imagen, parrafo, posDe } from './esquema-prueba';
import { elementoDeLaSeleccion, filtrarItems, ITEMS } from './menu-insercion';

const sinTildes = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const ids = (items: { id: string }[]) => items.map((item) => item.id);
const tipoDe = (id: string) => id.split('-')[0] as TipoBloque;

describe('ITEMS: la lista única de elementos insertables (RF-005)', () => {
  it('tiene los trece elementos del contrato', () => {
    expect(ids(ITEMS).sort()).toEqual(
      [
        'parrafo',
        'titulo-2',
        'titulo-3',
        'titulo-4',
        'cita',
        'lista-vinietas',
        'lista-numerada',
        'imagen',
        'galeria',
        'cta',
        'video',
        'codigo',
        'separador',
      ].sort(),
    );
  });

  it('los ids no se repiten y cada elemento tiene nombre, descripción corta y una función para insertar', () => {
    expect(new Set(ids(ITEMS)).size).toBe(ITEMS.length);
    for (const item of ITEMS) {
      expect(item.nombre.trim(), item.id).not.toBe('');
      expect(item.descripcion.trim(), item.id).not.toBe('');
      expect(item.descripcion.length, item.id).toBeLessThanOrEqual(80);
      expect(typeof item.insertar, item.id).toBe('function');
    }
  });

  it('los nombres salen de nombreDeTipo (sin tabla paralela)', () => {
    for (const item of ITEMS) {
      const nombreDelTipo = nombreDeTipo(tipoDe(item.id));
      expect(sinTildes(item.nombre).startsWith(sinTildes(nombreDelTipo)), `${item.id}: «${item.nombre}»`).toBe(true);
    }
  });

  it('los estilos de texto van en el grupo «texto» y imagen, galería, llamada a la acción y video en «especial»', () => {
    const grupoDe = (id: string) => ITEMS.find((item) => item.id === id)?.grupo;
    for (const id of ['parrafo', 'titulo-2', 'titulo-3', 'titulo-4', 'cita', 'lista-vinietas', 'lista-numerada']) {
      expect(grupoDe(id), id).toBe('texto');
    }
    for (const id of ['imagen', 'galeria', 'cta', 'video']) expect(grupoDe(id), id).toBe('especial');
  });
});

describe('filtrarItems: sin tildes ni mayúsculas, por nombre y descripción (RF-005)', () => {
  it('una consulta vacía devuelve todos los elementos', () => {
    expect(ids(filtrarItems(''))).toEqual(ids(ITEMS));
  });

  it('«tit» encuentra los tres títulos, antes que cualquier otro', () => {
    const encontrados = ids(filtrarItems('tit'));

    expect(encontrados.slice(0, 3)).toEqual(['titulo-2', 'titulo-3', 'titulo-4']);
  });

  it('escribir «/tit» a mano da lo mismo que «tit»', () => {
    expect(ids(filtrarItems('/tit'))).toEqual(ids(filtrarItems('tit')));
  });

  it('«zzz» da una lista vacía', () => {
    expect(filtrarItems('zzz')).toEqual([]);
    expect(filtrarItems('/zzz')).toEqual([]);
  });

  it('no distingue mayúsculas ni tildes: «galeria», «GALERÍA» y «Galería» dan lo mismo', () => {
    const base = ids(filtrarItems('galeria'));

    expect(base).toContain('galeria');
    expect(ids(filtrarItems('GALERÍA'))).toEqual(base);
    expect(ids(filtrarItems('Galería'))).toEqual(base);
  });

  it('«accion» encuentra «Llamada a la acción» y «vinetas» encuentra la lista con viñetas', () => {
    expect(ids(filtrarItems('accion'))).toContain('cta');
    expect(ids(filtrarItems('vinetas'))).toContain('lista-vinietas');
    expect(ids(filtrarItems('codigo'))).toContain('codigo');
  });

  it('cada elemento se encuentra por su nombre completo, por su descripción y en mayúsculas', () => {
    for (const item of ITEMS) {
      expect(ids(filtrarItems(item.nombre)), `nombre de ${item.id}`).toContain(item.id);
      expect(ids(filtrarItems(item.nombre.toUpperCase())), `nombre en mayúsculas de ${item.id}`).toContain(item.id);
      expect(ids(filtrarItems(item.descripcion)), `descripción de ${item.id}`).toContain(item.id);
      expect(ids(filtrarItems(sinTildes(item.descripcion))), `descripción sin tildes de ${item.id}`).toContain(item.id);
    }
  });

  it('no modifica la lista original', () => {
    const antes = ids(ITEMS);

    filtrarItems('tit');
    filtrarItems('zzz');

    expect(ids(ITEMS)).toEqual(antes);
  });
});

describe('elementoDeLaSeleccion: después de qué elemento se inserta', () => {
  const base = () => estadoDe(parrafo('a', 'Uno'), imagen('b', 'medios/b.webp'), parrafo('c', 'Tres'));

  it('con el cursor en un párrafo, es ese párrafo', () => {
    const estado = base();
    const conCursor = estado.apply(estado.tr.setSelection(TextSelection.create(estado.doc, posDe(estado, 2) + 2)));
    const { actual, inicio } = elementoDeLaSeleccion(conCursor);
    expect(actual.attrs.bloqueId).toBe('c');
    expect(inicio).toBe(posDe(estado, 2));
  });

  it('con una isla seleccionada entera (profundidad 0), es la isla', () => {
    const estado = base();
    const conIsla = estado.apply(estado.tr.setSelection(NodeSelection.create(estado.doc, posDe(estado, 1))));
    const { actual, inicio } = elementoDeLaSeleccion(conIsla);
    expect(actual.attrs.bloqueId).toBe('b');
    expect(inicio).toBe(posDe(estado, 1));
  });
});
