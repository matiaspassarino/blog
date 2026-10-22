// T062 (spec 005, H3 esc. 2, 5, 6, 7, 9, 10 y 11; contracts/componentes.md "comandos.ts y proteger.ts"; research D10, D11,
// D20; contracts/atajos.md "Dos modos de selección"): comandos de rango sobre el documento, con ProseMirror puro
// (esquema mínimo de ./esquema-prueba, sin React, sin DOM).
//
// FASE ROJA: `rangoDeElementos`, `moverRango`, `duplicarRango`, `quitarRango`, `convertirElemento`, `pierdeAlConvertir`,
// `seleccionarElementos` y `ampliarSeleccion` no existen todavía en ./comandos, y `claveModo` no sale de ./claves.
//
// API SUPUESTA (T065). Los cuatro primeros son los del contrato; los otros cuatro los agrega esta prueba porque el
// contrato los necesita pero no los nombra:
//   claveModo: PluginKey<boolean>                      exportada desde ./claves; true = modo elementos (ver esquema-prueba)
//   rangoDeElementos(estado): { desde, hasta } | null  posiciones del documento que abarcan los elementos de primer nivel
//                                                      seleccionados (antes del primero y después del último); null fuera
//                                                      del modo elementos, aunque haya un rango de texto
//   moverRango(direccion: -1 | 1): Command             Alt+↑ / Alt+↓; false en los extremos sin despachar nada
//   duplicarRango(): Command                           copia justo debajo; copias con bloqueId ''; la selección pasa a las copias
//   quitarRango(): Command                             sale del modo; el foco queda en el contiguo; nunca deja el documento vacío
//   convertirElemento(tipo, opciones?): Command        solo con UN elemento de texto; conserva bloqueId y texto; false si no aplica
//   pierdeAlConvertir(estado, tipo, opciones?): { pierde: string[] }   lo que el contrato describe como "devuelve { pierde }":
//                                                      la interfaz lo consulta antes de despachar `convertirElemento`
//   seleccionarElementos(desdeIndice, hastaIndice): Command   entra al modo elementos con esos elementos (índices desde 0)
//   ampliarSeleccion(direccion: -1 | 1): Command       Shift+↑ / Shift+↓ en modo elementos: suma el contiguo
//   TipoDeTexto = 'parrafo' | 'titulo' | 'cita' | 'lista' | 'codigo'
// Todo comando sigue la convención de ProseMirror: `(estado, despachar?) => boolean`; sin `despachar` solo responde si es
// posible. Cada acción despacha UNA transacción (un Deshacer la revierte).
import { undo } from '@tiptap/pm/history';
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { describe, expect, it } from 'vitest';
import {
  ampliarSeleccion,
  convertirElemento,
  duplicarRango,
  moverRango,
  pierdeAlConvertir,
  quitarRango,
  rangoDeElementos,
  seleccionarElementos,
} from './comandos';
import {
  cita,
  estadoDe,
  idsDe,
  imagen,
  lista,
  parrafo,
  parrafoConNegrita,
  posDe,
  separador,
  titulo,
} from './esquema-prueba';

type Comando = (estado: EditorState, despachar?: (tr: Transaction) => void) => boolean;

/** Ejecuta un comando y devuelve el estado resultante, lo que respondió y cuántas transacciones despachó. */
function ejecutar(estado: EditorState, comando: Comando) {
  const transacciones: Transaction[] = [];
  const respuesta = comando(estado, (tr) => transacciones.push(tr));
  const siguiente = transacciones.reduce((acumulado, tr) => acumulado.apply(tr), estado);
  return { respuesta, transacciones: transacciones.length, estado: siguiente };
}

/** Estado en modo elementos con los elementos `desde..hasta` (índices desde 0) seleccionados. */
function enModo(estado: EditorState, desde: number, hasta = desde) {
  const { estado: conModo, respuesta } = ejecutar(estado, seleccionarElementos(desde, hasta));
  expect(respuesta, 'seleccionarElementos').toBe(true);
  return conModo;
}

