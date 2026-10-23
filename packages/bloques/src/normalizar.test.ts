// T091 (spec 005, ampliación): forma canónica del documento (research D24; contracts/documento.md, "Forma
// canónica"; RF-012: abrir y guardar sin tocar no cambia nada).
//
// Firma propuesta (T100), exportada desde './normalizar':
//   normalizarDocumento(json: unknown): Documento
//     Pura y sin mutar la entrada. Quita los atributos null o con su valor por defecto (textAlign: 'left',
//     colspan: 1, colwidth) y deja sin `attrs` al nodo que se queda sin ninguno; quita `marks: []`,
//     `content: []` (salvo en el documento vacío), los textos vacíos y los párrafos vacíos de primer nivel (también
//     el que agrega TrailingNode); une textos contiguos con las mismas marcas y ordena las marcas en el orden
//     canónico (link, bold, italic, underline, strike, highlight, code, superscript, subscript). Es idempotente.
import { describe, expect, it } from 'vitest';
import { normalizarDocumento } from './normalizar';
import { CORPUS_DOCUMENTOS, idDePrueba, marca, nodo, type NodoPrueba } from './pruebas/corpus-documento';

const { doc, texto, salto, parrafo } = nodo;
const ORDEN_DE_MARCAS = [
  'link',
  'bold',
  'italic',
  'underline',
  'strike',
  'highlight',
  'code',
  'superscript',
  'subscript',
];

const normalizar = (entrada: unknown) => normalizarDocumento(entrada) as unknown as NodoPrueba;

