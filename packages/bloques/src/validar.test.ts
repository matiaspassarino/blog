// T022: validarContenido (contracts/bloques.md, "Errores"; H1-E2; RF-003; CE-006).
import { describe, expect, it } from 'vitest';
import { validarContenido, type ErrorBloque } from './validar';

const MENSAJE_SIN_ALT = 'La imagen necesita un texto alternativo o marcarse como decorativa';

// Mensajes por defecto de Zod en inglés: no deben llegar al usuario.
const PALABRAS_EN_INGLES = /\b(invalid|expected|received|required|too (small|big)|must|should)\b/i;

const id = () => crypto.randomUUID();
const imagen = (n = 1) => ({ ruta: `medios/foto-${n}.jpg`, ancho: 800, alto: 600, alt: `Foto ${n}` });

const parrafo = (texto = 'Primer párrafo.') => ({ id: id(), tipo: 'parrafo', texto });
const titulo = (texto = 'Un subtítulo') => ({ id: id(), tipo: 'titulo', nivel: 2, texto });
const lista = (items = ['Uno', 'Dos']) => ({ id: id(), tipo: 'lista', ordenada: true, items });

function errores(entrada: unknown): ErrorBloque[] {
  const resultado = validarContenido(entrada);
  if (resultado.ok) throw new Error('se esperaba un contenido inválido');
  return resultado.errores;
}