const ID = { a: 'a', b: 'b', c: 'c', d: 'd', e: 'e' };
const cincoParrafos = () =>
  estadoDe(
    parrafo(ID.a, 'Uno'),
    parrafo(ID.b, 'Dos'),
    parrafo(ID.c, 'Tres'),
    parrafo(ID.d, 'Cuatro'),
    parrafo(ID.e, 'Cinco'),
  );
const textos = (estado: EditorState) =>
  Array.from({ length: estado.doc.childCount }, (_, i) => estado.doc.child(i).textContent);

describe('rangoDeElementos: solo existe en modo elementos (H3 esc. 9)', () => {
  it('H3-E9: fuera del modo elementos no hay rango, ni siquiera con el cursor dentro de un elemento', () => {
    const estado = cincoParrafos();

    expect(rangoDeElementos(estado)).toBeNull();
  });

  it('H3-E9: un rango de texto que cruza párrafos no es una selección de elementos', () => {
    const base = cincoParrafos();
    const desde = posDe(base, 1) + 2; // dentro de "Dos"
    const hasta = posDe(base, 3) + 2; // dentro de "Cuatro"
    const estado = base.apply(base.tr.setSelection(TextSelection.create(base.doc, desde, hasta)));

    expect(rangoDeElementos(estado)).toBeNull();
  });

  it('H3-E9: con un elemento seleccionado en modo elementos, el rango abarca ese elemento entero', () => {
    const base = cincoParrafos();
    const estado = enModo(base, 2);

    expect(rangoDeElementos(estado)).toEqual({ desde: posDe(base, 2), hasta: posDe(base, 3) });
  });

  it('H3-E9: con varios seleccionados, el rango va del inicio del primero al final del último', () => {
    const base = cincoParrafos();
    const estado = enModo(base, 1, 3);

    expect(rangoDeElementos(estado)).toEqual({ desde: posDe(base, 1), hasta: posDe(base, 4) });
  });

  it('H3-E9: un elemento especial (isla) seleccionado en modo elementos también da su rango', () => {
    const base = estadoDe(parrafo(ID.a, 'Uno'), imagen(ID.b, 'articulos/a.png'), parrafo(ID.c, 'Tres'));
    const estado = enModo(base, 1);

    expect(rangoDeElementos(estado)).toEqual({ desde: posDe(base, 1), hasta: posDe(base, 2) });
  });
});

describe('ampliarSeleccion: Shift+↑ y Shift+↓ en modo elementos (H3 esc. 9)', () => {
  it('H3-E9: Shift+↓ suma el elemento contiguo de abajo', () => {
    const base = cincoParrafos();
    const { estado, respuesta } = ejecutar(enModo(base, 1), ampliarSeleccion(1));

    expect(respuesta).toBe(true);
    expect(rangoDeElementos(estado)).toEqual({ desde: posDe(base, 1), hasta: posDe(base, 3) });
  });

  it('H3-E9: Shift+↑ suma el elemento contiguo de arriba', () => {
    const base = cincoParrafos();
    const { estado } = ejecutar(enModo(base, 2), ampliarSeleccion(-1));

    expect(rangoDeElementos(estado)).toEqual({ desde: posDe(base, 1), hasta: posDe(base, 3) });
  });

  it('H3-E9: en el último elemento, Shift+↓ no hace nada', () => {
    const { respuesta, transacciones } = ejecutar(enModo(cincoParrafos(), 4), ampliarSeleccion(1));

    expect(respuesta).toBe(false);
    expect(transacciones).toBe(0);
  });

  it('H3-E9: fuera del modo elementos no amplía nada (el rango de texto es de la librería)', () => {
    const { respuesta, transacciones } = ejecutar(cincoParrafos(), ampliarSeleccion(1));

    expect(respuesta).toBe(false);
    expect(transacciones).toBe(0);
  });
});

