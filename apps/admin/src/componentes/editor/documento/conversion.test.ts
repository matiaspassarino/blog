// T016 (spec 005, RF-004, RF-009, RF-012, RF-015, CE-002; contracts/documento.md): correspondencia entre el
// documento del editor (JSON de ProseMirror) y la lista de bloques. Funciones puras, sin React ni Tiptap.
// FASE ROJA: `./conversion` no existe. API supuesta (contracts/documento.md):
//   bloquesADocumento(contenido: Contenido): JSONContent        { type: 'doc', content: [...] }, siempre >= 1 párrafo
//   documentoABloques(doc: JSONContent): Contenido              pura; falla con un bloqueId vacío (no genera ids)
// Nodos: paragraph {bloqueId, continuacion}, heading {level, bloqueId}, blockquote {autor, fuente, bloqueId},
// bulletList/orderedList > listItem > paragraph, codeBlock {lenguaje}, horizontalRule, hardBreak,
// imagenBloque/galeriaBloque/ctaBloque/videoBloque {bloque}. Marcas: bold, italic, code, link {href}.
import { crearBloque, type Contenido } from '@blog/bloques';
import { CORPUS_CONTENIDOS } from '@blog/bloques/pruebas/corpus-contenido';
import { describe, expect, it } from 'vitest';
import { bloquesADocumento, documentoABloques } from './conversion';