describe('validarContenido', () => {
  describe('contenido válido', () => {
    it('devuelve { ok: true, contenido } con los bloques en el mismo orden', () => {
      const contenido = [parrafo(), titulo(), lista()];
      const resultado = validarContenido(contenido);
      expect(resultado).toEqual({ ok: true, contenido });
    });

    it('acepta un contenido vacío', () => {
      expect(validarContenido([])).toEqual({ ok: true, contenido: [] });
    });

    it('devuelve el contenido con los valores por defecto aplicados', () => {
      const { alt: _sinAlt, ...imagenDecorativa } = imagen();
      const galeria = { id: id(), tipo: 'galeria', imagenes: [imagen(1), { ...imagenDecorativa, decorativa: true }] };
      const resultado = validarContenido([galeria]);
      expect(resultado.ok).toBe(true);
      if (resultado.ok) {
        expect(resultado.contenido[0]).toMatchObject({ tipo: 'galeria', columnas: 3 });
      }
    });
  });

  describe('H1-E2: un bloque incompleto se rechaza indicando qué bloque y qué campo fallaron', () => {
    it('H1-E2: una imagen sin texto alternativo informa el índice del bloque y el campo imagen.alt', () => {
      const { alt: _sinAlt, ...imagenSinAlt } = imagen();
      const contenido = [parrafo(), { id: id(), tipo: 'imagen', imagen: imagenSinAlt }];
      expect(errores(contenido)).toEqual([{ indice: 1, campo: 'imagen.alt', mensaje: MENSAJE_SIN_ALT }]);
    });

    it('H1-E2: un tipo de bloque inexistente informa el índice y el campo tipo', () => {
      const contenido = [{ id: id(), tipo: 'tabla', filas: [] }, parrafo()];
      const resultado = errores(contenido);
      expect(resultado).toHaveLength(1);
      expect(resultado[0]).toMatchObject({ indice: 0, campo: 'tipo' });
    });

    it('usa rutas con puntos para los campos anidados en arreglos (items.3, imagenes.1.alt)', () => {
      const { alt: _sinAlt, ...imagenSinAlt } = imagen(2);
      const contenido = [
        lista(['Uno', 'Dos', 'Tres', '']),
        { id: id(), tipo: 'galeria', imagenes: [imagen(1), imagenSinAlt] },
      ];
      expect(errores(contenido)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ indice: 0, campo: 'items.3' }),
          { indice: 1, campo: 'imagenes.1.alt', mensaje: MENSAJE_SIN_ALT },
        ]),
      );
    });

    it('devuelve todos los errores de todos los bloques, con índices en base 0', () => {
      const { alt: _sinAlt, ...imagenSinAlt } = imagen();
      const contenido = [
        parrafo(),
        { id: id(), tipo: 'imagen', imagen: imagenSinAlt },
        parrafo(),
        lista(['Uno', 'Dos', 'Tres', '']),
        { id: id(), tipo: 'titulo', nivel: 7, texto: '' },
        { id: id(), tipo: 'cta', titulo: 'Escribinos', etiquetaBoton: 'Ir', url: 'javascript:alert(1)' },
        { id: id(), tipo: 'inexistente' },
      ];
      const resultado = errores(contenido);
      const pares = resultado.map((error) => `${error.indice}:${error.campo}`);
      expect(pares).toEqual(
        expect.arrayContaining(['1:imagen.alt', '3:items.3', '4:nivel', '4:texto', '5:url', '6:tipo']),
      );
      expect(new Set(resultado.map((error) => error.indice))).toEqual(new Set([1, 3, 4, 5, 6]));
    });

    it('informa el campo id cuando un bloque no tiene un id uuid', () => {
      expect(errores([{ ...parrafo(), id: 'bloque-1' }])).toEqual([expect.objectContaining({ indice: 0, campo: 'id' })]);
    });

    it('informa cada elemento que no es un objeto con su índice', () => {
      const indices = errores([parrafo(), null, 'texto suelto']).map((error) => error.indice);
      expect(new Set(indices)).toEqual(new Set([1, 2]));
    });

    it('rechaza más de 200 bloques con un mensaje que menciona el límite', () => {
      const contenido = Array.from({ length: 201 }, () => ({ id: id(), tipo: 'separador' }));
      const resultado = errores(contenido);
      expect(resultado.length).toBeGreaterThan(0);
      expect(resultado.some((error) => error.mensaje.includes('200'))).toBe(true);
    });
  });

  describe('CE-006: los mensajes están en español y son accionables', () => {
    const contenidoConErrores = [
      { id: id(), tipo: 'parrafo', texto: '' },
      { id: id(), tipo: 'titulo', nivel: 1, texto: 'x'.repeat(151) },
      { id: id(), tipo: 'lista', ordenada: 'si', items: [] },
      { id: id(), tipo: 'galeria', imagenes: [imagen()], columnas: 9 },
      { id: id(), tipo: 'cta', titulo: 'Hola', etiquetaBoton: '', url: 'http://inseguro.com' },
      { id: id(), tipo: 'codigo', codigo: 'x', lenguaje: 'TypeScript' },
      { id: id(), tipo: 'video', proveedor: 'dailymotion', idVideo: '', titulo: 'Demo' },
      { id: id(), tipo: 'cita', texto: 'Cita', fuente: 'no es url' },
      { id: 'sin-uuid', tipo: 'separador' },
      { id: id(), tipo: 'desconocido' },
    ];

    it('cada error tiene un mensaje no vacío y sin los textos por defecto en inglés', () => {
      const resultado = errores(contenidoConErrores);
      expect(resultado.length).toBeGreaterThanOrEqual(contenidoConErrores.length);
      for (const error of resultado) {
        expect(error.mensaje.trim()).not.toBe('');
        expect(error.mensaje).not.toMatch(PALABRAS_EN_INGLES);
      }
    });

    it('cada bloque inválido del conjunto de prueba aparece en los errores (100 % de rechazo)', () => {
      const indices = new Set(errores(contenidoConErrores).map((error) => error.indice));
      expect(indices).toEqual(new Set(contenidoConErrores.map((_, indice) => indice)));
    });
  });

  describe('nunca lanza', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['un string', 'contenido'],
      ['un número', 42],
      ['un objeto', { tipo: 'parrafo', texto: 'No es un arreglo' }],
      ['un objeto vacío', {}],
    ])('con %s devuelve { ok: false } con al menos un error en español', (_caso, entrada) => {
      let resultado: ReturnType<typeof validarContenido> | undefined;
      expect(() => {
        resultado = validarContenido(entrada);
      }).not.toThrow();
      expect(resultado?.ok).toBe(false);
      if (resultado && !resultado.ok) {
        expect(resultado.errores.length).toBeGreaterThan(0);
        for (const error of resultado.errores) {
          expect(error.mensaje).not.toMatch(PALABRAS_EN_INGLES);
        }
      }
    });
  });
});