describe('moverRango: Alt+↑ y Alt+↓ (H3 esc. 2 y 10)', () => {
  it('H3-E2: «Subir» intercambia el elemento con el de arriba, en una sola transacción', () => {
    const { estado, respuesta, transacciones } = ejecutar(enModo(cincoParrafos(), 2), moverRango(-1));

    expect(respuesta).toBe(true);
    expect(transacciones).toBe(1);
    expect(idsDe(estado)).toEqual([ID.a, ID.c, ID.b, ID.d, ID.e]);
    expect(textos(estado)).toEqual(['Uno', 'Tres', 'Dos', 'Cuatro', 'Cinco']);
  });

  it('H3-E2: «Bajar» intercambia el elemento con el de abajo', () => {
    const { estado } = ejecutar(enModo(cincoParrafos(), 2), moverRango(1));

    expect(idsDe(estado)).toEqual([ID.a, ID.b, ID.d, ID.c, ID.e]);
  });

  it('H3-E2: «Subir» en el primero y «Bajar» en el último devuelven false y no despachan nada', () => {
    const primero = ejecutar(enModo(cincoParrafos(), 0), moverRango(-1));
    const ultimo = ejecutar(enModo(cincoParrafos(), 4), moverRango(1));

    expect(primero.respuesta).toBe(false);
    expect(primero.transacciones).toBe(0);
    expect(ultimo.respuesta).toBe(false);
    expect(ultimo.transacciones).toBe(0);
  });

  it('H3-E2: sin función de despacho solo responde si se puede (para deshabilitar «Subir»/«Bajar» en los extremos)', () => {
    const medio = enModo(cincoParrafos(), 2);
    const primero = enModo(cincoParrafos(), 0);

    expect(moverRango(-1)(medio)).toBe(true);
    expect(moverRango(-1)(primero)).toBe(false);
    expect(moverRango(1)(primero)).toBe(true);
  });

  it('H3-E2: el elemento movido sigue seleccionado en modo elementos (se puede repetir Alt+↑)', () => {
    const base = cincoParrafos();
    const { estado } = ejecutar(enModo(base, 3), moverRango(-1));

    expect(rangoDeElementos(estado)).toEqual({ desde: posDe(base, 2), hasta: posDe(base, 3) });
    const otraVez = ejecutar(estado, moverRango(-1));
    expect(idsDe(otraVez.estado)).toEqual([ID.a, ID.d, ID.b, ID.c, ID.e]);
  });

  it('H3-E10: con varios seleccionados, «Subir» mueve el conjunto como bloque, en un solo paso', () => {
    const { estado, respuesta, transacciones } = ejecutar(enModo(cincoParrafos(), 2, 3), moverRango(-1));

    expect(respuesta).toBe(true);
    expect(transacciones).toBe(1);
    expect(idsDe(estado)).toEqual([ID.a, ID.c, ID.d, ID.b, ID.e]);
  });

  it('H3-E10: con varios seleccionados, «Bajar» mueve el conjunto como bloque', () => {
    const { estado } = ejecutar(enModo(cincoParrafos(), 1, 2), moverRango(1));

    expect(idsDe(estado)).toEqual([ID.a, ID.d, ID.b, ID.c, ID.e]);
  });

  it('H3-E10: el conjunto que ya toca un extremo no se puede mover hacia ese lado', () => {
    expect(moverRango(-1)(enModo(cincoParrafos(), 0, 2))).toBe(false);
    expect(moverRango(1)(enModo(cincoParrafos(), 3, 4))).toBe(false);
  });

  it('H3-E10: un solo Deshacer revierte mover varios elementos', () => {
    const base = cincoParrafos();
    const { estado } = ejecutar(enModo(base, 2, 3), moverRango(-1));
    let revertido: EditorState = estado;
    undo(estado, (tr) => (revertido = estado.apply(tr)));

    expect(idsDe(revertido)).toEqual(idsDe(base));
  });

  it('H3-E2: fuera del modo elementos, un rango de texto que cruza párrafos no habilita mover', () => {
    const base = cincoParrafos();
    const estado = base.apply(
      base.tr.setSelection(TextSelection.create(base.doc, posDe(base, 1) + 2, posDe(base, 3) + 2)),
    );
    const { respuesta, transacciones } = ejecutar(estado, moverRango(-1));

    expect(respuesta).toBe(false);
    expect(transacciones).toBe(0);
  });

  it('H3-E2: mueve elementos de todos los tipos (título, lista, cita, imagen) sin tocar sus datos', () => {
    const base = estadoDe(
      titulo(ID.a, 'Un título', 3),
      lista(ID.b, ['x', 'y'], true),
      cita(ID.c, 'Una cita', 'Alguien', 'https://example.com'),
      imagen(ID.d, 'articulos/a.png'),
    );
    const { estado } = ejecutar(enModo(base, 3), moverRango(-1));

    expect(idsDe(estado)).toEqual([ID.a, ID.b, ID.d, ID.c]);
    expect(estado.doc.child(2).attrs.bloque).toEqual(base.doc.child(3).attrs.bloque);
    expect(estado.doc.child(3).attrs).toMatchObject({ autor: 'Alguien', fuente: 'https://example.com' });
  });
});

