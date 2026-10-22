// T023: textoPlano y crearBloque (contracts/bloques.md, "Exportaciones"; research D9).
import { describe, expect, it } from 'vitest';
import { esquemaBloque } from './esquema';
import { TIPOS_BLOQUE } from './index';
import { crearBloque, textoPlano } from './utilidades';
import type { Contenido } from './index';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const id = () => crypto.randomUUID();

const contenido = [
  {
    id: id(),
    tipo: 'parrafo',
    texto: 'Hola **mundo** con _estilo_, un [enlace útil](https://ejemplo.com/destino) y `npm install`.',
  },
  { id: id(), tipo: 'titulo', nivel: 2, texto: 'Sección principal' },
  { id: id(), tipo: 'codigo', codigo: 'const secretoDelCodigo = 42;', lenguaje: 'ts' },
  { id: id(), tipo: 'cita', texto: 'La simplicidad es la **máxima** sofisticación.', autor: 'Leonardo' },
  { id: id(), tipo: 'separador' },
  { id: id(), tipo: 'lista', ordenada: false, items: ['Primer _punto_', 'Segundo [punto](https://ejemplo.com/2)'] },
] as unknown as Contenido;

describe('textoPlano', () => {
  const resultado = textoPlano(contenido);

  it('incluye el texto de parrafo, titulo, cita y lista sin marcas Markdown', () => {
    expect(resultado).toContain('Hola mundo con estilo, un enlace útil y npm install.');
    expect(resultado).toContain('Sección principal');
    expect(resultado).toContain('La simplicidad es la máxima sofisticación.');
    expect(resultado).toContain('Primer punto');
    expect(resultado).toContain('Segundo punto');
  });

  it('respeta el orden de los bloques', () => {
    const posiciones = ['Hola mundo', 'Sección principal', 'La simplicidad', 'Primer punto', 'Segundo punto'].map(
      (fragmento) => resultado.indexOf(fragmento),
    );
    expect(posiciones.every((posicion) => posicion >= 0)).toBe(true);
    expect([...posiciones].sort((a, b) => a - b)).toEqual(posiciones);
  });

  it('no deja marcas Markdown ni URLs de enlaces', () => {
    for (const marca of ['**', '`', '](', '[', 'https://', 'ejemplo.com']) {
      expect(resultado).not.toContain(marca);
    }
    expect(resultado).not.toMatch(/_\w+_/);
  });

  it('omite los bloques de código', () => {
    expect(resultado).not.toContain('secretoDelCodigo');
  });

  it('devuelve un string vacío para un contenido vacío', () => {
    expect(textoPlano([])).toBe('');
  });
});

describe('crearBloque', () => {
  it.each(TIPOS_BLOQUE)('crea un bloque %s con su tipo y un id uuid nuevo', (tipo) => {
    const primero = crearBloque(tipo);
    const segundo = crearBloque(tipo);
    expect(primero.tipo).toBe(tipo);
    expect(primero.id).toMatch(UUID);
    expect(segundo.id).not.toBe(primero.id);
  });

  it.each(TIPOS_BLOQUE.filter((tipo) => tipo !== 'separador'))(
    'un bloque %s recién creado no pasa la validación hasta completarse',
    (tipo) => {
      expect(esquemaBloque.safeParse(crearBloque(tipo)).success).toBe(false);
    },
  );

  it('un separador recién creado ya es válido', () => {
    expect(esquemaBloque.safeParse(crearBloque('separador')).success).toBe(true);
  });

  it('un bloque se vuelve válido al completar sus campos obligatorios', () => {
    expect(esquemaBloque.safeParse({ ...crearBloque('parrafo'), texto: 'Texto completo' }).success).toBe(true);
    expect(esquemaBloque.safeParse({ ...crearBloque('titulo'), texto: 'Título completo' }).success).toBe(true);
    expect(esquemaBloque.safeParse({ ...crearBloque('lista'), items: ['Un item'] }).success).toBe(true);
  });
});

// T012 (spec 005): caracterización de `textoPlano` sobre textos con las cuatro marcas.
describe('textoPlano: caracterización (T012)', () => {
  it.each([
    ['a **b _c_ d** e', 'a b c d e'],
    ['**a**', 'a'],
    ['_a_', 'a'],
    ['`a`**b**', 'ab'],
    ['[**n**](/x)', 'n'],
    ['[a](https://x.com/y)', 'a'],
    ['[a](/x) [b](/y)', 'a b'],
    // Desde T023 el contenido de un `código` es literal también en el texto plano (antes se le quitaban las marcas).
    ['`**x**` y **`y`**', '**x** y y'],
    ['**a** **b**', 'a b'],
    ['_a_ _b_', 'a b'],
    ['**negrita sin cerrar', '**negrita sin cerrar'],
    ['_cursiva sin cerrar', '_cursiva sin cerrar'],
    ['`sin cerrar', '`sin cerrar'],
    ['2 * 3 * 4', '2 * 3 * 4'],
  ])('%j', (entrada, esperado) => {
    expect(textoPlano([{ id: id(), tipo: 'parrafo', texto: entrada }] as unknown as Contenido)).toBe(esperado);
  });
});
