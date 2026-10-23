// T112 (spec 005, Historia 5; RF-012, RF-023, CE-002; contracts/documento.md, "Correspondencia con el formato
// anterior"; research D25 y D31 C1): conversión de la lista de bloques del formato anterior al documento guardado y
// su inversa, solo para el script de un solo uso (`scripts/convertir-contenido.ts`). Funciones puras.
//
// FASE ROJA: `conversion.ts` todavía produce la forma del editor de la etapa anterior (`imagenBloque`…, `bloqueId`,
// `continuacion`, `attrs.bloque`). API que se prueba (T119):
//   bloquesADocumento(contenido: Contenido): Documento
//     Forma del contrato: `attrs.id` (no `bloqueId`), nodos `imagen`, `galeria`, `cta` y `video` con los campos del
//     bloque como `attrs` planos, sin `continuacion`; en forma canónica (`normalizarDocumento(d)` es `d`). Un
//     contenido vacío da `{ type: 'doc', content: [] }`.
//   documentoABloques(documento: Documento): Contenido
//   idDeTramo(idBloque: string, numero: number): string
//     uuid v5 con `idBloque` como espacio de nombres y `String(numero)` como nombre (RFC 9562, SHA-1).
//   reducirTramos(contenido: Contenido): Contenido
//     Lo que tiene que devolver la ida y vuelta: cada párrafo con lo que mostraba el sitio (un `<p>` por tramo que no
//     está en blanco): sin los tramos en blanco y con los tramos unidos por una sola línea en blanco (`\n\n`); un
//     párrafo sin tramos visibles desaparece. El resto del contenido queda igual.
//
// Párrafos con líneas en blanco (D25): `partirParrafos` los parte en tramos. Los tramos en blanco (`trim() === ''`)
// no se convierten (el sitio no los mostraba). Los que quedan se numeran desde 0 en orden: el 0 conserva el id del
// bloque y el n-ésimo (n ≥ 1) recibe `idDeTramo(id, n)`. Así convertir `reducirTramos(c)` da lo mismo que convertir
// `c` (repetible). La inversa une a un párrafo los siguientes cuyos ids son `idDeTramo(id del párrafo, 1)`,
// `idDeTramo(…, 2)`… en ese orden, con `\n\n`.
//
// Marcas: se conservan todas las que leía el sitio, en el orden canónico (`link`, `bold`, `italic`, `code`), aunque
// la combinación no sea válida en el documento nuevo (por ejemplo, código dentro de negrita): nada se pierde y la
// validación lo informa (el script lo lista; research D25, "la validez no bloquea").
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { esquemaDocumento, type Documento } from '../esquema';
import { normalizarDocumento } from '../normalizar';
import { CORPUS_CONTENIDOS } from '../pruebas/corpus-contenido';
import { validarDocumento } from '../validar';
import { bloquesADocumento, documentoABloques, idDeTramo, reducirTramos } from './conversion';
import type { Bloque, Contenido } from './esquema-bloques';