describe('duplicarRango: Mod+D (H3 esc. 5 y 10)', () => {
  it('H3-E5: la copia aparece justo debajo con el mismo texto y un identificador vacío (se completa al serializar)', () => {
    const { estado, respuesta, transacciones } = ejecutar(enModo(cincoParrafos(), 1), duplicarRango());

    expect(respuesta).toBe(true);
    expect(transacciones).toBe(1);
    expect(textos(estado)).toEqual(['Uno', 'Dos', 'Dos', 'Tres', 'Cuatro', 'Cinco']);
    expect(idsDe(estado)).toEqual([ID.a, ID.b, '', ID.c, ID.d, ID.e]);
  });

  it('H3-E5: la selección pasa a la copia (el foco queda en ella)', () => {
    const base = cincoParrafos();
    const { estado } = ejecutar(enModo(base, 1), duplicarRango());

    expect(rangoDeElementos(estado)).toEqual({ desde: posDe(base, 2), hasta: posDe(base, 3) });
  });

  it('H3-E5: duplicar un elemento especial copia sus datos y deja el identificador de la copia vacío', () => {
    const base = estadoDe(parrafo(ID.a, 'Uno'), imagen(ID.b, 'articulos/a.png'));
    const { estado } = ejecutar(enModo(base, 1), duplicarRango());

    expect(estado.doc.childCount).toBe(3);
    expect(estado.doc.child(2).type.name).toBe('imagenBloque');
    expect(estado.doc.child(2).attrs.bloqueId).toBe('');
    expect((estado.doc.child(2).attrs.bloque as { imagen: unknown }).imagen).toEqual(
      (base.doc.child(1).attrs.bloque as { imagen: unknown }).imagen,
    );
  });

  it('H3-E10: con varios seleccionados, duplica el conjunto debajo (A B → A B A′ B′) en un solo paso', () => {
    const { estado, transacciones } = ejecutar(enModo(cincoParrafos(), 1, 2), duplicarRango());

    expect(transacciones).toBe(1);
    expect(textos(estado)).toEqual(['Uno', 'Dos', 'Tres', 'Dos', 'Tres', 'Cuatro', 'Cinco']);
    expect(idsDe(estado)).toEqual([ID.a, ID.b, ID.c, '', '', ID.d, ID.e]);
  });

  it('H3-E10: un solo Deshacer quita todas las copias', () => {
    const base = cincoParrafos();
    const { estado } = ejecutar(enModo(base, 1, 2), duplicarRango());
    let revertido: EditorState = estado;
    undo(estado, (tr) => (revertido = estado.apply(tr)));

    expect(idsDe(revertido)).toEqual(idsDe(base));
  });

  it('H3-E5: fuera del modo elementos no duplica', () => {
    const { respuesta, transacciones } = ejecutar(cincoParrafos(), duplicarRango());

    expect(respuesta).toBe(false);
    expect(transacciones).toBe(0);
  });

  it('H3-E5: una copia no repite el identificador del original (el documento no queda con ids duplicados)', () => {
    const { estado } = ejecutar(enModo(cincoParrafos(), 0, 4), duplicarRango());
    const conId = idsDe(estado).filter(Boolean);

    expect(new Set(conId).size).toBe(conId.length);
  });
});