type Nodo = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: Nodo[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_C = '33333333-3333-4333-8333-333333333333';

const documento = (...content: Nodo[]): Nodo => ({ type: 'doc', content });
const texto = (text: string, marks?: Nodo['marks']): Nodo => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const parrafoDoc = (bloqueId: string, content: Nodo[] = [], continuacion = ''): Nodo => ({
  type: 'paragraph',
  attrs: { bloqueId, continuacion },
  ...(content.length > 0 ? { content } : {}),
});

const aDocumento = (c: Contenido) => bloquesADocumento(c) as Nodo;
const aBloques = (doc: Nodo) => documentoABloques(doc as Parameters<typeof documentoABloques>[0]);
const hijos = (nodo: Nodo | undefined) => nodo?.content ?? [];
const primerNivel = (c: Contenido) => hijos(aDocumento(c));

describe('ida y vuelta: documentoABloques(bloquesADocumento(c)) === c (CE-002, RF-012)', () => {
  it.each(CORPUS_CONTENIDOS.map(({ nombre, contenido }) => [nombre, contenido] as const))(
    'CE-002: el corpus "%s" vuelve igual (ids, orden y campos)',
    (_nombre, contenido) => {
      expect(aBloques(aDocumento(contenido))).toEqual(contenido);
    },
  );

  it('CE-002: abrir un artículo y no tocarlo no lo ensucia (H5 esc. 1 y 2)', () => {
    for (const { contenido } of CORPUS_CONTENIDOS) {
      const convertido = aBloques(aDocumento(contenido));

      expect(JSON.stringify(convertido)).toBe(JSON.stringify(contenido));
    }
  });

  it('CE-002: convertir dos veces da lo mismo (estable)', () => {
    for (const { contenido } of CORPUS_CONTENIDOS) {
      expect(aDocumento(aBloques(aDocumento(contenido)))).toEqual(aDocumento(contenido));
    }
  });
});

describe('bloquesADocumento: forma del documento (contracts/documento.md)', () => {
  it('RF-012: devuelve un doc', () => {
    expect(aDocumento([]).type).toBe('doc');
  });

  it('RF-012: un contenido vacío da un solo párrafo vacío', () => {
    const doc = aDocumento([]);

    expect(hijos(doc)).toHaveLength(1);
    expect(hijos(doc)[0]?.type).toBe('paragraph');
    expect(hijos(hijos(doc)[0])).toHaveLength(0);
  });

  it('RF-012: todos los elementos de primer nivel llevan el id del bloque como bloqueId', () => {
    for (const { contenido } of CORPUS_CONTENIDOS) {
      const ids = new Set(contenido.map((b) => b.id));

      for (const nodo of primerNivel(contenido)) {
        if (contenido.length > 0) expect(ids.has(String(nodo.attrs?.bloqueId))).toBe(true);
      }
    }
  });

  it('RF-009: un párrafo es un paragraph con su texto', () => {
    const [nodo] = primerNivel([{ id: ID_A, tipo: 'parrafo', texto: 'Hola' }]);

    expect(nodo).toMatchObject({
      type: 'paragraph',
      attrs: { bloqueId: ID_A },
      content: [{ type: 'text', text: 'Hola' }],
    });
  });

  it('RF-004: las marcas pasan a bold, italic, code y link', () => {
    const [nodo] = primerNivel([{ id: ID_A, tipo: 'parrafo', texto: '**a** _b_ `c` [d](/x)' }]);
    const marcas = hijos(nodo).flatMap((hijo) => hijo.marks ?? []);

    expect(marcas.map((marca) => marca.type)).toEqual(['bold', 'italic', 'code', 'link']);
    expect(marcas.find((marca) => marca.type === 'link')?.attrs).toMatchObject({ href: '/x' });
  });

  it('RF-012: un salto simple pasa a hardBreak dentro del mismo párrafo', () => {
    const [nodo] = primerNivel([{ id: ID_A, tipo: 'parrafo', texto: 'uno\ndos' }]);

    expect(hijos(nodo).map((hijo) => hijo.type)).toEqual(['text', 'hardBreak', 'text']);
  });

  it('RF-012: una línea en blanco parte en párrafos: el primero con el id y los siguientes con continuacion exacta', () => {
    const nodos = primerNivel([{ id: ID_A, tipo: 'parrafo', texto: 'Uno\n\nDos\n\n\nTres' }]);

    expect(nodos.map((nodo) => nodo.type)).toEqual(['paragraph', 'paragraph', 'paragraph']);
    expect(nodos.map((nodo) => nodo.attrs?.bloqueId)).toEqual([ID_A, ID_A, ID_A]);
    expect(nodos.map((nodo) => nodo.attrs?.continuacion || '')).toEqual(['', '\n\n', '\n\n\n']);
  });

  it('RF-012: un tramo vacío es un paragraph sin hijos (ProseMirror no admite text vacío)', () => {
    const nodos = primerNivel([{ id: ID_A, tipo: 'parrafo', texto: 'A\n\n' }]);

    expect(nodos).toHaveLength(2);
    expect(hijos(nodos[1])).toHaveLength(0);
    expect(nodos[1]?.attrs?.continuacion).toBe('\n\n');
  });

  it('RF-012: un tramo de solo espacios conserva ese texto', () => {
    const nodos = primerNivel([{ id: ID_A, tipo: 'parrafo', texto: 'A\n\n  \n\nB' }]);

    expect(hijos(nodos[1])).toEqual([{ type: 'text', text: '  ' }]);
  });

  it('RF-009: un título es un heading con level y el texto sin marcas', () => {
    const [nodo] = primerNivel([{ id: ID_A, tipo: 'titulo', nivel: 3, texto: 'Un **título**' }]);

    expect(nodo).toMatchObject({ type: 'heading', attrs: { level: 3, bloqueId: ID_A } });
    expect(hijos(nodo)).toEqual([{ type: 'text', text: 'Un **título**' }]);
  });

  it('RF-009: una cita es un blockquote con autor, fuente y un párrafo en línea', () => {
    const [nodo] = primerNivel([
      { id: ID_A, tipo: 'cita', texto: 'Dicho _famoso_', autor: 'Ana', fuente: 'https://ejemplo.com' },
    ]);

    expect(nodo).toMatchObject({
      type: 'blockquote',
      attrs: { autor: 'Ana', fuente: 'https://ejemplo.com', bloqueId: ID_A },
    });
    expect(hijos(nodo)).toHaveLength(1);
    expect(hijos(nodo)[0]?.type).toBe('paragraph');
    expect(hijos(hijos(nodo)[0]).some((hijo) => hijo.marks?.some((marca) => marca.type === 'italic'))).toBe(true);
  });

  it.each([
    [false, 'bulletList'],
    [true, 'orderedList'],
  ])('RF-009: una lista con ordenada=%s es una %s con un listItem > paragraph por ítem', (ordenada, tipo) => {
    const [nodo] = primerNivel([{ id: ID_A, tipo: 'lista', ordenada, items: ['Uno', 'Dos **fuerte**'] }]);

    expect(nodo?.type).toBe(tipo);
    expect(nodo?.attrs?.bloqueId).toBe(ID_A);
    expect(hijos(nodo).map((item) => item.type)).toEqual(['listItem', 'listItem']);
    expect(hijos(nodo).map((item) => hijos(item)[0]?.type)).toEqual(['paragraph', 'paragraph']);
  });

  it('RF-009: un bloque de código es un codeBlock con lenguaje y el texto sin marcas', () => {
    const [nodo] = primerNivel([{ id: ID_A, tipo: 'codigo', codigo: 'a **b**\nc', lenguaje: 'ts' }]);

    expect(nodo).toMatchObject({ type: 'codeBlock', attrs: { lenguaje: 'ts', bloqueId: ID_A } });
    expect(hijos(nodo)).toEqual([{ type: 'text', text: 'a **b**\nc' }]);
  });

  it('RF-009: un separador es un horizontalRule', () => {
    const [nodo] = primerNivel([{ id: ID_A, tipo: 'separador' }]);

    expect(nodo).toMatchObject({ type: 'horizontalRule', attrs: { bloqueId: ID_A } });
  });

  it.each([
    ['imagen', 'imagenBloque'],
    ['galeria', 'galeriaBloque'],
    ['cta', 'ctaBloque'],
    ['video', 'videoBloque'],
  ] as const)('RF-009: el bloque %s es un nodo %s con el bloque entero como atributo', (tipo, nodoEsperado) => {
    const bloque = CORPUS_CONTENIDOS.find(({ nombre }) => nombre === 'los diez tipos')?.contenido.find(
      (b) => b.tipo === tipo,
    );
    if (!bloque) throw new Error(`Falta el bloque ${tipo} en el corpus`);

    const [nodo] = primerNivel([bloque]);

    expect(nodo?.type).toBe(nodoEsperado);
    expect(nodo?.attrs?.bloque).toEqual(bloque);
    expect(nodo?.attrs?.bloqueId).toBe(bloque.id);
  });
});

describe('documentoABloques: reglas de la inversa (contracts/documento.md)', () => {
  it('RF-012: el documento vacío (un solo párrafo vacío) da []', () => {
    expect(aBloques(documento(parrafoDoc('')))).toEqual([]);
  });

  it('RF-012: un doc sin hijos da []', () => {
    expect(aBloques({ type: 'doc' })).toEqual([]);
  });

  it('RF-012: bloquesADocumento([]) y documentoABloques vuelven a []', () => {
    expect(aBloques(aDocumento([]))).toEqual([]);
  });

  it('RF-012: un párrafo vacío de primer nivel no genera bloque cuando hay más elementos', () => {
    const doc = documento(parrafoDoc(ID_A, [texto('Uno')]), parrafoDoc(''), parrafoDoc(ID_B, [texto('Dos')]));

    expect(aBloques(doc)).toEqual([
      { id: ID_A, tipo: 'parrafo', texto: 'Uno' },
      { id: ID_B, tipo: 'parrafo', texto: 'Dos' },
    ]);
  });

  it('RF-012: un paragraph con continuacion aunque esté vacío se conserva y aporta su separador', () => {
    const doc = documento(parrafoDoc(ID_A, [texto('A')]), parrafoDoc(ID_A, [], '\n\n'));

    expect(aBloques(doc)).toEqual([{ id: ID_A, tipo: 'parrafo', texto: 'A\n\n' }]);
  });

  it('RF-012: los párrafos con continuacion se unen al bloque anterior con su separador exacto', () => {
    const doc = documento(
      parrafoDoc(ID_A, [texto('Uno')]),
      parrafoDoc(ID_A, [texto('Dos')], '\n\n\n'),
      parrafoDoc(ID_B, [texto('Tres')]),
    );

    expect(aBloques(doc)).toEqual([
      { id: ID_A, tipo: 'parrafo', texto: 'Uno\n\n\nDos' },
      { id: ID_B, tipo: 'parrafo', texto: 'Tres' },
    ]);
  });

  it('RF-012: hardBreak vuelve a ser un salto de línea simple', () => {
    const doc = documento(parrafoDoc(ID_A, [texto('uno'), { type: 'hardBreak' }, texto('dos')]));

    expect(aBloques(doc)).toEqual([{ id: ID_A, tipo: 'parrafo', texto: 'uno\ndos' }]);
  });

  it('RF-004: las marcas se serializan y se normalizan (los espacios de los bordes salen del marcador)', () => {
    const doc = documento(parrafoDoc(ID_A, [texto('palabra ', [{ type: 'bold' }]), texto('sigue')]));

    expect(aBloques(doc)).toEqual([{ id: ID_A, tipo: 'parrafo', texto: '**palabra** sigue' }]);
  });

  it('RF-004: un enlace con marca link se serializa como [texto](url)', () => {
    const doc = documento(parrafoDoc(ID_A, [texto('el blog', [{ type: 'link', attrs: { href: '/blog' } }])]));

    expect(aBloques(doc)).toEqual([{ id: ID_A, tipo: 'parrafo', texto: '[el blog](/blog)' }]);
  });

  it('RF-015 / regla 3: un párrafo nuevo (Enter) con otro id es otro bloque; no hereda continuacion', () => {
    const doc = documento(parrafoDoc(ID_A, [texto('Uno')]), parrafoDoc(ID_B, [texto('Dos')]));

    expect(aBloques(doc).map((bloque) => bloque.id)).toEqual([ID_A, ID_B]);
  });

  it('RF-012: los campos opcionales vacíos se omiten (no se guarda "")', () => {
    const doc = documento(
      {
        type: 'blockquote',
        attrs: { bloqueId: ID_A, autor: '', fuente: '' },
        content: [parrafoDoc('', [texto('Cita')])],
      },
      { type: 'codeBlock', attrs: { bloqueId: ID_B, lenguaje: '' }, content: [texto('x = 1')] },
    );
    const [cita, codigo] = aBloques(doc);

    expect(cita).toEqual({ id: ID_A, tipo: 'cita', texto: 'Cita' });
    expect('autor' in (cita ?? {})).toBe(false);
    expect('fuente' in (cita ?? {})).toBe(false);
    expect(codigo).toEqual({ id: ID_B, tipo: 'codigo', codigo: 'x = 1' });
    expect('lenguaje' in (codigo ?? {})).toBe(false);
  });

  it('RF-012: la leyenda vacía de una imagen se omite', () => {
    const imagen = { ...crearBloque('imagen'), id: ID_A, leyenda: '' };
    const doc = documento({ type: 'imagenBloque', attrs: { bloqueId: ID_A, bloque: imagen } });
    const [bloque] = aBloques(doc);

    expect(bloque).toBeDefined();
    expect('leyenda' in (bloque ?? {})).toBe(false);
  });

  it('RF-012: la lista ordenada y la de viñetas conservan "ordenada"', () => {
    const item = (t: string): Nodo => ({ type: 'listItem', content: [parrafoDoc('', [texto(t)])] });
    const doc = documento(
      { type: 'orderedList', attrs: { bloqueId: ID_A }, content: [item('Uno'), item('Dos')] },
      { type: 'bulletList', attrs: { bloqueId: ID_B }, content: [item('Tres')] },
    );

    expect(aBloques(doc)).toEqual([
      { id: ID_A, tipo: 'lista', ordenada: true, items: ['Uno', 'Dos'] },
      { id: ID_B, tipo: 'lista', ordenada: false, items: ['Tres'] },
    ]);
  });

  it('regla 4: un ítem de lista con salto de línea guardado se conserva', () => {
    const contenido: Contenido = [{ id: ID_A, tipo: 'lista', ordenada: false, items: ['uno\ndos', 'tres'] }];

    expect(aBloques(aDocumento(contenido))).toEqual(contenido);
  });

  it('regla 4: una cita con salto de línea guardado se conserva', () => {
    const contenido: Contenido = [{ id: ID_A, tipo: 'cita', texto: 'verso uno\nverso dos' }];

    expect(aBloques(aDocumento(contenido))).toEqual(contenido);
  });

  it('un bloqueId vacío en un elemento con contenido hace fallar (no genera ids)', () => {
    expect(() => aBloques(documento(parrafoDoc('', [texto('Con texto')])))).toThrow();
    expect(() => aBloques(documento({ type: 'horizontalRule', attrs: { bloqueId: '' } }))).toThrow();
  });

  it('un bloqueId ausente (null) también hace fallar', () => {
    expect(() =>
      aBloques(documento({ type: 'heading', attrs: { level: 2, bloqueId: null }, content: [texto('T')] })),
    ).toThrow();
  });

  it('los ids existentes se conservan y el orden del documento manda', () => {
    const doc = documento({ type: 'horizontalRule', attrs: { bloqueId: ID_C } }, parrafoDoc(ID_A, [texto('Uno')]), {
      type: 'heading',
      attrs: { level: 4, bloqueId: ID_B },
      content: [texto('Titulo')],
    });

    expect(aBloques(doc).map((bloque) => bloque.id)).toEqual([ID_C, ID_A, ID_B]);
  });

  it('es pura: no modifica el documento recibido', () => {
    const doc = aDocumento(CORPUS_CONTENIDOS[2]?.contenido ?? []);
    const copia = structuredClone(doc);

    aBloques(doc);

    expect(doc).toEqual(copia);
  });
});
