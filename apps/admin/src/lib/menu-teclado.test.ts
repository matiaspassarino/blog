// T021 (spec 005, RF-003, RF-005, RF-007; contracts/componentes.md "lib/menu-teclado.ts"; contracts/atajos.md
// "Botón «Acciones» de la barra"): las funciones puras de `useMenuTeclado`: a qué ítem va el foco con las flechas,
// `Inicio`, `Fin` y al escribir una letra (typeahead). El hook (React) se prueba en E2E.
// FASE ROJA: `./menu-teclado` no existe. API supuesta (todas devuelven un índice, o -1 si no hay a dónde ir):
//   type ItemMenu = { etiqueta: string; deshabilitado?: boolean }
//   indiceSiguiente(items, actual)   flecha abajo; con vuelta al principio; salta deshabilitados; actual -1 = sin foco
//   indiceAnterior(items, actual)    flecha arriba; con vuelta al final; salta deshabilitados; actual -1 = sin foco
//   indicePrimero(items)             Inicio: primer ítem habilitado
//   indiceUltimo(items)              Fin: último ítem habilitado
//   indicePorLetra(items, actual, escrito)
//     typeahead: siguiente ítem habilitado (después de `actual`, con vuelta) cuya etiqueta empieza con `escrito`,
//     sin distinguir tildes ni mayúsculas.
import { describe, expect, it } from 'vitest';
import {
  indiceAnterior,
  indicePorLetra,
  indicePrimero,
  indiceSiguiente,
  indiceUltimo,
  type ItemMenu,
} from './menu-teclado';

const items = (...etiquetas: string[]): ItemMenu[] => etiquetas.map((etiqueta) => ({ etiqueta }));
const conDeshabilitados = (...etiquetas: string[]): ItemMenu[] =>
  etiquetas.map((etiqueta) => (etiqueta.startsWith('!') ? { etiqueta: etiqueta.slice(1), deshabilitado: true } : { etiqueta }));

const ACCIONES = items('Subir', 'Bajar', 'Duplicar', 'Convertir en…', 'Quitar', 'Seleccionar', 'Propiedades', 'Atajos');

describe('indiceSiguiente (flecha abajo)', () => {
  it('avanza al ítem siguiente', () => {
    expect(indiceSiguiente(ACCIONES, 0)).toBe(1);
    expect(indiceSiguiente(ACCIONES, 5)).toBe(6);
  });

  it('da la vuelta al principio desde el último', () => {
    expect(indiceSiguiente(ACCIONES, ACCIONES.length - 1)).toBe(0);
  });

  it('sin foco todavía (-1) va al primero', () => {
    expect(indiceSiguiente(ACCIONES, -1)).toBe(0);
  });

  it('salta los ítems deshabilitados', () => {
    const lista = conDeshabilitados('Subir', '!Bajar', '!Duplicar', 'Quitar');

    expect(indiceSiguiente(lista, 0)).toBe(3);
  });

  it('da la vuelta saltando deshabilitados al principio', () => {
    const lista = conDeshabilitados('!Subir', 'Bajar', 'Quitar');

    expect(indiceSiguiente(lista, 2)).toBe(1);
  });

  it('con un solo ítem habilitado se queda en él', () => {
    const lista = conDeshabilitados('!Subir', 'Bajar', '!Quitar');

    expect(indiceSiguiente(lista, 1)).toBe(1);
  });

  it('con todos deshabilitados o sin ítems devuelve -1', () => {
    expect(indiceSiguiente(conDeshabilitados('!A', '!B'), 0)).toBe(-1);
    expect(indiceSiguiente([], -1)).toBe(-1);
  });
});