describe('normalizarDocumento', () => {
  describe('atributos', () => {
    it('quita los atributos null', () => {
      const id = idDePrueba();
      const entrada = doc({ type: 'heading', attrs: { id, level: 2, textAlign: null }, content: [texto('Título')] });

      expect(normalizar(entrada)).toEqual(
        doc({ type: 'heading', attrs: { id, level: 2 }, content: [texto('Título')] }),
      );
    });

    it('quita la alineación por defecto (la izquierda no se guarda)', () => {
      const id = idDePrueba();
      const entrada = doc({ type: 'paragraph', attrs: { id, textAlign: 'left' }, content: [texto('Hola')] });

      expect(normalizar(entrada)).toEqual(doc({ type: 'paragraph', attrs: { id }, content: [texto('Hola')] }));
    });

    it('deja sin attrs a los nodos que se quedan sin ninguno (los párrafos de los ítems y las citas)', () => {
      const id = idDePrueba();
      const entrada = doc({
        type: 'bulletList',
        attrs: { id },
        content: [{ type: 'listItem', content: [{ type: 'paragraph', attrs: { id: null }, content: [texto('Uno')] }] }],
      });

      expect(normalizar(entrada)).toEqual(
        doc({
          type: 'bulletList',
          attrs: { id },
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [texto('Uno')] }] }],
        }),
      );
    });

    it('quita el language null del bloque de código y conserva lenguaje', () => {
      const id = idDePrueba();
      const entrada = doc({
        type: 'codeBlock',
        attrs: { id, language: null, lenguaje: 'ts' },
        content: [texto('const a = 1;')],
      });

      expect(normalizar(entrada)).toEqual(
        doc({ type: 'codeBlock', attrs: { id, lenguaje: 'ts' }, content: [texto('const a = 1;')] }),
      );
    });

    it('conserva los campos de los elementos especiales (imagen, galería, llamada a la acción y video)', () => {
      const documento = CORPUS_DOCUMENTOS.find(({ nombre }) => nombre === 'los once tipos')?.documento;

      expect(normalizar(documento)).toEqual(documento);
    });
  });

  describe('marcas y textos', () => {
    it('quita marks: []', () => {
      const id = idDePrueba();
      const entrada = doc({ type: 'paragraph', attrs: { id }, content: [{ type: 'text', text: 'Hola', marks: [] }] });

      expect(normalizar(entrada)).toEqual(doc({ type: 'paragraph', attrs: { id }, content: [texto('Hola')] }));
    });

    it('quita los textos vacíos', () => {
      const id = idDePrueba();
      const entrada = doc({
        type: 'paragraph',
        attrs: { id },
        content: [texto(''), texto('Hola'), texto('', marca.negrita)],
      });

      expect(normalizar(entrada)).toEqual(doc({ type: 'paragraph', attrs: { id }, content: [texto('Hola')] }));
    });

    it('une los textos contiguos con las mismas marcas', () => {
      const id = idDePrueba();
      const entrada = doc({
        type: 'paragraph',
        attrs: { id },
        content: [texto('Hola '), texto('mundo'), texto(' fuerte', marca.negrita), texto(' y más', marca.negrita)],
      });

      expect(normalizar(entrada)).toEqual(
        doc({
          type: 'paragraph',
          attrs: { id },
          content: [texto('Hola mundo'), texto(' fuerte y más', marca.negrita)],
        }),
      );
    });

    it('une los textos que quedan contiguos al quitar uno vacío entre ellos', () => {
      const id = idDePrueba();
      const entrada = doc({
        type: 'paragraph',
        attrs: { id },
        content: [texto('Uno', marca.cursiva), texto(''), texto(' dos', marca.cursiva)],
      });

      expect(normalizar(entrada)).toEqual(
        doc({ type: 'paragraph', attrs: { id }, content: [texto('Uno dos', marca.cursiva)] }),
      );
    });

    it('no une textos con marcas distintas ni enlaces con href distinto', () => {
      const entrada = doc(
        parrafo(
          texto('a', marca.negrita),
          texto('b', marca.cursiva),
          texto('c', marca.enlace('/uno')),
          texto('d', marca.enlace('/dos')),
        ),
      );

      expect(normalizar(entrada)).toEqual(entrada);
    });

    it('no une textos separados por un hardBreak', () => {
      const entrada = doc(parrafo(texto('Uno'), salto(), texto('dos')));

      expect(normalizar(entrada)).toEqual(entrada);
    });

    it('ordena las marcas en el orden canónico (link, bold, italic, …, code)', () => {
      const id = idDePrueba();
      const entrada = doc({
        type: 'paragraph',
        attrs: { id },
        content: [texto('Todo', marca.cursiva, marca.negrita, marca.enlace('/x'))],
      });

      expect(normalizar(entrada)).toEqual(
        doc({
          type: 'paragraph',
          attrs: { id },
          content: [texto('Todo', marca.enlace('/x'), marca.negrita, marca.cursiva)],
        }),
      );
    });

    it('une dos textos con las mismas marcas en distinto orden', () => {
      const id = idDePrueba();
      const entrada = doc({
        type: 'paragraph',
        attrs: { id },
        content: [texto('Uno ', marca.cursiva, marca.negrita), texto('dos', marca.negrita, marca.cursiva)],
      });

      expect(normalizar(entrada)).toEqual(
        doc({ type: 'paragraph', attrs: { id }, content: [texto('Uno dos', marca.negrita, marca.cursiva)] }),
      );
    });
  });

  describe('párrafos vacíos y content vacío', () => {
    it('el documento vacío del editor (un párrafo vacío) queda como { type: "doc", content: [] }', () => {
      expect(normalizar({ type: 'doc', content: [{ type: 'paragraph', attrs: { id: null } }] })).toEqual({
        type: 'doc',
        content: [],
      });
    });

    it('quita los párrafos vacíos de primer nivel, también el último que agrega TrailingNode', () => {
      const conTexto = parrafo(texto('Hola'));
      const entrada = doc(
        { type: 'paragraph', attrs: { id: idDePrueba() } },
        conTexto,
        { type: 'paragraph', attrs: { id: idDePrueba() }, content: [] },
        { type: 'paragraph', attrs: { id: null } },
      );

      expect(normalizar(entrada)).toEqual(doc(conTexto));
    });

    it('quita un párrafo de primer nivel que solo tiene textos vacíos', () => {
      const conTexto = parrafo(texto('Hola'));
      const entrada = doc(conTexto, { type: 'paragraph', attrs: { id: idDePrueba() }, content: [texto('')] });

      expect(normalizar(entrada)).toEqual(doc(conTexto));
    });

    it('quita content: [] de un nodo que no es el documento (bloque de código vacío)', () => {
      const id = idDePrueba();
      expect(normalizar(doc({ type: 'codeBlock', attrs: { id, lenguaje: 'ts' }, content: [] }))).toEqual(
        doc({ type: 'codeBlock', attrs: { id, lenguaje: 'ts' } }),
      );
    });

    it('acepta un documento sin content y devuelve el documento vacío', () => {
      expect(normalizar({ type: 'doc' })).toEqual({ type: 'doc', content: [] });
    });
  });

  describe('pureza, idempotencia y documentos canónicos (RF-012)', () => {
    it.each(CORPUS_DOCUMENTOS.map(({ nombre, documento }) => [nombre, documento] as const))(
      'un documento canónico no cambia: "%s"',
      (_nombre, documento) => {
        expect(normalizar(documento)).toEqual(documento);
      },
    );

    it.each(CORPUS_DOCUMENTOS.map(({ nombre, documento }) => [nombre, documento] as const))(
      'es idempotente sobre el corpus: "%s"',
      (_nombre, documento) => {
        const una = normalizar(documento);
        expect(normalizar(una)).toEqual(una);
      },
    );

    it('no modifica la entrada', () => {
      const entrada = doc(
        { type: 'paragraph', attrs: { id: idDePrueba(), textAlign: null }, content: [texto('a'), texto('b')] },
        { type: 'paragraph', attrs: { id: null } },
      );
      const copia = structuredClone(entrada);

      normalizar(entrada);

      expect(entrada).toEqual(copia);
    });

    it('propiedad: con 300 documentos al azar es idempotente y deja la forma canónica', () => {
      const azar = generador(20261022);
      for (let vuelta = 0; vuelta < 300; vuelta++) {
        const entrada = documentoAlAzar(azar);
        const una = normalizar(entrada);

        expect(normalizar(una), `vuelta ${vuelta}`).toEqual(una);
        comprobarCanonica(una, `vuelta ${vuelta}`);
      }
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Documentos al azar con todo lo que normalizarDocumento tiene que limpiar.
// ---------------------------------------------------------------------------------------------------------------

/** mulberry32: números al azar repetibles a partir de una semilla. */
function generador(semilla: number) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Azar = () => number;
const elegir = <T>(azar: Azar, opciones: readonly T[]): T => opciones[Math.floor(azar() * opciones.length)] as T;

const MARCAS_AL_AZAR = [marca.enlace('/x'), marca.enlace('https://ejemplo.com'), marca.negrita, marca.cursiva];

function inlineAlAzar(azar: Azar): NodoPrueba[] {
  const nodos: NodoPrueba[] = [];
  const cantidad = Math.floor(azar() * 6);
  for (let i = 0; i < cantidad; i++) {
    if (azar() < 0.15) {
      nodos.push(salto());
      continue;
    }
    const marcas = MARCAS_AL_AZAR.filter(() => azar() < 0.3);
    // Sin dos enlaces en el mismo texto.
    const sinDosEnlaces = marcas.filter(
      (m, j) => m.type !== 'link' || marcas.findIndex((o) => o.type === 'link') === j,
    );
    const desordenadas = azar() < 0.5 ? [...sinDosEnlaces].reverse() : sinDosEnlaces;
    const textoNodo: NodoPrueba = { type: 'text', text: elegir(azar, ['', 'a', 'hola ', ' mundo', 'ñ']) };
    if (desordenadas.length > 0 || azar() < 0.3) textoNodo.marks = desordenadas;
    nodos.push(textoNodo);
  }
  return nodos;
}

function elementoAlAzar(azar: Azar): NodoPrueba {
  const id = azar() < 0.1 ? null : idDePrueba();
  const alineacion = elegir(azar, [undefined, null, 'left']);
  const attrs = (propios: Record<string, unknown> = {}) => ({
    id,
    ...(alineacion === undefined ? {} : { textAlign: alineacion }),
    ...propios,
  });
  const contenido = inlineAlAzar(azar);
  const conContenido = azar() < 0.2 ? { content: [] } : contenido.length > 0 ? { content: contenido } : {};
  switch (elegir(azar, ['paragraph', 'heading', 'codeBlock', 'horizontalRule'] as const)) {
    case 'paragraph':
      return { type: 'paragraph', attrs: attrs(), ...conContenido };
    case 'heading':
      return { type: 'heading', attrs: attrs({ level: elegir(azar, [2, 3, 4]) }), ...conContenido };
    case 'codeBlock':
      return {
        type: 'codeBlock',
        attrs: { id, language: null, lenguaje: elegir(azar, [null, 'ts']) },
        ...(azar() < 0.5 ? { content: [] } : { content: [{ type: 'text', text: 'const a = 1;' }] }),
      };
    case 'horizontalRule':
      return { type: 'horizontalRule', attrs: { id } };
  }
}

function documentoAlAzar(azar: Azar): NodoPrueba {
  const cantidad = Math.floor(azar() * 8);
  return { type: 'doc', content: Array.from({ length: cantidad }, () => elementoAlAzar(azar)) };
}

/** Las reglas de la forma canónica del contrato. */
function comprobarCanonica(documento: NodoPrueba, contexto: string) {
  const visitar = (nodoActual: NodoPrueba, nivel: number) => {
    if (nodoActual.attrs) {
      expect(Object.keys(nodoActual.attrs).length, `${contexto}: attrs vacío`).toBeGreaterThan(0);
      for (const [clave, valor] of Object.entries(nodoActual.attrs)) {
        expect(valor, `${contexto}: ${clave} null`).not.toBeNull();
      }
      expect(nodoActual.attrs.textAlign, `${contexto}: textAlign left`).not.toBe('left');
    }
    if (nodoActual.type === 'text') {
      expect(nodoActual.text, `${contexto}: texto vacío`).not.toBe('');
      if (nodoActual.marks) {
        expect(nodoActual.marks.length, `${contexto}: marks []`).toBeGreaterThan(0);
        const posiciones = nodoActual.marks.map((m) => ORDEN_DE_MARCAS.indexOf(m.type));
        expect(posiciones, `${contexto}: orden de marcas`).toEqual([...posiciones].sort((a, b) => a - b));
      }
    }
    if (nodoActual.type !== 'doc' && nodoActual.content) {
      expect(nodoActual.content.length, `${contexto}: content [] en ${nodoActual.type}`).toBeGreaterThan(0);
    }
    if (nivel === 1 && nodoActual.type === 'paragraph') {
      expect(
        nodoActual.content?.some((hijo) => hijo.type === 'text'),
        `${contexto}: párrafo vacío`,
      ).toBe(true);
    }
    const hijos = nodoActual.content ?? [];
    for (let i = 1; i < hijos.length; i++) {
      const anterior = hijos[i - 1];
      const actual = hijos[i];
      if (anterior?.type === 'text' && actual?.type === 'text') {
        expect(JSON.stringify(anterior.marks ?? []), `${contexto}: textos contiguos sin unir`).not.toBe(
          JSON.stringify(actual.marks ?? []),
        );
      }
    }
    for (const hijo of hijos) visitar(hijo, nivel + 1);
  };
  expect(documento.type).toBe('doc');
  expect(Array.isArray(documento.content), `${contexto}: content`).toBe(true);
  visitar(documento, 0);
}