describe('quitarRango: Supr y Retroceso (H3 esc. 7 y 10)', () => {
  it('H3-E7: quita el elemento, sale del modo elementos y deja el resto en orden, en una transacción', () => {
    const { estado, respuesta, transacciones } = ejecutar(enModo(cincoParrafos(), 2), quitarRango());

    expect(respuesta).toBe(true);
    expect(transacciones).toBe(1);
    expect(idsDe(estado)).toEqual([ID.a, ID.b, ID.d, ID.e]);
    expect(rangoDeElementos(estado)).toBeNull();
  });

  it('H3-E7: el foco pasa al elemento contiguo (el siguiente; si era el último, el anterior)', () => {
    const base = cincoParrafos();
    const delMedio = ejecutar(enModo(base, 2), quitarRango()).estado;
    const delFinal = ejecutar(enModo(base, 4), quitarRango()).estado;

    // Tras quitar "Tres" el cursor queda dentro de "Dos" o de "Cuatro" (los contiguos).
    expect(['Dos', 'Cuatro']).toContain(delMedio.selection.$from.parent.textContent);
    expect(delFinal.selection.$from.parent.textContent).toBe('Cuatro');
  });

  it('H3-E10: con varios seleccionados, quita el conjunto entero en un solo paso', () => {
    const { estado, transacciones } = ejecutar(enModo(cincoParrafos(), 1, 3), quitarRango());

    expect(transacciones).toBe(1);
    expect(idsDe(estado)).toEqual([ID.a, ID.e]);
  });

  it('H3-E10: un solo Deshacer devuelve todos los elementos quitados', () => {
    const base = cincoParrafos();
    const { estado } = ejecutar(enModo(base, 1, 3), quitarRango());
    let revertido: EditorState = estado;
    undo(estado, (tr) => (revertido = estado.apply(tr)));

    expect(idsDe(revertido)).toEqual(idsDe(base));
    expect(textos(revertido)).toEqual(textos(base));
  });

  it('H3-E7: quitar todos los elementos deja un párrafo vacío (el documento nunca queda sin elementos)', () => {
    const { estado } = ejecutar(enModo(cincoParrafos(), 0, 4), quitarRango());

    expect(estado.doc.childCount).toBe(1);
    expect(estado.doc.child(0).type.name).toBe('paragraph');
    expect(estado.doc.child(0).content.size).toBe(0);
  });

  it('H3-E7: quita un elemento especial', () => {
    const base = estadoDe(parrafo(ID.a, 'Uno'), imagen(ID.b, 'articulos/a.png'), parrafo(ID.c, 'Tres'));
    const { estado } = ejecutar(enModo(base, 1), quitarRango());

    expect(idsDe(estado)).toEqual([ID.a, ID.c]);
  });

  it('H3-E7: fuera del modo elementos, un rango de texto que cruza párrafos no habilita quitar', () => {
    const base = cincoParrafos();
    const estado = base.apply(
      base.tr.setSelection(TextSelection.create(base.doc, posDe(base, 1) + 2, posDe(base, 3) + 2)),
    );
    const { respuesta, transacciones } = ejecutar(estado, quitarRango());

    expect(respuesta).toBe(false);
    expect(transacciones).toBe(0);
    expect(idsDe(estado)).toEqual([ID.a, ID.b, ID.c, ID.d, ID.e]);
  });
});

