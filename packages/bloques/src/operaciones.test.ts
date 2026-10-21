// T015 (spec 003): operaciones puras sobre la lista de bloques del editor (D12).
// Firmas supuestas (T031), exportadas desde './operaciones'; todas reciben el `Contenido` y devuelven
// un `Contenido` nuevo sin mutar el de entrada:
//   agregarBloque(contenido, tipo, posicion?)      -> inserta crearBloque(tipo); al final por defecto
//   moverBloque(contenido, indice, destino)         -> destino fuera de rango se recorta a [0, n - 1]
//   duplicarBloque(contenido, indice)               -> copia con id nuevo justo debajo del original
//   quitarBloque(contenido, indice)
//   actualizarBloque(contenido, indice, cambios)    -> mezcla `cambios` en el bloque (conserva id y tipo)
// Un índice inexistente deja el contenido igual (copia).
import { describe, expect, it } from 'vitest';
import type { Contenido } from './esquema';
import { actualizarBloque, agregarBloque, duplicarBloque, moverBloque, quitarBloque } from './operaciones';
import { crearBloque } from './utilidades';

function parrafo(texto: string) {
  return { ...crearBloque('parrafo'), texto };
}

/** Contenido de tres párrafos A, B y C, congelado: cualquier mutación lanza un error. */
function contenidoABC(): Contenido {
  return Object.freeze([parrafo('A'), parrafo('B'), parrafo('C')]) as unknown as Contenido;
}

const textos = (contenido: Contenido) => contenido.map((b) => (b.tipo === 'parrafo' ? b.texto : b.tipo));

describe('agregarBloque', () => {
  it('H2-E2: agrega al final por defecto un bloque del tipo pedido, con id', () => {
    const resultado = agregarBloque(contenidoABC(), 'separador');

    expect(resultado).toHaveLength(4);
    expect(resultado[3]).toMatchObject({ tipo: 'separador' });
    expect(resultado[3]?.id).toEqual(expect.any(String));
  });

  it('H2-E2: usa crearBloque (los valores iniciales del tipo)', () => {
    const resultado = agregarBloque([], 'titulo');

    expect(resultado[0]).toMatchObject({ tipo: 'titulo', nivel: 2, texto: '' });
  });

  it('H2-E2: con posicion inserta en ese lugar y corre el resto', () => {
    const resultado = agregarBloque(contenidoABC(), 'cita', 1);

    expect(resultado.map((b) => b.tipo)).toEqual(['parrafo', 'cita', 'parrafo', 'parrafo']);
    expect(textos(resultado)).toEqual(['A', 'cita', 'B', 'C']);
  });

  it('H2-E2: con posicion 0 inserta al principio', () => {
    expect(agregarBloque(contenidoABC(), 'separador', 0)[0]?.tipo).toBe('separador');
  });

  it('H2-E2: una posicion mayor que el largo agrega al final', () => {
    expect(agregarBloque(contenidoABC(), 'separador', 99)[3]?.tipo).toBe('separador');
  });

  it('H2-E2: no muta la entrada y devuelve un arreglo nuevo', () => {
    const entrada = contenidoABC();

    const resultado = agregarBloque(entrada, 'separador');

    expect(resultado).not.toBe(entrada);
    expect(entrada).toHaveLength(3);
  });
});

describe('moverBloque', () => {
  it('H2-E2: mueve un bloque hacia abajo', () => {
    expect(textos(moverBloque(contenidoABC(), 0, 1))).toEqual(['B', 'A', 'C']);
  });

  it('H2-E2: mueve un bloque hacia arriba', () => {
    expect(textos(moverBloque(contenidoABC(), 2, 1))).toEqual(['A', 'C', 'B']);
  });

  it('H2-E2: mueve un bloque a cualquier posición', () => {
    expect(textos(moverBloque(contenidoABC(), 0, 2))).toEqual(['B', 'C', 'A']);
  });

  it('H2-E2: subir el primer bloque no cambia nada', () => {
    const entrada = contenidoABC();

    const resultado = moverBloque(entrada, 0, -1);

    expect(textos(resultado)).toEqual(['A', 'B', 'C']);
    expect(resultado).not.toBe(entrada);
  });

  it('H2-E2: bajar el último bloque no cambia nada', () => {
    expect(textos(moverBloque(contenidoABC(), 2, 3))).toEqual(['A', 'B', 'C']);
  });

  it('H2-E2: un destino fuera de rango se recorta al extremo', () => {
    expect(textos(moverBloque(contenidoABC(), 0, 99))).toEqual(['B', 'C', 'A']);
    expect(textos(moverBloque(contenidoABC(), 2, -99))).toEqual(['C', 'A', 'B']);
  });

  it('H2-E2: conserva los mismos bloques (mismos ids)', () => {
    const entrada = contenidoABC();

    const resultado = moverBloque(entrada, 0, 2);

    expect(resultado.map((b) => b.id).sort()).toEqual(entrada.map((b) => b.id).sort());
  });
});

