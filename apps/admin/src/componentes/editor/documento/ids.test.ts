// T017 (spec 005, RF-012; research D6, D12, D21; data-model "Atributos de los nodos"): identidad estable de los
// elementos del documento.
// FASE ROJA: `./ids` no existe. API supuesta:
//   asegurarIds(doc: JSONContent): JSONContent    pura; devuelve un documento nuevo (no muta el recibido)
// Reglas: un elemento de primer nivel con bloqueId vacío recibe un uuid (una sola vez); los ids existentes se
// conservan; un id repetido se deduplica (queda el primero); los párrafos con `continuacion` comparten, a propósito,
// el id del párrafo anterior y no se tocan; un elemento nuevo no recibe `continuacion`; es idempotente.
// Pendiente fuera de esta tarea: que `bloqueId` y `continuacion` no salgan en el HTML del portapapeles es un atributo
// de la extensión de Tiptap (`rendered: false`, T040 en adelante) y se prueba allí y en E2E (editor-documento.spec.ts).
import { describe, expect, it } from 'vitest';
import { asegurarIds } from './ids';

type Nodo = { type?: string; attrs?: Record<string, unknown>; content?: Nodo[]; text?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

const parrafo = (bloqueId: string | null | undefined, extra: Record<string, unknown> = {}): Nodo => ({
  type: 'paragraph',
  attrs: { ...(bloqueId === undefined ? {} : { bloqueId }), ...extra },
  content: [{ type: 'text', text: 'x' }],
});
const documento = (...content: Nodo[]): Nodo => ({ type: 'doc', content });

const asegurar = (doc: Nodo) => asegurarIds(doc as Parameters<typeof asegurarIds>[0]) as Nodo;
const ids = (doc: Nodo) => (doc.content ?? []).map((nodo) => nodo.attrs?.bloqueId);

describe('asegurarIds: asignación (RF-012, D21)', () => {
  it('asigna un uuid a un elemento con bloqueId vacío', () => {
    const resultado = asegurar(documento(parrafo('')));

    expect(ids(resultado)[0]).toMatch(UUID);
  });

  it.each([[''], [null], [undefined]])('trata %j como vacío y le asigna un uuid', (vacio) => {
    const resultado = asegurar(documento(parrafo(vacio)));

    expect(ids(resultado)[0]).toMatch(UUID);
  });

  it('asigna uuids distintos a varios elementos vacíos', () => {
    const resultado = asegurar(
      documento(
        parrafo(''),
        { type: 'heading', attrs: { level: 2, bloqueId: '' } },
        { type: 'horizontalRule', attrs: { bloqueId: '' } },
      ),
    );

    expect(new Set(ids(resultado)).size).toBe(3);
    for (const id of ids(resultado)) expect(id).toMatch(UUID);
  });

  it('conserva los ids existentes', () => {
    const resultado = asegurar(documento(parrafo(ID_A), parrafo(ID_B)));

    expect(ids(resultado)).toEqual([ID_A, ID_B]);
  });

  it('asigna solo a los vacíos y deja el resto igual', () => {
    const resultado = asegurar(documento(parrafo(ID_A), parrafo(''), parrafo(ID_B)));

    expect(ids(resultado)[0]).toBe(ID_A);
    expect(ids(resultado)[1]).toMatch(UUID);
    expect(ids(resultado)[2]).toBe(ID_B);
  });

  it('solo mira el primer nivel: los párrafos dentro de ítems de lista y citas no reciben id', () => {
    const lista: Nodo = {
      type: 'bulletList',
      attrs: { bloqueId: '' },
      content: [{ type: 'listItem', content: [parrafo(undefined)] }],
    };
    const cita: Nodo = { type: 'blockquote', attrs: { bloqueId: '' }, content: [parrafo(undefined)] };

    const resultado = asegurar(documento(lista, cita));

    expect(resultado.content?.[0]?.content?.[0]?.content?.[0]?.attrs?.bloqueId).toBeUndefined();
    expect(resultado.content?.[1]?.content?.[0]?.attrs?.bloqueId).toBeUndefined();
    expect(ids(resultado)[0]).toMatch(UUID);
    expect(ids(resultado)[1]).toMatch(UUID);
  });

  it('un elemento nuevo no recibe continuacion', () => {
    const resultado = asegurar(documento(parrafo('')));

    const continuacion = resultado.content?.[0]?.attrs?.continuacion;
    expect(continuacion === undefined || continuacion === null || continuacion === '').toBe(true);
  });

  it('no inventa continuacion en un elemento que no es párrafo', () => {
    const resultado = asegurar(documento({ type: 'horizontalRule', attrs: { bloqueId: '' } }));

    expect(resultado.content?.[0]?.attrs).not.toHaveProperty('continuacion');
  });

  it('un documento sin elementos queda igual', () => {
    expect(asegurar({ type: 'doc' })).toEqual({ type: 'doc' });
  });
});

describe('asegurarIds: duplicados (R10, regla 3 de la correspondencia)', () => {
  it('deduplica dos elementos con el mismo id: queda el primero', () => {
    const resultado = asegurar(documento(parrafo(ID_A), parrafo(ID_A)));

    expect(ids(resultado)[0]).toBe(ID_A);
    expect(ids(resultado)[1]).toMatch(UUID);
    expect(ids(resultado)[1]).not.toBe(ID_A);
  });

  it('deduplica varias copias y todos los ids terminan distintos', () => {
    const resultado = asegurar(documento(parrafo(ID_A), parrafo(ID_B), parrafo(ID_A), parrafo(ID_A), parrafo(ID_B)));

    expect(new Set(ids(resultado)).size).toBe(5);
    expect(ids(resultado)[0]).toBe(ID_A);
    expect(ids(resultado)[1]).toBe(ID_B);
  });

  it('el duplicado de un elemento especial conserva su contenido y cambia solo el id', () => {
    const bloque = { id: ID_A, tipo: 'imagen', imagen: { ruta: 'r', ancho: 1, alto: 1, alt: 'a', decorativa: false } };
    const nodo: Nodo = { type: 'imagenBloque', attrs: { bloqueId: ID_A, bloque } };

    const resultado = asegurar(documento(nodo, structuredClone(nodo)));

    expect(resultado.content?.[1]?.attrs?.bloque).toEqual(bloque);
    expect(ids(resultado)[1]).not.toBe(ID_A);
  });

  it('los párrafos con continuacion comparten el id del anterior a propósito y no se deduplican', () => {
    const resultado = asegurar(
      documento(parrafo(ID_A), parrafo(ID_A, { continuacion: '\n\n' }), parrafo(ID_A, { continuacion: '\n\n\n' })),
    );

    expect(ids(resultado)).toEqual([ID_A, ID_A, ID_A]);
    expect(resultado.content?.map((nodo) => nodo.attrs?.continuacion ?? '')).toEqual(['', '\n\n', '\n\n\n']);
  });

  it('un párrafo con continuacion cuyo id ya lo usa un elemento anterior que no es su par se deduplica', () => {
    const resultado = asegurar(documento(parrafo(ID_A), parrafo(ID_B), parrafo(ID_A, { continuacion: '\n\n' })));

    expect(ids(resultado)[0]).toBe(ID_A);
    expect(ids(resultado)[2]).toMatch(UUID);
    expect(ids(resultado)[2]).not.toBe(ID_A);
  });
});

describe('asegurarIds: pureza e idempotencia (D6, D12)', () => {
  it('es idempotente: aplicarlo dos veces no cambia los ids (se asignan una sola vez)', () => {
    const una = asegurar(documento(parrafo(''), parrafo(ID_A), parrafo(ID_A), parrafo('')));
    const dos = asegurar(una);

    expect(dos).toEqual(una);
    expect(ids(dos)).toEqual(ids(una));
  });

  it('un documento que ya tiene ids únicos queda igual', () => {
    const doc = documento(parrafo(ID_A), parrafo(ID_B));

    expect(asegurar(doc)).toEqual(doc);
  });

  it('no muta el documento recibido', () => {
    const doc = documento(parrafo(''), parrafo(ID_A), parrafo(ID_A));
    const copia = structuredClone(doc);

    asegurar(doc);

    expect(doc).toEqual(copia);
  });

  it('conserva el resto del documento (tipos, atributos y contenido)', () => {
    const heading: Nodo = {
      type: 'heading',
      attrs: { level: 3, bloqueId: '' },
      content: [{ type: 'text', text: 'T' }],
    };

    const resultado = asegurar(documento(heading));

    expect(resultado.content?.[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: 'T' }],
    });
  });
});