describe('convertirElemento: «Convertir en…» entre tipos de texto (H3 esc. 6; research D20)', () => {
  it('H3-E6: párrafo a título conserva el texto y el identificador, y fija el nivel', () => {
    const { estado, respuesta, transacciones } = ejecutar(
      enModo(estadoDe(parrafo(ID.a, 'Un texto'), parrafo(ID.b, 'Otro')), 0),
      convertirElemento('titulo', { nivel: 3 }),
    );

    expect(respuesta).toBe(true);
    expect(transacciones).toBe(1);
    expect(estado.doc.child(0).type.name).toBe('heading');
    expect(estado.doc.child(0).attrs).toMatchObject({ bloqueId: ID.a, level: 3 });
    expect(estado.doc.child(0).textContent).toBe('Un texto');
    expect(estado.doc.child(1).textContent).toBe('Otro');
  });

  it('H3-E6: párrafo a cita conserva el texto', () => {
    const { estado } = ejecutar(enModo(estadoDe(parrafo(ID.a, 'Una frase')), 0), convertirElemento('cita'));

    expect(estado.doc.child(0).type.name).toBe('blockquote');
    expect(estado.doc.child(0).textContent).toBe('Una frase');
    expect(estado.doc.child(0).attrs.bloqueId).toBe(ID.a);
  });

  it('H3-E6: párrafo a lista pone el texto como único ítem', () => {
    const { estado } = ejecutar(enModo(estadoDe(parrafo(ID.a, 'Primer ítem')), 0), convertirElemento('lista'));

    expect(estado.doc.child(0).type.name).toBe('bulletList');
    expect(estado.doc.child(0).childCount).toBe(1);
    expect(estado.doc.child(0).textContent).toBe('Primer ítem');
  });

  it('H3-E6: título a párrafo, cita a título y lista de un ítem a párrafo conservan el texto', () => {
    const deTitulo = ejecutar(enModo(estadoDe(titulo(ID.a, 'Un título')), 0), convertirElemento('parrafo'));
    const deCita = ejecutar(enModo(estadoDe(cita(ID.a, 'Una cita')), 0), convertirElemento('titulo', { nivel: 2 }));
    const deLista = ejecutar(enModo(estadoDe(lista(ID.a, ['Solo uno'])), 0), convertirElemento('parrafo'));

    expect(deTitulo.estado.doc.child(0)).toMatchObject({ type: { name: 'paragraph' } });
    expect(deTitulo.estado.doc.child(0).textContent).toBe('Un título');
    expect(deCita.estado.doc.child(0).type.name).toBe('heading');
    expect(deCita.estado.doc.child(0).textContent).toBe('Una cita');
    expect(deLista.estado.doc.child(0).type.name).toBe('paragraph');
    expect(deLista.estado.doc.child(0).textContent).toBe('Solo uno');
  });

  it('H3-E6: el elemento convertido queda seleccionado en modo elementos y en su misma posición', () => {
    const base = estadoDe(parrafo(ID.a, 'Uno'), parrafo(ID.b, 'Dos'), parrafo(ID.c, 'Tres'));
    const { estado } = ejecutar(enModo(base, 1), convertirElemento('titulo', { nivel: 2 }));

    expect(idsDe(estado)).toEqual([ID.a, ID.b, ID.c]);
    expect(rangoDeElementos(estado)?.desde).toBe(posDe(base, 1));
  });

  it('H3-E6: un solo Deshacer revierte la conversión', () => {
    const base = estadoDe(parrafo(ID.a, 'Un texto'));
    const { estado } = ejecutar(enModo(base, 0), convertirElemento('titulo', { nivel: 4 }));
    let revertido: EditorState = estado;
    undo(estado, (tr) => (revertido = estado.apply(tr)));

    expect(revertido.doc.child(0).type.name).toBe('paragraph');
    expect(revertido.doc.child(0).textContent).toBe('Un texto');
  });

  it('H3-E10: no se ofrece con varios elementos seleccionados', () => {
    const estado = enModo(cincoParrafos(), 1, 2);
    const { respuesta, transacciones } = ejecutar(estado, convertirElemento('titulo', { nivel: 2 }));

    expect(respuesta).toBe(false);
    expect(transacciones).toBe(0);
    expect(convertirElemento('cita')(estado)).toBe(false);
  });

  it('H3-E6: no se ofrece sobre un elemento especial, un separador ni fuera del modo elementos', () => {
    const especial = enModo(estadoDe(imagen(ID.a, 'articulos/a.png'), parrafo(ID.b, 'Dos')), 0);
    const sep = enModo(estadoDe(separador(ID.a), parrafo(ID.b, 'Dos')), 0);

    expect(convertirElemento('parrafo')(especial)).toBe(false);
    expect(convertirElemento('parrafo')(sep)).toBe(false);
    expect(convertirElemento('titulo', { nivel: 2 })(estadoDe(parrafo(ID.a, 'Uno')))).toBe(false);
  });

  it('H3-E6: convertir a un código conserva el texto', () => {
    const { estado } = ejecutar(enModo(estadoDe(parrafo(ID.a, 'const x = 1;')), 0), convertirElemento('codigo'));

    expect(estado.doc.child(0).type.name).toBe('codeBlock');
    expect(estado.doc.child(0).textContent).toBe('const x = 1;');
  });
});