describe('indiceAnterior (flecha arriba)', () => {
  it('retrocede al ítem anterior', () => {
    expect(indiceAnterior(ACCIONES, 3)).toBe(2);
  });

  it('da la vuelta al final desde el primero', () => {
    expect(indiceAnterior(ACCIONES, 0)).toBe(ACCIONES.length - 1);
  });

  it('sin foco todavía (-1) va al último', () => {
    expect(indiceAnterior(ACCIONES, -1)).toBe(ACCIONES.length - 1);
  });

  it('salta los ítems deshabilitados', () => {
    const lista = conDeshabilitados('Subir', '!Bajar', '!Duplicar', 'Quitar');

    expect(indiceAnterior(lista, 3)).toBe(0);
  });

  it('da la vuelta saltando deshabilitados al final', () => {
    const lista = conDeshabilitados('Subir', 'Bajar', '!Quitar');

    expect(indiceAnterior(lista, 0)).toBe(1);
  });

  it('con todos deshabilitados o sin ítems devuelve -1', () => {
    expect(indiceAnterior(conDeshabilitados('!A', '!B'), 1)).toBe(-1);
    expect(indiceAnterior([], -1)).toBe(-1);
  });
});

describe('indicePrimero e indiceUltimo (Inicio y Fin)', () => {
  it('Inicio va al primer ítem', () => {
    expect(indicePrimero(ACCIONES)).toBe(0);
  });

  it('Fin va al último ítem', () => {
    expect(indiceUltimo(ACCIONES)).toBe(ACCIONES.length - 1);
  });

  it('Inicio salta los deshabilitados del principio', () => {
    expect(indicePrimero(conDeshabilitados('!Subir', '!Bajar', 'Duplicar', 'Quitar'))).toBe(2);
  });

  it('Fin salta los deshabilitados del final', () => {
    expect(indiceUltimo(conDeshabilitados('Subir', 'Bajar', '!Quitar', '!Atajos'))).toBe(1);
  });

  it('sin ítems habilitados devuelven -1', () => {
    expect(indicePrimero([])).toBe(-1);
    expect(indiceUltimo(conDeshabilitados('!A'))).toBe(-1);
  });
});

describe('indicePorLetra (typeahead)', () => {
  it('va al primer ítem que empieza con la letra', () => {
    expect(indicePorLetra(ACCIONES, -1, 'd')).toBe(2);
    expect(indicePorLetra(ACCIONES, -1, 'q')).toBe(4);
  });

  it('no distingue mayúsculas', () => {
    expect(indicePorLetra(ACCIONES, -1, 'D')).toBe(2);
    expect(indicePorLetra(items('subir', 'BAJAR'), -1, 'b')).toBe(1);
  });

  it('no distingue tildes en la escritura ni en la etiqueta', () => {
    const lista = items('Árbol', 'Ñandú', 'Épica', 'Óleo');

    expect(indicePorLetra(lista, -1, 'a')).toBe(0);
    expect(indicePorLetra(lista, -1, 'Á')).toBe(0);
    expect(indicePorLetra(lista, -1, 'e')).toBe(2);
    expect(indicePorLetra(lista, -1, 'é')).toBe(2);
    expect(indicePorLetra(lista, -1, 'o')).toBe(3);
  });

  it('la misma letra otra vez pasa al siguiente ítem que empieza igual (con vuelta)', () => {
    const lista = items('Párrafo', 'Propiedades', 'Subir', 'Pegar');

    expect(indicePorLetra(lista, -1, 'p')).toBe(0);
    expect(indicePorLetra(lista, 0, 'p')).toBe(1);
    expect(indicePorLetra(lista, 1, 'p')).toBe(3);
    expect(indicePorLetra(lista, 3, 'p')).toBe(0);
  });

  it('varias letras buscan el prefijo completo', () => {
    expect(indicePorLetra(ACCIONES, -1, 'du')).toBe(2);
    expect(indicePorLetra(ACCIONES, -1, 'sel')).toBe(5);
    expect(indicePorLetra(ACCIONES, -1, 'pro')).toBe(6);
  });

  it('salta los ítems deshabilitados aunque coincidan', () => {
    const lista = conDeshabilitados('!Duplicar', 'Descartar', 'Quitar');

    expect(indicePorLetra(lista, -1, 'd')).toBe(1);
  });

  it('devuelve -1 si ningún ítem habilitado coincide', () => {
    expect(indicePorLetra(ACCIONES, -1, 'z')).toBe(-1);
    expect(indicePorLetra(conDeshabilitados('!Duplicar'), -1, 'd')).toBe(-1);
    expect(indicePorLetra([], -1, 'a')).toBe(-1);
  });

  it('un texto vacío no coincide con nada', () => {
    expect(indicePorLetra(ACCIONES, -1, '')).toBe(-1);
  });
});
