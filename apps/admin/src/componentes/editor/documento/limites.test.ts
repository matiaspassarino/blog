// T145 (spec 005, Fase 14, Historia 4; contracts/atajos.md "Límite de caracteres" y CE-006):
// pruebas unitarias de límites de caracteres y elementos:
// - límites de caracteres por tipo (párrafo 5000, título 150, cita 1000, ítem 500, celda 1000, código 20 000)
// - el conteo es del texto sin marcas
// - avisos al cruzar el 90 % y el 100 % sin repetirse
// - límite de 200 elementos en el documento
//
// FASE ROJA: este test se escribe antes de implementar `limites.ts` (T149).
import { describe, expect, it } from 'vitest';
import {
  calcularAvisoLimite,
  contarCaracteresTexto,
  LIMITES_ELEMENTO,
  MAXIMO_ELEMENTOS_DOCUMENTO,
  puedeAgregarElemento,
  RastreadorDeAvisosLimite,
} from './limites';

describe('LIMITES_ELEMENTO: topes por tipo según contrato', () => {
  it('define los límites exactos de caracteres para cada tipo', () => {
    expect(LIMITES_ELEMENTO.paragraph).toBe(5000);
    expect(LIMITES_ELEMENTO.heading).toBe(150);
    expect(LIMITES_ELEMENTO.blockquote).toBe(1000);
    expect(LIMITES_ELEMENTO.listItem).toBe(500);
    expect(LIMITES_ELEMENTO.codeBlock).toBe(20000);
    expect(LIMITES_ELEMENTO.tableCell).toBe(1000);
    expect(LIMITES_ELEMENTO.tableHeader).toBe(1000);
  });
});

describe('contarCaracteresTexto: cuenta solo el texto visible, sin marcas', () => {
  it('cuenta los caracteres de un texto simple', () => {
    expect(contarCaracteresTexto('Hola mundo')).toBe(10);
  });

  it('cuenta los caracteres de nodos con marcas ignorando las marcas', () => {
    const nodos = [
      { type: 'text', text: 'Hola ' },
      { type: 'text', text: 'mundo', marks: [{ type: 'bold' }, { type: 'underline' }] },
      { type: 'text', text: '!', marks: [{ type: 'bold' }] },
    ];
    expect(contarCaracteresTexto(nodos)).toBe(11);
  });

  it('cuenta cadenas anidadas en celdas de tabla sumando los párrafos internos', () => {
    const celda = {
      type: 'tableCell',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Primer párrafo.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Segundo párrafo.' }] },
      ],
    };
    expect(contarCaracteresTexto(celda)).toBe(31);
  });
});

describe('calcularAvisoLimite: avisos al cruzar 90 % y 100 %', () => {
  it('por debajo del 90 % no hay aviso', () => {
    // 4000 caracteres en un párrafo de 5000 (80 %)
    const aviso = calcularAvisoLimite('paragraph', 4000);
    expect(aviso).toBeNull();
  });

  it('al cruzar el 90 % avisa cuántos caracteres quedan', () => {
    // 4500 de 5000 (90 %) -> quedan 500
    const aviso = calcularAvisoLimite('paragraph', 4500);
    expect(aviso).toBe('Quedan 500 caracteres');

    // 135 de 150 en título (90 %) -> quedan 15
    const avisoTitulo = calcularAvisoLimite('heading', 135);
    expect(avisoTitulo).toBe('Quedan 15 caracteres');
  });

  it('al cruzar el 100 % avisa que se alcanzó el máximo del tipo', () => {
    expect(calcularAvisoLimite('paragraph', 5000)).toBe('Se alcanzó el máximo de caracteres del párrafo');
    expect(calcularAvisoLimite('heading', 150)).toBe('Se alcanzó el máximo de caracteres del título');
    expect(calcularAvisoLimite('blockquote', 1000)).toBe('Se alcanzó el máximo de caracteres de la cita');
    expect(calcularAvisoLimite('listItem', 500)).toBe('Se alcanzó el máximo de caracteres del ítem');
    expect(calcularAvisoLimite('codeBlock', 20000)).toBe('Se alcanzó el máximo de caracteres del bloque de código');
    expect(calcularAvisoLimite('tableCell', 1000)).toBe('Se alcanzó el máximo de caracteres de la celda');
  });
});

describe('RastreadorDeAvisosLimite: no repite avisos en cada pulsación de tecla', () => {
  it('anuncia una sola vez al cruzar el 90 % y no repite mientras se siga en ese rango', () => {
    const rastreador = new RastreadorDeAvisosLimite();
    const idElemento = 'elem-1';

    // Cruza el 90% (4500)
    const aviso1 = rastreador.verificar(idElemento, 'paragraph', 4500);
    expect(aviso1).toBe('Quedan 500 caracteres');

    // Sigue escribiendo (4501, 4502...) no repite
    const aviso2 = rastreador.verificar(idElemento, 'paragraph', 4501);
    expect(aviso2).toBeNull();
    const aviso3 = rastreador.verificar(idElemento, 'paragraph', 4700);
    expect(aviso3).toBeNull();

    // Llega al 100% (5000) -> avisa una sola vez
    const aviso100 = rastreador.verificar(idElemento, 'paragraph', 5000);
    expect(aviso100).toBe('Se alcanzó el máximo de caracteres del párrafo');

    // Intenta seguir en 5000 -> no repite
    const avisoRepetido = rastreador.verificar(idElemento, 'paragraph', 5000);
    expect(avisoRepetido).toBeNull();

    // Borra hasta por debajo del 90% (4000)
    rastreador.verificar(idElemento, 'paragraph', 4000);

    // Vuelve a subir al 90% (4505) -> vuelve a avisar porque volvió a cruzar
    const avisoReingreso = rastreador.verificar(idElemento, 'paragraph', 4505);
    expect(avisoReingreso).toBe('Quedan 495 caracteres');
  });
});

describe('puedeAgregarElemento: límite máximo de 200 elementos (contracts/atajos.md y CE-006)', () => {
  it('el límite máximo es 200', () => {
    expect(MAXIMO_ELEMENTOS_DOCUMENTO).toBe(200);
  });

  it('permite agregar si el total actual es menor a 200', () => {
    expect(puedeAgregarElemento(199)).toBe(true);
    expect(puedeAgregarElemento(0)).toBe(true);
    expect(puedeAgregarElemento(50)).toBe(true);
  });

  it('rechaza agregar si el total ya llegó a 200 y devuelve el aviso correspondiente', () => {
    let aviso = '';
    const pudo = puedeAgregarElemento(200, { alRechazar: (msg) => (aviso = msg) });
    expect(pudo).toBe(false);
    expect(aviso).toBe('Se alcanzó el máximo de 200 elementos');
  });

  it('rechaza agregar múltiples elementos si superaría el límite de 200', () => {
    let aviso = '';
    const pudo = puedeAgregarElemento(195, { agregar: 10, alRechazar: (msg) => (aviso = msg) });
    expect(pudo).toBe(false);
    expect(aviso).toBe('Se alcanzó el máximo de 200 elementos');
  });
});
