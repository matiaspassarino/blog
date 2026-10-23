// T093 (spec 005, ampliación): validarDocumento y ErrorElemento (contracts/documento.md, "Errores"; RF-022;
// H1-E2 y CE-006 de la spec 001, ahora por elemento).
//
// Firma propuesta (T102), exportada desde './validar':
//   type ErrorElemento = { indice: number; id: string; campo: string; mensaje: string }
//     indice: posición del elemento en `content` (desde 0; −1 para lo que no es de un elemento, como la imagen
//     destacada de hoy); id: su `attrs.id` ('' si no tiene uno); campo: nombre estable, con los nombres de hoy
//     (texto, nivel, items.3, imagen.alt, imagenes.1.alt, url, lenguaje, autor, fuente, id, tipo…).
//   validarDocumento(documento: unknown, opciones?: { publicar?: boolean }): ErrorElemento[]
//     Nunca lanza; [] es válido. Con `publicar: true` exige además contenido (lo mismo que
//     privado.documento_tiene_contenido en la base).
import { describe, expect, it } from 'vitest';
import { imagenDePrueba, marca, nodo, type NodoPrueba } from './pruebas/corpus-documento';
import { validarDocumento, type ErrorElemento } from './validar';

const { doc, texto, parrafo, titulo, item, vinetas, numerada, cita, codigo, separador } = nodo;

const MENSAJE_SIN_ALT = 'La imagen necesita un texto alternativo o marcarse como decorativa';
// Mensajes por defecto de Zod en inglés: no deben llegar a la persona.
const PALABRAS_EN_INGLES = /\b(invalid|expected|received|required|too (small|big)|must|should|unrecognized)\b/i;

const sinAlt = () => {
  const { alt: _sinAlt, ...imagen } = imagenDePrueba('a', 'Alt');
  return imagen;
};
const conAttrs = (elemento: NodoPrueba, attrs: Record<string, unknown>): NodoPrueba => ({
  ...elemento,
  attrs: { ...elemento.attrs, ...attrs },
});
const pares = (errores: ErrorElemento[]) => errores.map((error) => `${error.indice}:${error.campo}`);