type Nodo = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: Nodo[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_C = '33333333-3333-4333-8333-333333333333';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** uuid v5 de referencia (RFC 9562, sección 5.5), independiente de la implementación. */
function uuidV5(nombre: string, espacio: string): string {
  const bytes = Buffer.from(espacio.replaceAll('-', ''), 'hex');
  const hash = createHash('sha1')
    .update(Buffer.concat([bytes, Buffer.from(nombre, 'utf8')]))
    .digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const texto = (text: string, ...marks: NonNullable<Nodo['marks']>): Nodo =>
  marks.length > 0 ? { type: 'text', text, marks } : { type: 'text', text };
const salto: Nodo = { type: 'hardBreak' };
const parrafoDoc = (id: string, ...content: Nodo[]): Nodo => ({
  type: 'paragraph',
  attrs: { id },
  ...(content.length > 0 ? { content } : {}),
});
const documento = (...content: Nodo[]) => ({ type: 'doc', content }) as unknown as Documento;

const aDocumento = (contenido: Contenido) => bloquesADocumento(contenido) as unknown as { type: string; content: Nodo[] };
const primerNivel = (contenido: Contenido) => aDocumento(contenido).content;
const aBloques = (doc: Documento) => documentoABloques(doc);
const parrafo = (id: string, valor: string): Bloque => ({ id, tipo: 'parrafo', texto: valor });

const DIEZ_TIPOS = CORPUS_CONTENIDOS.find(({ nombre }) => nombre === 'los diez tipos')?.contenido ?? [];
const bloqueDelCorpus = <T extends Bloque['tipo']>(tipo: T) => {
  const bloque = DIEZ_TIPOS.find((b) => b.tipo === tipo);
  if (!bloque) throw new Error(`Falta el bloque ${tipo} en el corpus`);
  return bloque as Extract<Bloque, { tipo: T }>;
};
const CASOS_DEL_CORPUS = CORPUS_CONTENIDOS.map(({ nombre, contenido }) => [nombre, contenido] as const);

describe('idDeTramo: uuid v5 del id del bloque y el número de tramo (D25)', () => {
  it('la referencia de uuid v5 da el valor conocido del RFC (www.example.com en el espacio DNS)', () => {
    expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    );
  });

  it('D25: es el uuid v5 con el id del bloque como espacio de nombres y el número como nombre', () => {
    expect(idDeTramo(ID_A, 1)).toBe(uuidV5('1', ID_A));
    expect(idDeTramo(ID_A, 12)).toBe(uuidV5('12', ID_A));
  });

  it('D25: es un uuid válido para el esquema del documento (versión 5)', () => {
    const id = idDeTramo(ID_B, 3);

    expect(id).toMatch(UUID);
    expect(id[14]).toBe('5');
  });

  it('D25: es repetible y distinto por bloque y por número', () => {
    expect(idDeTramo(ID_A, 1)).toBe(idDeTramo(ID_A, 1));
    expect(idDeTramo(ID_A, 1)).not.toBe(idDeTramo(ID_A, 2));
    expect(idDeTramo(ID_A, 1)).not.toBe(idDeTramo(ID_B, 1));
    expect(idDeTramo(ID_A, 1)).not.toBe(ID_A);
  });
});

describe('bloquesADocumento: la forma del contrato (contracts/documento.md)', () => {
  it('RF-023: un contenido vacío da el documento vacío', () => {
    expect(bloquesADocumento([])).toEqual({ type: 'doc', content: [] });
  });

  it('RF-023: un párrafo es un paragraph con attrs.id', () => {
    expect(primerNivel([parrafo(ID_A, 'Hola')])).toEqual([parrafoDoc(ID_A, texto('Hola'))]);
  });

  it('RF-023: las marcas del formato anterior pasan a bold, italic, code y link (con solo href)', () => {
    expect(primerNivel([parrafo(ID_A, '**a** _b_ `c` [d](/x)')])).toEqual([
      parrafoDoc(
        ID_A,
        texto('a', { type: 'bold' }),
        texto(' '),
        texto('b', { type: 'italic' }),
        texto(' '),
        texto('c', { type: 'code' }),
        texto(' '),
        texto('d', { type: 'link', attrs: { href: '/x' } }),
      ),
    ]);
  });

  it('RF-023: las marcas anidadas quedan en el orden canónico (el enlace primero)', () => {
    expect(primerNivel([parrafo(ID_A, '**negrita _y cursiva_** y [enlace **fuerte**](/x)')])).toEqual([
      parrafoDoc(
        ID_A,
        texto('negrita ', { type: 'bold' }),
        texto('y cursiva', { type: 'bold' }, { type: 'italic' }),
        texto(' y '),
        texto('enlace ', { type: 'link', attrs: { href: '/x' } }),
        texto('fuerte', { type: 'link', attrs: { href: '/x' } }, { type: 'bold' }),
      ),
    ]);
  });

  it('RF-023: el código dentro de negrita conserva las dos marcas (nada se pierde) y la validación lo informa', () => {
    const doc = bloquesADocumento([parrafo(ID_A, '**a `b`**')]);

    expect(doc.content).toEqual([
      parrafoDoc(ID_A, texto('a ', { type: 'bold' }), texto('b', { type: 'bold' }, { type: 'code' })),
    ]);
    expect(validarDocumento(doc)).not.toEqual([]);
  });

  it('RF-023: un salto simple es un hardBreak sin atributos dentro del mismo párrafo', () => {
    expect(primerNivel([parrafo(ID_A, 'uno\ndos')])).toEqual([parrafoDoc(ID_A, texto('uno'), salto, texto('dos'))]);
  });

  it('RF-023: cada línea se lee por separado, como en el sitio (una marca no cruza un salto simple)', () => {
    expect(primerNivel([parrafo(ID_A, '**uno\ndos**')])).toEqual([
      parrafoDoc(ID_A, texto('**uno'), salto, texto('dos**')),
    ]);
  });

  it('D25: un párrafo con líneas en blanco da varios paragraph: el primero con el id del bloque y los demás con idDeTramo', () => {
    expect(primerNivel([parrafo(ID_A, 'Uno\n\nDos\n\n\nTres')])).toEqual([
      parrafoDoc(ID_A, texto('Uno')),
      parrafoDoc(idDeTramo(ID_A, 1), texto('Dos')),
      parrafoDoc(idDeTramo(ID_A, 2), texto('Tres')),
    ]);
  });

  it('D25: los ids de los tramos son los uuid v5 de referencia', () => {
    const ids = primerNivel([parrafo(ID_A, 'Uno\n\nDos\n\nTres')]).map((nodo) => nodo.attrs?.id);

    expect(ids).toEqual([ID_A, uuidV5('1', ID_A), uuidV5('2', ID_A)]);
  });

  it('D25: un salto simple dentro de un tramo sigue siendo un hardBreak de ese tramo', () => {
    expect(primerNivel([parrafo(ID_A, 'Salto simple\ny doble\n\ny triple')])).toEqual([
      parrafoDoc(ID_A, texto('Salto simple'), salto, texto('y doble')),
      parrafoDoc(idDeTramo(ID_A, 1), texto('y triple')),
    ]);
  });

  it('D26: los tramos en blanco no se convierten (el sitio no los mostraba) ni cuentan para la numeración', () => {
    expect(primerNivel([parrafo(ID_A, 'A\n\n')])).toEqual([parrafoDoc(ID_A, texto('A'))]);
    expect(primerNivel([parrafo(ID_A, 'A\n\n  \n\nB')])).toEqual([
      parrafoDoc(ID_A, texto('A')),
      parrafoDoc(idDeTramo(ID_A, 1), texto('B')),
    ]);
    expect(primerNivel([parrafo(ID_A, 'A\n\n\n\n\n\nB')])).toEqual([
      parrafoDoc(ID_A, texto('A')),
      parrafoDoc(idDeTramo(ID_A, 1), texto('B')),
    ]);
  });

  it('D25: si el primer tramo está en blanco, el primero que queda conserva el id del bloque', () => {
    expect(primerNivel([parrafo(ID_A, '\n\nB\n\nC')])).toEqual([
      parrafoDoc(ID_A, texto('B')),
      parrafoDoc(idDeTramo(ID_A, 1), texto('C')),
    ]);
  });

  it('D26: un párrafo vacío o de solo espacios no da ningún elemento (no hay párrafos vacíos en el primer nivel)', () => {
    expect(primerNivel([parrafo(ID_A, ''), parrafo(ID_B, '   '), parrafo(ID_C, 'Texto')])).toEqual([
      parrafoDoc(ID_C, texto('Texto')),
    ]);
  });

  it('RF-023: un título es un heading con id y level, y su texto sin leer marcas (como en el sitio)', () => {
    expect(primerNivel([{ id: ID_A, tipo: 'titulo', nivel: 3, texto: 'Un **título**' }])).toEqual([
      { type: 'heading', attrs: { id: ID_A, level: 3 }, content: [texto('Un **título**')] },
    ]);
  });

  it('RF-023: una cita es un blockquote con autor y fuente planos y un párrafo sin atributos', () => {
    expect(
      primerNivel([{ id: ID_A, tipo: 'cita', texto: 'Dicho _famoso_', autor: 'Ana', fuente: 'https://ejemplo.com' }]),
    ).toEqual([
      {
        type: 'blockquote',
        attrs: { id: ID_A, autor: 'Ana', fuente: 'https://ejemplo.com' },
        content: [{ type: 'paragraph', content: [texto('Dicho '), texto('famoso', { type: 'italic' })] }],
      },
    ]);
  });

  it('RF-023: una cita sin autor ni fuente solo lleva el id; un salto guardado es un hardBreak', () => {
    expect(primerNivel([{ id: ID_A, tipo: 'cita', texto: 'Verso uno\nverso dos' }])).toEqual([
      {
        type: 'blockquote',
        attrs: { id: ID_A },
        content: [{ type: 'paragraph', content: [texto('Verso uno'), salto, texto('verso dos')] }],
      },
    ]);
  });

  it.each([
    [false, 'bulletList'],
    [true, 'orderedList'],
  ] as const)('RF-023: una lista con ordenada=%s es una %s con un listItem > paragraph sin atributos por ítem', (ordenada, tipo) => {
    expect(primerNivel([{ id: ID_A, tipo: 'lista', ordenada, items: ['Uno', 'Con **fuerte**'] }])).toEqual([
      {
        type: tipo,
        attrs: { id: ID_A },
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [texto('Uno')] }] },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [texto('Con '), texto('fuerte', { type: 'bold' })] }],
          },
        ],
      },
    ]);
  });

  it('RF-023: un bloque de código es un codeBlock con lenguaje y el texto sin leer marcas', () => {
    expect(primerNivel([{ id: ID_A, tipo: 'codigo', codigo: 'a **b**\nc', lenguaje: 'ts' }])).toEqual([
      { type: 'codeBlock', attrs: { id: ID_A, lenguaje: 'ts' }, content: [texto('a **b**\nc')] },
    ]);
  });

  it('RF-023: un código sin lenguaje ni texto es un codeBlock solo con el id y sin content', () => {
    expect(primerNivel([{ id: ID_A, tipo: 'codigo', codigo: '' }])).toEqual([
      { type: 'codeBlock', attrs: { id: ID_A } },
    ]);
  });

  it('RF-023: un separador es un horizontalRule con el id', () => {
    expect(primerNivel([{ id: ID_A, tipo: 'separador' }])).toEqual([{ type: 'horizontalRule', attrs: { id: ID_A } }]);
  });

  it.each(['imagen', 'galeria', 'cta', 'video'] as const)(
    'RF-023: el bloque %s es el nodo del mismo nombre con los campos del bloque como attrs planos',
    (tipo) => {
      const { tipo: _tipo, ...campos } = bloqueDelCorpus(tipo);

      expect(primerNivel([bloqueDelCorpus(tipo)])).toEqual([{ type: tipo, attrs: campos }]);
    },
  );

  it('RF-023: el video de Vimeo y la imagen decorativa sin leyenda conservan sus campos tal cual', () => {
    const ausentes = CORPUS_CONTENIDOS.find(({ nombre }) => nombre === 'campos opcionales ausentes')?.contenido ?? [];
    const imagen = ausentes.find((b) => b.tipo === 'imagen');
    const vimeo = DIEZ_TIPOS.filter((b) => b.tipo === 'video')[1];
    if (!imagen || !vimeo) throw new Error('Faltan bloques en el corpus');

    const [nodoImagen, nodoVimeo] = primerNivel([imagen, vimeo]);

    const { tipo: _t1, ...camposImagen } = imagen;
    const { tipo: _t2, ...camposVimeo } = vimeo;
    expect(nodoImagen).toEqual({ type: 'imagen', attrs: camposImagen });
    expect(nodoVimeo).toEqual({ type: 'video', attrs: camposVimeo });
  });

  it.each(CASOS_DEL_CORPUS)('D31: "%s" no deja nada de la forma del editor anterior', (_nombre, contenido) => {
    const json = JSON.stringify(bloquesADocumento(contenido));

    for (const clave of ['bloqueId', 'continuacion', '"bloque"', 'imagenBloque', 'galeriaBloque', 'ctaBloque', 'videoBloque']) {
      expect(json).not.toContain(clave);
    }
  });

  it.each(CASOS_DEL_CORPUS)('RF-022: "%s" convertido cumple esquemaDocumento', (_nombre, contenido) => {
    const resultado = esquemaDocumento.safeParse(bloquesADocumento(contenido));

    expect(resultado.error?.issues ?? []).toEqual([]);
  });

  it.each(CASOS_DEL_CORPUS)('D24: "%s" convertido ya está en forma canónica', (_nombre, contenido) => {
    const doc = bloquesADocumento(contenido);

    expect(normalizarDocumento(doc)).toEqual(doc);
  });
});