describe('pierdeAlConvertir: aviso antes de convertir con pérdida (H3 esc. 6, RF-016, research D20)', () => {
  const pierde = (estado: EditorState, ...args: Parameters<typeof convertirElemento>) =>
    pierdeAlConvertir(enModo(estado, 0), ...args).pierde;

  it('H3-E6: texto a texto sin datos propios no pierde nada', () => {
    expect(pierde(estadoDe(parrafo(ID.a, 'Uno')), 'titulo', { nivel: 2 })).toEqual([]);
    expect(pierde(estadoDe(titulo(ID.a, 'Uno')), 'parrafo')).toEqual([]);
    expect(pierde(estadoDe(parrafo(ID.a, 'Uno')), 'cita')).toEqual([]);
    expect(pierde(estadoDe(parrafo(ID.a, 'Uno')), 'lista')).toEqual([]);
    expect(pierde(estadoDe(lista(ID.a, ['Solo uno'])), 'parrafo')).toEqual([]);
  });

  it('H3-E6: una lista de varios ítems a párrafo avisa de los ítems', () => {
    const { pierde: perdidas } = pierdeAlConvertir(enModo(estadoDe(lista(ID.a, ['x', 'y', 'z'])), 0), 'parrafo');

    expect(perdidas.length).toBeGreaterThan(0);
    expect(perdidas.join(' ')).toMatch(/ítems|items|elementos de la lista/i);
  });

  it('H3-E6: una cita con autor o con fuente a párrafo avisa del dato que se pierde', () => {
    const conAutor = pierde(estadoDe(cita(ID.a, 'Una cita', 'Alguien')), 'parrafo');
    const conFuente = pierde(estadoDe(cita(ID.a, 'Una cita', '', 'https://example.com')), 'parrafo');
    const sinDatos = pierde(estadoDe(cita(ID.a, 'Una cita')), 'parrafo');

    expect(conAutor.join(' ')).toMatch(/autor/i);
    expect(conFuente.join(' ')).toMatch(/fuente/i);
    expect(sinDatos).toEqual([]);
  });

  it('H3-E6: un párrafo con marcas a título o a código avisa de que las pierde', () => {
    const base = estadoDe(parrafoConNegrita(ID.a, 'Con negrita'));

    expect(pierde(base, 'titulo', { nivel: 2 }).join(' ')).toMatch(/marcas|formato/i);
    expect(pierde(base, 'codigo').join(' ')).toMatch(/marcas|formato/i);
  });

  it('H3-E6: un párrafo con marcas a cita, a lista o a párrafo no pierde nada', () => {
    const base = estadoDe(parrafoConNegrita(ID.a, 'Con negrita'));

    expect(pierde(base, 'cita')).toEqual([]);
    expect(pierde(base, 'lista')).toEqual([]);
  });

  it('H3-E6: consultar lo que se pierde no modifica el documento ni despacha nada', () => {
    const estado = enModo(estadoDe(lista(ID.a, ['x', 'y'])), 0);
    const antes = estado.doc.toJSON();

    pierdeAlConvertir(estado, 'parrafo');

    expect(estado.doc.toJSON()).toEqual(antes);
  });
});