describe('validarDocumento', () => {
  describe('documento válido', () => {
    it('devuelve [] para un documento válido', () => {
      const documento = doc(parrafo(texto('Hola '), texto('mundo', marca.negrita)), titulo(2, texto('Un título')));

      expect(validarDocumento(documento)).toEqual([]);
    });

    it('devuelve [] para el documento vacío (un borrador puede no tener contenido)', () => {
      expect(validarDocumento(doc())).toEqual([]);
    });
  });

  describe('H1-E2: un elemento incompleto se rechaza indicando qué elemento y qué campo fallaron', () => {
    it('una imagen sin texto alternativo informa el índice, el id y el campo imagen.alt', () => {
      const imagen = nodo.imagen(sinAlt());
      const documento = doc(parrafo(texto('Primero')), imagen);

      expect(validarDocumento(documento)).toEqual([
        { indice: 1, id: imagen.attrs?.id, campo: 'imagen.alt', mensaje: MENSAJE_SIN_ALT },
      ]);
    });

    it('un párrafo de más de 5000 caracteres informa el campo texto', () => {
      const largo = parrafo(texto('a'.repeat(5001)));

      expect(validarDocumento(doc(largo))).toEqual([
        expect.objectContaining({ indice: 0, id: largo.attrs?.id, campo: 'texto' }),
      ]);
    });

    it('un título vacío o largo informa texto y un nivel inválido informa nivel', () => {
      const vacio = titulo(2);
      const largo = titulo(3, texto('a'.repeat(151)));
      const nivel = conAttrs(titulo(2, texto('Bien')), { level: 7 });

      expect(pares(validarDocumento(doc(vacio, largo, nivel)))).toEqual(
        expect.arrayContaining(['0:texto', '1:texto', '2:nivel']),
      );
    });

    it('usa los nombres de hoy para los campos anidados en arreglos (items.3, imagenes.1.alt)', () => {
      const lista = vinetas(item(texto('Uno')), item(texto('Dos')), item(texto('Tres')), item(texto('a'.repeat(501))));
      const galeria = nodo.galeria(3, imagenDePrueba('a', 'Alt'), sinAlt());

      expect(validarDocumento(doc(lista, galeria))).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ indice: 0, id: lista.attrs?.id, campo: 'items.3' }),
          { indice: 1, id: galeria.attrs?.id, campo: 'imagenes.1.alt', mensaje: MENSAJE_SIN_ALT },
        ]),
      );
    });

    it('informa autor y fuente de una cita, lenguaje del código y url de la llamada a la acción', () => {
      const documento = doc(
        cita({ autor: '', fuente: 'http://inseguro.com' }, texto('Cita')),
        codigo('x', 'TypeScript'),
        nodo.cta({ titulo: 'Escríbenos', etiquetaBoton: 'Ir', url: 'javascript:alert(1)' }),
      );

      expect(pares(validarDocumento(documento))).toEqual(
        expect.arrayContaining(['0:autor', '0:fuente', '1:lenguaje', '2:url']),
      );
    });

    it('informa el campo id cuando un elemento no tiene un id uuid', () => {
      const documento = doc(conAttrs(separador(), { id: 'elemento-1' }));

      expect(validarDocumento(documento)).toEqual([expect.objectContaining({ indice: 0, campo: 'id' })]);
    });

    it('informa el campo id en el segundo de dos elementos con el mismo id', () => {
      const primero = separador();
      const segundo = conAttrs(separador(), { id: primero.attrs?.id });

      expect(validarDocumento(doc(primero, segundo))).toEqual([
        expect.objectContaining({ indice: 1, id: primero.attrs?.id, campo: 'id' }),
      ]);
    });

    it('un tipo desconocido informa el índice y el campo tipo', () => {
      const documento = doc({ type: 'tabla', attrs: { id: crypto.randomUUID() } }, parrafo(texto('Bien')));
      const errores = validarDocumento(documento);

      expect(errores).toHaveLength(1);
      expect(errores[0]).toMatchObject({ indice: 0, campo: 'tipo' });
    });

    it('devuelve todos los errores de todos los elementos, con índices desde 0', () => {
      const documento = doc(
        parrafo(texto('Bien')),
        nodo.imagen(sinAlt()),
        parrafo(texto('Bien')),
        numerada(item(texto('Uno')), item()),
        conAttrs(titulo(2), { level: 1 }),
        nodo.cta({ titulo: 'Escríbenos', etiquetaBoton: 'Ir', url: 'javascript:alert(1)' }),
        { type: 'inexistente', attrs: { id: crypto.randomUUID() } },
      );
      const errores = validarDocumento(documento);

      expect(pares(errores)).toEqual(
        expect.arrayContaining(['1:imagen.alt', '3:items.1', '4:nivel', '4:texto', '5:url', '6:tipo']),
      );
      expect(new Set(errores.map((error) => error.indice))).toEqual(new Set([1, 3, 4, 5, 6]));
    });

    it('más de 200 elementos: un error del documento (índice −1) que menciona el límite', () => {
      const errores = validarDocumento(doc(...Array.from({ length: 201 }, () => separador())));

      expect(errores.length).toBeGreaterThan(0);
      expect(errores.some((error) => error.indice === -1 && error.mensaje.includes('200'))).toBe(true);
    });

    it('el formato anterior (una lista de bloques) es un error del documento', () => {
      const errores = validarDocumento([{ id: crypto.randomUUID(), tipo: 'parrafo', texto: 'Hola' }]);

      expect(errores.length).toBeGreaterThan(0);
      expect(errores.every((error) => error.indice === -1)).toBe(true);
    });
  });

  describe('publicar: el requisito de contenido', () => {
    it('sin publicar, el documento vacío es válido; al publicar, es un error', () => {
      expect(validarDocumento(doc(), { publicar: false })).toEqual([]);

      const errores = validarDocumento(doc(), { publicar: true });
      expect(errores).toHaveLength(1);
      expect(errores[0]?.mensaje).toMatch(/contenido/i);
      expect(errores[0]?.mensaje).not.toMatch(PALABRAS_EN_INGLES);
    });

    it.each([
      ['un párrafo', parrafo(texto('Hola'))],
      ['un separador', separador()],
      ['una imagen', nodo.imagen(imagenDePrueba('a', 'Alt'))],
    ])('al publicar con %s no hay errores', (_caso, elemento) => {
      expect(validarDocumento(doc(elemento), { publicar: true })).toEqual([]);
    });

    it('al publicar, también informa los errores de los elementos', () => {
      const imagen = nodo.imagen(sinAlt());

      expect(validarDocumento(doc(imagen), { publicar: true })).toEqual([
        { indice: 0, id: imagen.attrs?.id, campo: 'imagen.alt', mensaje: MENSAJE_SIN_ALT },
      ]);
    });
  });

  describe('CE-006: los mensajes están en español y son accionables', () => {
    const conErrores = doc(
      parrafo(texto('a'.repeat(5001))),
      conAttrs(titulo(2, texto('a'.repeat(151))), { level: 1 }),
      { ...vinetas(), content: [] },
      nodo.galeria(3, imagenDePrueba('a', 'Alt')),
      nodo.cta({ titulo: 'Hola', etiquetaBoton: '', url: 'http://inseguro.com' }),
      codigo('x', 'TypeScript'),
      conAttrs(nodo.video('youtube', 'dQw4w9WgXcQ', 'Demo'), { proveedor: 'dailymotion' }),
      cita({ fuente: 'no es url' }, texto('Cita')),
      conAttrs(separador(), { id: 'sin-uuid' }),
      { type: 'desconocido', attrs: { id: crypto.randomUUID() } },
      parrafo(texto('Con un enlace', marca.enlace('javascript:alert(1)'))),
      parrafo(texto('Código con negrita', marca.codigo, marca.negrita)),
      conAttrs(separador(), { estilo: 'color: red' }),
    );
    const cantidad = conErrores.content?.length ?? 0;

    it('cada error tiene un mensaje no vacío y sin los textos por defecto en inglés', () => {
      const errores = validarDocumento(conErrores);

      expect(errores.length).toBeGreaterThanOrEqual(cantidad);
      for (const error of errores) {
        expect(error.mensaje.trim()).not.toBe('');
        expect(error.mensaje).not.toMatch(PALABRAS_EN_INGLES);
      }
    });

    it('cada elemento inválido del conjunto de prueba aparece en los errores (100 % de rechazo)', () => {
      const indices = new Set(validarDocumento(conErrores).map((error) => error.indice));

      expect(indices).toEqual(new Set(Array.from({ length: cantidad }, (_, indice) => indice)));
    });

    it('cada error de un elemento lleva su id', () => {
      const ids = new Map(conErrores.content?.map((elemento, indice) => [indice, elemento.attrs?.id]));

      for (const error of validarDocumento(conErrores)) {
        if (error.indice >= 0 && error.campo !== 'id') expect(error.id).toBe(ids.get(error.indice));
      }
    });
  });

  describe('nunca lanza', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['un string', '<p>Hola</p>'],
      ['un número', 42],
      ['un objeto vacío', {}],
      ['un elemento que no es un objeto', { type: 'doc', content: ['Hola', null] }],
    ])('con %s devuelve al menos un error en español', (_caso, entrada) => {
      let errores: ErrorElemento[] = [];
      expect(() => {
        errores = validarDocumento(entrada);
      }).not.toThrow();
      expect(errores.length).toBeGreaterThan(0);
      for (const error of errores) expect(error.mensaje).not.toMatch(PALABRAS_EN_INGLES);
    });
  });
});