describe('duplicarBloque', () => {
  it('H2-E2: inserta una copia justo debajo del original', () => {
    const resultado = duplicarBloque(contenidoABC(), 1);

    expect(textos(resultado)).toEqual(['A', 'B', 'B', 'C']);
  });

  it('H2-E2: la copia tiene un id nuevo y el original conserva el suyo', () => {
    const entrada = contenidoABC();

    const resultado = duplicarBloque(entrada, 1);

    expect(resultado[1]?.id).toBe(entrada[1]?.id);
    expect(resultado[2]?.id).not.toBe(entrada[1]?.id);
    expect(new Set(resultado.map((b) => b.id)).size).toBe(4);
  });

  it('H2-E2: la copia es independiente del original (no comparte objetos anidados)', () => {
    const lista = { ...crearBloque('lista'), items: ['uno', 'dos'] };
    const entrada = Object.freeze([lista]) as unknown as Contenido;

    const resultado = duplicarBloque(entrada, 0);

    expect(resultado[1]).not.toBe(resultado[0]);
    expect((resultado[1] as typeof lista).items).not.toBe((resultado[0] as typeof lista).items);
  });

  it('H2-E2: no muta la entrada', () => {
    const entrada = contenidoABC();

    duplicarBloque(entrada, 0);

    expect(entrada).toHaveLength(3);
  });
});

describe('quitarBloque', () => {
  it('H2-E2: quita el bloque indicado y conserva el orden del resto', () => {
    expect(textos(quitarBloque(contenidoABC(), 1))).toEqual(['A', 'C']);
  });

  it('H2-E2: quita el primero y el último', () => {
    expect(textos(quitarBloque(contenidoABC(), 0))).toEqual(['B', 'C']);
    expect(textos(quitarBloque(contenidoABC(), 2))).toEqual(['A', 'B']);
  });

  it('H2-E2: un índice inexistente deja el contenido igual', () => {
    expect(textos(quitarBloque(contenidoABC(), 9))).toEqual(['A', 'B', 'C']);
  });

  it('H2-E2: no muta la entrada y devuelve un arreglo nuevo', () => {
    const entrada = contenidoABC();

    const resultado = quitarBloque(entrada, 1);

    expect(resultado).not.toBe(entrada);
    expect(entrada).toHaveLength(3);
  });
});

describe('actualizarBloque', () => {
  it('H2-E2: cambia solo los campos indicados del bloque', () => {
    const entrada = contenidoABC();

    const resultado = actualizarBloque(entrada, 1, { texto: 'B editado' });

    expect(textos(resultado)).toEqual(['A', 'B editado', 'C']);
    expect(resultado[1]?.id).toBe(entrada[1]?.id);
    expect(resultado[1]?.tipo).toBe('parrafo');
  });

  it('H2-E2: conserva el orden y los demás bloques', () => {
    const entrada = contenidoABC();

    const resultado = actualizarBloque(entrada, 1, { texto: 'otro' });

    expect(resultado[0]).toEqual(entrada[0]);
    expect(resultado[2]).toEqual(entrada[2]);
  });

  it('H2-E2: no muta la entrada ni el bloque original', () => {
    const entrada = contenidoABC();

    const resultado = actualizarBloque(entrada, 0, { texto: 'nuevo' });

    expect(resultado).not.toBe(entrada);
    expect(resultado[0]).not.toBe(entrada[0]);
    expect(textos(entrada)).toEqual(['A', 'B', 'C']);
  });

  it('H2-E2: un índice inexistente deja el contenido igual', () => {
    expect(textos(actualizarBloque(contenidoABC(), 9, { texto: 'x' }))).toEqual(['A', 'B', 'C']);
  });
});
