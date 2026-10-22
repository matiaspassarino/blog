// T063 (spec 005, H3 esc. 3, 7, 8 y 10; contracts/atajos.md "Una sola ruta para quitar y mover"; research D10 y D19):
// la decisión pura que el plugin `proteger` aplica a TODA transacción que quite o mueva elementos, sin importar la vía
// (menú, atajo, Supr, cortar, escribir sobre la selección, arrastrar, Mod+A y borrar).
//
// FASE ROJA: `./proteger` no existe. API SUPUESTA (T066):
//   decidirBorrado(estado, contexto): Decision
//     estado    el estado ANTES de aplicar la transacción
//     contexto  {
//       transaccion: Transaction                 la que se quiere aplicar (el plugin la recibe en filterTransaction)
//       subidasEnCurso: ReadonlySet<string>      `bloqueId` de los elementos con una subida en curso
//       imagenGuardada: (ruta: string) => boolean  la misma función de `ContextoEditor` (imagen ya guardada en el artículo)
//       confirmado?: boolean                     true cuando la persona ya aceptó el diálogo y la transacción se reintenta
//     }
//   Decision =
//     | { accion: 'permitir'; anuncio?: string }          sin `anuncio` si no se quitó ni se movió nada
//     | { accion: 'bloquear'; anuncio: string }           subida en curso: anuncioSubidaEnCurso()
//     | { accion: 'confirmar'; cantidad: number }         hay imágenes guardadas entre lo que se quita (cantidad = elementos que se quitan)
// La decisión sale de comparar los elementos de primer nivel (por `bloqueId`) del documento antes y después de aplicar
// la transacción: un id que desaparece es un elemento quitado; los mismos ids en otro orden son un elemento movido.
// Los elementos sin id (copias recién duplicadas) no cuentan. Mensajes (anuncios.ts):
//   quitado  "Elemento quitado. Pulsa Ctrl+Z para deshacer" / "3 elementos quitados. Pulsa Ctrl+Z para deshacer"
//   movido   "Elemento movido a la posición N de M"
import { NodeSelection, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import { cita, estadoDe, galeria, imagen, parrafo, posDe, titulo } from './esquema-prueba';
import { decidirBorrado } from './proteger';

const RUTA_GUARDADA = 'articulos/guardada.png';
const RUTA_NUEVA = 'articulos/recien-subida.png';

type Contexto = Parameters<typeof decidirBorrado>[1];
const contextoDe = (
  transaccion: Transaction,
  { subiendo = [], confirmado }: { subiendo?: string[]; confirmado?: boolean } = {},
): Contexto => ({
  transaccion,
  subidasEnCurso: new Set(subiendo),
  imagenGuardada: (ruta: string) => ruta === RUTA_GUARDADA,
  ...(confirmado === undefined ? {} : { confirmado }),
});

/** Documento de cinco elementos: párrafo, imagen guardada, imagen recién subida, cita y título. */
const estadoBase = () =>
  estadoDe(
    parrafo('a', 'Uno'),
    imagen('b', RUTA_GUARDADA),
    imagen('c', RUTA_NUEVA),
    cita('d', 'Una cita', 'Alguien'),
    titulo('e', 'Un título'),
  );

const rangoDe = (estado: EditorState, desde: number, hasta = desde) => ({
  desde: posDe(estado, desde),
  hasta: posDe(estado, hasta + 1),
});
const quitarElementos = (estado: EditorState, desde: number, hasta = desde) => {
  const r = rangoDe(estado, desde, hasta);
  return estado.tr.delete(r.desde, r.hasta);
};

describe('lo que pasa sin más: ediciones que no quitan ni mueven elementos (H3 esc. 8)', () => {
  it('H3-E8: escribir texto se permite sin anuncio', () => {
    const estado = estadoBase();
    const tr = estado.tr.insertText('!', posDe(estado, 0) + 1);

    expect(decidirBorrado(estado, contextoDe(tr))).toEqual({ accion: 'permitir' });
  });

  it('H3-E8: insertar un elemento nuevo se permite sin anuncio', () => {
    const estado = estadoBase();
    const tr = estado.tr.insert(posDe(estado, 1), parrafo('', 'Nuevo'));

    expect(decidirBorrado(estado, contextoDe(tr))).toEqual({ accion: 'permitir' });
  });

  it('H3-E8: asignar el id a un elemento que no lo tenía (asignarIds) no cuenta como quitar', () => {
    const estado = estadoDe(parrafo('a', 'Uno'), parrafo('', 'Copia'));
    const tr = estado.tr.setNodeMarkup(posDe(estado, 1), undefined, { bloqueId: 'nuevo', continuacion: '' });

    expect(decidirBorrado(estado, contextoDe(tr))).toEqual({ accion: 'permitir' });
  });

  it('H3-E8: cambiar el tipo conservando el id (convertir) no cuenta como quitar', () => {
    const estado = estadoBase();
    const tr = estado.tr.setNodeMarkup(posDe(estado, 4), undefined, { bloqueId: 'e', level: 4 });

    expect(decidirBorrado(estado, contextoDe(tr))).toEqual({ accion: 'permitir' });
  });

  it('H3-E8: duplicar (las copias salen sin id) se permite sin anuncio de quitado', () => {
    const estado = estadoBase();
    const tr = estado.tr.insert(posDe(estado, 4), parrafo('', 'Uno'));

    expect(decidirBorrado(estado, contextoDe(tr))).toEqual({ accion: 'permitir' });
  });
});

describe('quitar: se permite y se anuncia con «Ctrl+Z para deshacer» (H3 esc. 7 y 10)', () => {
  it('H3-E7: quitar un elemento sin imagen se permite con el anuncio de un elemento', () => {
    const estado = estadoBase();

    expect(decidirBorrado(estado, contextoDe(quitarElementos(estado, 0)))).toEqual({
      accion: 'permitir',
      anuncio: 'Elemento quitado. Pulsa Ctrl+Z para deshacer',
    });
  });

  it('H3-E10: quitar varios elementos se anuncia con la cantidad', () => {
    const estado = estadoBase();

    expect(decidirBorrado(estado, contextoDe(quitarElementos(estado, 3, 4)))).toEqual({
      accion: 'permitir',
      anuncio: '2 elementos quitados. Pulsa Ctrl+Z para deshacer',
    });
  });

  it('H3-E10: quitar tres elementos dice «3 elementos quitados»', () => {
    const estado = estadoBase();

    const decision = decidirBorrado(estado, contextoDe(quitarElementos(estado, 2, 4)));

    expect(decision).toEqual({
      accion: 'permitir',
      anuncio: '3 elementos quitados. Pulsa Ctrl+Z para deshacer',
    });
  });

  it('H3-E7: una imagen recién subida (todavía no guardada) se quita sin confirmación', () => {
    const estado = estadoBase();

    expect(decidirBorrado(estado, contextoDe(quitarElementos(estado, 2))).accion).toBe('permitir');
  });
});

describe('imagen ya guardada: pide confirmación por cualquier vía (H3 esc. 7 y 10)', () => {
  it('H3-E7: quitar la imagen guardada pide confirmación, sin anuncio todavía', () => {
    const estado = estadoBase();

    expect(decidirBorrado(estado, contextoDe(quitarElementos(estado, 1)))).toEqual({
      accion: 'confirmar',
      cantidad: 1,
    });
  });

  it('H3-E7: con la confirmación ya dada, la misma transacción se permite y se anuncia', () => {
    const estado = estadoBase();
    const tr = quitarElementos(estado, 1);

    expect(decidirBorrado(estado, contextoDe(tr, { confirmado: true }))).toEqual({
      accion: 'permitir',
      anuncio: 'Elemento quitado. Pulsa Ctrl+Z para deshacer',
    });
  });

  it('H3-E7: quitar una galería con alguna imagen guardada también pide confirmación', () => {
    const estado = estadoDe(parrafo('a', 'Uno'), galeria('g', [RUTA_NUEVA, RUTA_GUARDADA]), parrafo('c', 'Tres'));

    expect(decidirBorrado(estado, contextoDe(quitarElementos(estado, 1)))).toEqual({
      accion: 'confirmar',
      cantidad: 1,
    });
  });

  it('H3-E10: quitar varios pide confirmación solo si alguno tiene una imagen ya guardada', () => {
    const estado = estadoBase();

    expect(decidirBorrado(estado, contextoDe(quitarElementos(estado, 0, 1))).accion).toBe('confirmar');
    expect(decidirBorrado(estado, contextoDe(quitarElementos(estado, 2, 4))).accion).toBe('permitir');
  });

  it('H3-E10: al confirmar varios, la cantidad es la de elementos que se quitan', () => {
    const estado = estadoBase();

    expect(decidirBorrado(estado, contextoDe(quitarElementos(estado, 0, 2)))).toEqual({
      accion: 'confirmar',
      cantidad: 3,
    });
  });

  // Todas las vías de borrado producen una transacción distinta; la decisión es la misma.
  const VIAS: { via: string; transaccion: (estado: EditorState) => Transaction }[] = [
    {
      via: 'menú o atajo (borrar el rango de elementos)',
      transaccion: (estado) => quitarElementos(estado, 1),
    },
    {
      via: 'Supr con la isla seleccionada (deleteSelection)',
      transaccion: (estado) => {
        return estado.tr.setSelection(NodeSelection.create(estado.doc, posDe(estado, 1))).deleteSelection();
      },
    },
    {
      via: 'cortar (la selección de la isla se elimina)',
      transaccion: (estado) => {
        return estado.tr.setSelection(NodeSelection.create(estado.doc, posDe(estado, 1))).deleteSelection();
      },
    },
    {
      via: 'escribir sobre la selección de la isla',
      transaccion: (estado) => {
        return estado.tr
          .setSelection(NodeSelection.create(estado.doc, posDe(estado, 1)))
          .replaceSelectionWith(estado.schema.nodes.paragraph!.create({ bloqueId: '' }));
      },
    },
    {
      via: 'Mod+A y borrar (se reemplaza todo el documento)',
      transaccion: (estado) =>
        estado.tr.replaceWith(0, estado.doc.content.size, estado.schema.nodes.paragraph!.create({ bloqueId: '' })),
    },
    {
      via: 'un rango de texto que cruza párrafos hasta la isla y se borra',
      transaccion: (estado) =>
        estado.tr
          .setSelection(TextSelection.create(estado.doc, posDe(estado, 0) + 2, posDe(estado, 3) + 2))
          .deleteSelection(),
    },
  ];

  it.each(VIAS)('H3-E7: por la vía «$via» pide confirmación', ({ transaccion }) => {
    const estado = estadoBase();
    const decision = decidirBorrado(estado, contextoDe(transaccion(estado)));

    expect(decision.accion).toBe('confirmar');
  });
});

describe('subida en curso: no se puede mover ni quitar (H3 esc. 3, 7 y 10)', () => {
  const ANUNCIO = 'Subiendo imagen… No se puede mover ni quitar hasta que termine';

  it('H3-E7: quitar el elemento con la subida en curso se bloquea y se anuncia por qué', () => {
    const estado = estadoBase();
    const decision = decidirBorrado(estado, contextoDe(quitarElementos(estado, 2), { subiendo: ['c'] }));

    expect(decision).toEqual({ accion: 'bloquear', anuncio: ANUNCIO });
  });

  it('H3-E2: mover el elemento con la subida en curso se bloquea', () => {
    const estado = estadoBase();
    const nodo = estado.doc.child(2);
    const tr = estado.tr.delete(posDe(estado, 2), posDe(estado, 3)).insert(posDe(estado, 0), nodo);

    expect(decidirBorrado(estado, contextoDe(tr, { subiendo: ['c'] })).accion).toBe('bloquear');
  });

  it('H3-E10: quitar varios elementos donde uno tiene una subida en curso se bloquea entero', () => {
    const estado = estadoBase();

    expect(decidirBorrado(estado, contextoDe(quitarElementos(estado, 1, 3), { subiendo: ['c'] })).accion).toBe(
      'bloquear',
    );
  });

  it('H3-E7: el bloqueo gana sobre la confirmación (no se pide confirmar algo que no se puede hacer)', () => {
    const estado = estadoBase();
    const decision = decidirBorrado(estado, contextoDe(quitarElementos(estado, 1), { subiendo: ['b'] }));

    expect(decision.accion).toBe('bloquear');
  });

  it('H3-E7: aun con la confirmación dada, una subida en curso bloquea', () => {
    const estado = estadoBase();
    const tr = quitarElementos(estado, 2);

    expect(decidirBorrado(estado, contextoDe(tr, { subiendo: ['c'], confirmado: true })).accion).toBe('bloquear');
  });

  it('H3-E7: quitar OTRO elemento mientras una imagen sube se permite', () => {
    const estado = estadoBase();

    expect(decidirBorrado(estado, contextoDe(quitarElementos(estado, 0), { subiendo: ['c'] })).accion).toBe('permitir');
  });

  it('H3-E7: Mod+A y borrar con una subida en curso se bloquea', () => {
    const estado = estadoBase();
    const tr = estado.tr.replaceWith(
      0,
      estado.doc.content.size,
      estado.schema.nodes.paragraph!.create({ bloqueId: '' }),
    );

    expect(decidirBorrado(estado, contextoDe(tr, { subiendo: ['c'] })).accion).toBe('bloquear');
  });

  it('H3-E7: editar las propiedades del elemento que sube (la subida termina y escribe la ruta) se permite', () => {
    const estado = estadoBase();
    const tr = estado.tr.setNodeMarkup(posDe(estado, 2), undefined, {
      bloqueId: 'c',
      bloque: { id: 'c', tipo: 'imagen', imagen: { ruta: 'articulos/otra.png', ancho: 4, alto: 3, decorativa: true } },
    });

    expect(decidirBorrado(estado, contextoDe(tr, { subiendo: ['c'] }))).toEqual({ accion: 'permitir' });
  });
});

describe('mover: se permite y se anuncia la posición (H3 esc. 2, 3 y 8)', () => {
  const mover = (estado: EditorState, desde: number, haciaAntesDe: number) => {
    const nodo = estado.doc.child(desde);
    const tr = estado.tr.delete(posDe(estado, desde), posDe(estado, desde + 1));
    return tr.insert(tr.mapping.map(posDe(estado, haciaAntesDe), -1), nodo);
  };

  it('H3-E3: arrastrar un elemento a otro lugar se permite con el anuncio de la nueva posición', () => {
    const estado = estadoBase();
    const decision = decidirBorrado(estado, contextoDe(mover(estado, 4, 0)));

    expect(decision.accion).toBe('permitir');
    expect(decision).toMatchObject({ anuncio: 'Elemento movido a la posición 1 de 5' });
  });

  it('H3-E3: mover no pide confirmación aunque el elemento sea la imagen ya guardada', () => {
    const estado = estadoBase();
    const decision = decidirBorrado(estado, contextoDe(mover(estado, 1, 4)));

    expect(decision.accion).toBe('permitir');
    expect(decision).not.toMatchObject({ anuncio: expect.stringContaining('quitado') });
  });

  it('H3-E3: mover no cambia la cantidad de elementos ni se confunde con quitar', () => {
    const estado = estadoBase();
    const decision = decidirBorrado(estado, contextoDe(mover(estado, 0, 3)));

    expect(decision).toMatchObject({
      accion: 'permitir',
      anuncio: expect.stringMatching(/^Elemento movido a la posición \d de 5$/),
    });
  });
});
