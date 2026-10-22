// Una sola ruta para quitar y mover elementos (contracts/atajos.md): toda transacción que quite o mueva elementos
// de primer nivel (menú, atajo, `Supr`, cortar, escribir sobre la selección, arrastrar, `Mod+A` y borrar) pasa por
// `decidirBorrado`. Compara los elementos (por `bloqueId`) antes y después de aplicar la transacción.
import type { Node as NodoPm } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { anuncioMovido, anuncioQuitado, anuncioSubidaEnCurso } from '../anuncios';
import { claveConfirmado } from './claves';

export type Decision =
  | { accion: 'permitir'; anuncio?: string }
  | { accion: 'bloquear'; anuncio: string }
  | { accion: 'confirmar'; cantidad: number };

type Contexto = {
  transaccion: Transaction;
  /** `bloqueId` de los elementos con una subida en curso. */
  subidasEnCurso: ReadonlySet<string>;
  /** La misma función de `ContextoEditor`: la imagen ya está guardada en el artículo. */
  imagenGuardada: (ruta: string) => boolean;
  /** La persona ya aceptó el diálogo y la transacción se reintenta. */
  confirmado?: boolean;
};

/** Los elementos con identidad, en orden (un tramo con `continuacion` repite el id del anterior y no cuenta). */
function elementosConId(doc: NodoPm): { id: string; nodo: NodoPm; posicion: number }[] {
  const vistos = new Set<string>();
  const elementos: { id: string; nodo: NodoPm; posicion: number }[] = [];
  doc.forEach((nodo, _pos, indice) => {
    const id = String(nodo.attrs.bloqueId ?? '');
    if (id && !vistos.has(id)) {
      vistos.add(id);
      elementos.push({ id, nodo, posicion: indice + 1 });
    }
  });
  return elementos;
}

/** Los ids que no están en la subsecuencia común más larga: los elementos que se movieron de lugar. */
function idsMovidos(antes: string[], despues: string[]): Set<string> {
  const n = antes.length;
  const m = despues.length;
  const tabla = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      tabla[i]![j] =
        antes[i] === despues[j] ? tabla[i + 1]![j + 1]! + 1 : Math.max(tabla[i + 1]![j]!, tabla[i]![j + 1]!);
    }
  }
  const iguales = new Set<string>();
  for (let i = 0, j = 0; i < n && j < m;) {
    if (antes[i] === despues[j]) {
      iguales.add(antes[i]!);
      i++;
      j++;
    } else if (tabla[i + 1]![j]! >= tabla[i]![j + 1]!) i++;
    else j++;
  }
  return new Set(antes.filter((id) => !iguales.has(id)));
}

const rutasDe = (nodo: NodoPm): string[] => {
  const bloque = nodo.attrs.bloque as { imagen?: { ruta?: string }; imagenes?: { ruta?: string }[] } | null;
  return [bloque?.imagen?.ruta, ...(bloque?.imagenes?.map((imagen) => imagen.ruta) ?? [])].filter(
    (ruta): ruta is string => Boolean(ruta),
  );
};