describe('reducirTramos: lo que tiene que devolver la ida y vuelta (D25 y D26)', () => {
  it('D25: los tramos se unen con una sola línea en blanco', () => {
    expect(reducirTramos([parrafo(ID_A, 'Uno\n\n\nDos\n\n\n\nTres')])).toEqual([parrafo(ID_A, 'Uno\n\nDos\n\nTres')]);
  });

  it('D26: los tramos en blanco se quitan y un párrafo sin tramos visibles desaparece', () => {
    expect(
      reducirTramos([
        parrafo(ID_A, 'A\n\n  \n\nB'),
        parrafo(ID_B, '\n\nB'),
        parrafo(ID_C, 'C\n\n'),
        parrafo('44444444-4444-4444-8444-444444444444', '  '),
      ]),
    ).toEqual([parrafo(ID_A, 'A\n\nB'), parrafo(ID_B, 'B'), parrafo(ID_C, 'C')]);
  });

  it('D25: los saltos simples y los espacios dentro de un tramo no cambian', () => {
    const contenido = [parrafo(ID_A, 'Línea uno\nlínea dos  \n\n con espacios ')];

    expect(reducirTramos(contenido)).toEqual(contenido);
  });

  it.each(
    CASOS_DEL_CORPUS.filter(([, contenido]) =>
      contenido.every((b) => b.tipo !== 'parrafo' || !/\n\s*\n/.test(b.texto)),
    ),
  )('D25: "%s" (sin líneas en blanco) queda igual', (_nombre, contenido) => {
    expect(reducirTramos(contenido)).toEqual(contenido);
  });

  it.each(CASOS_DEL_CORPUS)('D25: es idempotente para "%s"', (_nombre, contenido) => {
    expect(reducirTramos(reducirTramos(contenido))).toEqual(reducirTramos(contenido));
  });

  it('es pura: no modifica el contenido recibido', () => {
    const contenido = [parrafo(ID_A, 'A\n\n\nB')];
    const copia = structuredClone(contenido);

    reducirTramos(contenido);

    expect(contenido).toEqual(copia);
  });
});