export function decidirBorrado(estado: EditorState, contexto: Contexto): Decision {
  const antes = elementosConId(estado.doc);
  const despues = elementosConId(contexto.transaccion.doc);
  const idsDespues = new Set(despues.map((e) => e.id));
  const idsAntes = new Set(antes.map((e) => e.id));
  const quitados = antes.filter((e) => !idsDespues.has(e.id));
  // Si la transacción deja elementos seleccionados enteros, esos son los que se movieron (un intercambio de vecinos
  // es ambiguo para la comparación de secuencias).
  const seleccionados = new Set<string>();
  const { selection } = contexto.transaccion;
  if (selection.$from.depth === 0 && selection.from !== selection.to) {
    contexto.transaccion.doc.nodesBetween(selection.from, selection.to, (nodo, _pos, padre) => {
      if (padre === contexto.transaccion.doc) seleccionados.add(String(nodo.attrs.bloqueId ?? ''));
      return false;
    });
  }
  const porSecuencia = idsMovidos(
    antes.filter((e) => idsDespues.has(e.id)).map((e) => e.id),
    despues.filter((e) => idsAntes.has(e.id)).map((e) => e.id),
  );
  const movidos =
    porSecuencia.size > 0 && seleccionados.size > 0 && quitados.length === 0
      ? new Set([...seleccionados].filter((id) => idsAntes.has(id) && idsDespues.has(id)))
      : porSecuencia;
  if (quitados.length === 0 && movidos.size === 0) return { accion: 'permitir' };

  const tocados = [...quitados.map((e) => e.id), ...movidos];
  if (tocados.some((id) => contexto.subidasEnCurso.has(id))) {
    return { accion: 'bloquear', anuncio: anuncioSubidaEnCurso() };
  }
  if (quitados.length > 0) {
    const conImagenGuardada = quitados.some((e) => rutasDe(e.nodo).some(contexto.imagenGuardada));
    if (conImagenGuardada && !contexto.confirmado) return { accion: 'confirmar', cantidad: quitados.length };
    return { accion: 'permitir', anuncio: anuncioQuitado(quitados.length) };
  }
  const primero = despues.find((e) => movidos.has(e.id));
  return {
    accion: 'permitir',
    anuncio: anuncioMovido(primero?.posicion ?? 1, contexto.transaccion.doc.childCount),
  };
}

export type DevolucionesDeProteccion = {
  subidasEnCurso: () => ReadonlySet<string>;
  imagenGuardada: (ruta: string) => boolean;
  anunciar: (mensaje: string) => void;
  /** Pide confirmar quitar `cantidad` elementos con una imagen guardada; `reintentar` aplica la transacción. */
  pedirConfirmacion: (cantidad: number, reintentar: () => void) => void;
};

/** Plugin: aplica `decidirBorrado` a toda transacción que cambia el documento (salvo deshacer y rehacer). */
export function proteger(devoluciones: DevolucionesDeProteccion) {
  let vistaActual: EditorView | null = null;
  return new Plugin({
    key: new PluginKey('proteger'),
    view: (vista) => {
      // `filterTransaction` no tiene la vista: se guarda para reintentar la transacción confirmada.
      vistaActual = vista;
      return {};
    },
    filterTransaction: (tr, estado) => {
      if (!tr.docChanged || tr.getMeta('history$') || tr.getMeta('addToHistory') === false) return true;
      const decision = decidirBorrado(estado, {
        transaccion: tr,
        subidasEnCurso: devoluciones.subidasEnCurso(),
        imagenGuardada: devoluciones.imagenGuardada,
        confirmado: Boolean(tr.getMeta(claveConfirmado)),
      });
      if (decision.accion === 'bloquear') {
        devoluciones.anunciar(decision.anuncio);
        return false;
      }
      if (decision.accion === 'confirmar') {
        devoluciones.pedirConfirmacion(decision.cantidad, () => {
          const vista = vistaActual;
          if (!vista || !vista.state.doc.eq(tr.before)) return;
          vista.dispatch(tr.setMeta(claveConfirmado, true));
        });
        return false;
      }
      if (decision.anuncio && quitaElementosEnteros(estado, tr)) devoluciones.anunciar(decision.anuncio);
      return true;
    },
  });
}

/**
 * Unir dos párrafos con Retroceso quita un id, pero la persona no «quitó un elemento»: solo se anuncia cuando había
 * elementos seleccionados enteros o se quitó algo que no es un párrafo.
 */
function quitaElementosEnteros(estado: EditorState, tr: Transaction): boolean {
  const { selection } = estado;
  if (selection.$from.depth === 0) return true;
  const idsDespues = new Set(elementosConId(tr.doc).map((e) => e.id));
  return elementosConId(estado.doc).some((e) => !idsDespues.has(e.id) && e.nodo.type.name !== 'paragraph');
}