describe('ida y vuelta: documentoABloques(bloquesADocumento(c)) es reducirTramos(c) (CE-002, RF-023)', () => {
  it.each(CASOS_DEL_CORPUS)('CE-002: "%s" vuelve con los mismos ids, orden y campos', (_nombre, contenido) => {
    expect(aBloques(bloquesADocumento(contenido))).toEqual(reducirTramos(contenido));
  });

  it.each(CASOS_DEL_CORPUS)('D25: convertir "%s" es repetible (mismos ids en cada corrida)', (_nombre, contenido) => {
    const primera = bloquesADocumento(contenido);

    expect(bloquesADocumento(structuredClone(contenido))).toEqual(primera);
    expect(bloquesADocumento(aBloques(primera))).toEqual(primera);
  });

  it('el documento vacío da []', () => {
    expect(aBloques(documento())).toEqual([]);
  });

  it('D25: los paragraph con los idDeTramo 1, 2… del párrafo anterior se unen a su bloque con una línea en blanco', () => {
    const doc = documento(
      parrafoDoc(ID_A, texto('Uno')),
      parrafoDoc(idDeTramo(ID_A, 1), texto('Dos')),
      parrafoDoc(idDeTramo(ID_A, 2), texto('Tres')),
      parrafoDoc(ID_B, texto('Otro')),
    );

    expect(aBloques(doc)).toEqual([parrafo(ID_A, 'Uno\n\nDos\n\nTres'), parrafo(ID_B, 'Otro')]);
  });

  it('D25: un paragraph con el id de un tramo de otro bloque (no el anterior) es su propio bloque', () => {
    const tramo = idDeTramo(ID_A, 1);
    const doc = documento(parrafoDoc(ID_A, texto('Uno')), parrafoDoc(ID_B, texto('Dos')), parrafoDoc(tramo, texto('Tres')));

    expect(aBloques(doc)).toEqual([parrafo(ID_A, 'Uno'), parrafo(ID_B, 'Dos'), parrafo(tramo, 'Tres')]);
  });

  it('RF-023: hardBreak vuelve a ser un salto de línea simple', () => {
    expect(aBloques(documento(parrafoDoc(ID_A, texto('uno'), salto, texto('dos'))))).toEqual([
      parrafo(ID_A, 'uno\ndos'),
    ]);
  });

  it('RF-023: las marcas vuelven a la gramática anterior', () => {
    const doc = documento(
      parrafoDoc(
        ID_A,
        texto('el blog', { type: 'link', attrs: { href: '/blog' } }),
        texto(' y '),
        texto('fuerte', { type: 'bold' }),
      ),
    );

    expect(aBloques(doc)).toEqual([parrafo(ID_A, '[el blog](/blog) y **fuerte**')]);
  });

  it('RF-023: título, cita, listas, código y separador vuelven con los nombres del formato anterior', () => {
    const doc = documento(
      { type: 'heading', attrs: { id: ID_A, level: 4 }, content: [texto('Título')] },
      {
        type: 'blockquote',
        attrs: { id: ID_B, autor: 'Ana' },
        content: [{ type: 'paragraph', content: [texto('Cita')] }],
      },
      {
        type: 'orderedList',
        attrs: { id: ID_C },
        content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [texto('Uno')] }] }],
      },
      { type: 'codeBlock', attrs: { id: '44444444-4444-4444-8444-444444444444' }, content: [texto('x = 1')] },
      { type: 'horizontalRule', attrs: { id: '55555555-5555-4555-8555-555555555555' } },
    );

    expect(aBloques(doc)).toEqual([
      { id: ID_A, tipo: 'titulo', nivel: 4, texto: 'Título' },
      { id: ID_B, tipo: 'cita', texto: 'Cita', autor: 'Ana' },
      { id: ID_C, tipo: 'lista', ordenada: true, items: ['Uno'] },
      { id: '44444444-4444-4444-8444-444444444444', tipo: 'codigo', codigo: 'x = 1' },
      { id: '55555555-5555-4555-8555-555555555555', tipo: 'separador' },
    ]);
  });

  it.each(['imagen', 'galeria', 'cta', 'video'] as const)(
    'RF-023: el nodo %s vuelve a ser el bloque con sus campos',
    (tipo) => {
      const bloque = bloqueDelCorpus(tipo);
      const { tipo: _tipo, ...campos } = bloque;

      expect(aBloques(documento({ type: tipo, attrs: campos }))).toEqual([bloque]);
    },
  );

  it('los ids existentes se conservan y el orden del documento manda', () => {
    const doc = documento(
      { type: 'horizontalRule', attrs: { id: ID_C } },
      parrafoDoc(ID_A, texto('Uno')),
      { type: 'heading', attrs: { id: ID_B, level: 2 }, content: [texto('Título')] },
    );

    expect(aBloques(doc).map((bloque) => bloque.id)).toEqual([ID_C, ID_A, ID_B]);
  });

  it('es pura: no modifica el documento recibido', () => {
    const doc = bloquesADocumento(DIEZ_TIPOS);
    const copia = structuredClone(doc);

    aBloques(doc);

    expect(doc).toEqual(copia);
  });
});
