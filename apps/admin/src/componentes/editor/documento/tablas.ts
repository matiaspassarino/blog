// Comandos y reglas de tablas en el editor (spec 005, Fase 13, Historia 7; RF-028, RF-029; research D29 y D31).
// Usa `TableMap` y `CellSelection` de `@tiptap/pm/tables`, y las reglas de cuadrícula de `@blog/bloques`.
import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  CellSelection,
  TableMap,
  addColumnBefore,
  addRowBefore,
  findTable,
  mergeCells,
  selectedRect,
  splitCell,
} from '@tiptap/pm/tables';
import { NodeSelection, TextSelection, type Selection } from '@tiptap/pm/state';
import { LIMITES_TABLA, cuadricula, esRectangulo, type TablaEstructural } from '@blog/bloques';

/** Referencia a la última celda o selección guardada al salir con Esc al modo elementos (D31 U1). */
type ReferenciaCelda = {
  posCelda: number;
  seleccion?: Selection;
};

const ultimasReferencias = new WeakMap<Editor, ReferenciaCelda>();

/** Actualiza la última celda seleccionada dentro de una tabla. */
export function registrarReferenciaTabla(editor: Editor) {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection) && findTable(editor.state.doc.resolve(selection.from))) {
    ultimasReferencias.set(editor, {
      posCelda: selection.from,
      seleccion: selection,
    });
  }
}

/** Obtiene la última referencia guardada de la celda de una tabla para un editor. */
export function obtenerReferenciaTabla(editor: Editor): ReferenciaCelda | undefined {
  return ultimasReferencias.get(editor);
}

/** Prepara el contexto asegurando que el cursor o selección actúe sobre la celda correspondiente. */
function prepararContextoDeTabla(editor: Editor): { tableNode: ProseMirrorNode; tablePos: number } | null {
  const { state } = editor;
  if (state.selection instanceof NodeSelection && state.selection.node.type.name === 'table') {
    const ref = ultimasReferencias.get(editor);
    if (ref && ref.posCelda < state.doc.content.size) {
      try {
        const tr = state.tr.setSelection(ref.seleccion ?? TextSelection.create(state.doc, ref.posCelda));
        editor.view.dispatch(tr);
      } catch {
        const res = state.doc.resolve(state.selection.from + 1);
        const tr = state.tr.setSelection(TextSelection.create(state.doc, res.pos));
        editor.view.dispatch(tr);
      }
    } else {
      const res = state.doc.resolve(state.selection.from + 1);
      const tr = state.tr.setSelection(TextSelection.create(state.doc, res.pos));
      editor.view.dispatch(tr);
    }
  }

  const pos = editor.state.selection.from;
  const $pos = editor.state.doc.resolve(pos);
  const table = findTable($pos);
  if (!table) return null;

  registrarReferenciaTabla(editor);
  return { tableNode: table.node, tablePos: table.pos };
}

/** Inserta una tabla de 3x3 con encabezados en la posición actual. */
export function insertarTabla(editor: Editor): boolean {
  const idTabla = crypto.randomUUID();
  const filaEncabezado = {
    type: 'tableRow',
    content: Array.from({ length: 3 }, () => ({
      type: 'tableHeader',
      content: [{ type: 'paragraph' }],
    })),
  };
  const filaCuerpo = () => ({
    type: 'tableRow',
    content: Array.from({ length: 3 }, () => ({
      type: 'tableCell',
      content: [{ type: 'paragraph' }],
    })),
  });

  const pudo = editor.commands.insertContent({
    type: 'table',
    attrs: { id: idTabla },
    content: [filaEncabezado, filaCuerpo(), filaCuerpo()],
  });

  if (pudo) {
    let tablePos = -1;
    let tableNode: ProseMirrorNode | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (tablePos >= 0) return false;
      if (node.type.name === 'table') {
        tablePos = pos;
        tableNode = node;
        return false;
      }
      return true;
    });

    if (tablePos >= 0 && tableNode) {
      const map = TableMap.get(tableNode);
      const celdaPos = tablePos + 1 + map.map[0];
      // Dentro del primer párrafo de la celda
      const res = editor.state.doc.resolve(celdaPos + 2);
      try {
        const tr = editor.state.tr.setSelection(TextSelection.near(res));
        editor.view.dispatch(tr);
      } catch {
        // En caso de que la posición no admita TextSelection
      }
      registrarReferenciaTabla(editor);
    }
  }

  return pudo;
}

/** Agrega una columna a la derecha de la actual (máximo 10 columnas). */
export function agregarColumna(
  editor: Editor,
  opciones?: { alAvisar?: (mensaje: string) => void },
): boolean {
  const ctx = prepararContextoDeTabla(editor);
  if (!ctx) return false;
  const grid = cuadricula(ctx.tableNode.toJSON() as TablaEstructural);
  if (grid.columnas >= LIMITES_TABLA.MAX_COLUMNAS) {
    opciones?.alAvisar?.(`Se alcanzó el máximo de ${LIMITES_TABLA.MAX_COLUMNAS} columnas`);
    return false;
  }
  return editor.commands.addColumnAfter();
}

/** Agrega una columna a la izquierda de la actual (máximo 10 columnas). */
export function agregarColumnaAntes(
  editor: Editor,
  opciones?: { alAvisar?: (mensaje: string) => void },
): boolean {
  const ctx = prepararContextoDeTabla(editor);
  if (!ctx) return false;
  const grid = cuadricula(ctx.tableNode.toJSON() as TablaEstructural);
  if (grid.columnas >= LIMITES_TABLA.MAX_COLUMNAS) {
    opciones?.alAvisar?.(`Se alcanzó el máximo de ${LIMITES_TABLA.MAX_COLUMNAS} columnas`);
    return false;
  }
  return addColumnBefore(editor.state, editor.view.dispatch);
}

/** Agrega una fila debajo de la actual (máximo 50 filas). */
export function agregarFila(
  editor: Editor,
  opciones?: { alAvisar?: (mensaje: string) => void },
): boolean {
  const ctx = prepararContextoDeTabla(editor);
  if (!ctx) return false;
  const grid = cuadricula(ctx.tableNode.toJSON() as TablaEstructural);
  if (grid.filas >= LIMITES_TABLA.MAX_FILAS) {
    opciones?.alAvisar?.(`Se alcanzó el máximo de ${LIMITES_TABLA.MAX_FILAS} filas`);
    return false;
  }
  return editor.commands.addRowAfter();
}

/** Agrega una fila arriba de la actual (máximo 50 filas). */
export function agregarFilaAntes(
  editor: Editor,
  opciones?: { alAvisar?: (mensaje: string) => void },
): boolean {
  const ctx = prepararContextoDeTabla(editor);
  if (!ctx) return false;
  const grid = cuadricula(ctx.tableNode.toJSON() as TablaEstructural);
  if (grid.filas >= LIMITES_TABLA.MAX_FILAS) {
    opciones?.alAvisar?.(`Se alcanzó el máximo de ${LIMITES_TABLA.MAX_FILAS} filas`);
    return false;
  }
  return addRowBefore(editor.state, editor.view.dispatch);
}

/** Conmuta si la primera fila de la tabla es de encabezado o celdas normales. */
export function conmutarEncabezado(editor: Editor): boolean {
  const ctx = prepararContextoDeTabla(editor);
  if (!ctx) return false;
  const { state } = editor;
  const { tr } = state;
  const table = ctx.tableNode;
  if (table.childCount === 0) return false;
  const primeraFila = table.child(0);
  if (primeraFila.childCount === 0) return false;
  const esEncabezado = primeraFila.child(0).type.name === 'tableHeader';
  const nuevoTipo = esEncabezado ? state.schema.nodes.tableCell : state.schema.nodes.tableHeader;

  let pos = ctx.tablePos + 2; // inicio del contenido de la primera fila
  for (let c = 0; c < primeraFila.childCount; c++) {
    const celda = primeraFila.child(c);
    tr.setNodeMarkup(pos, nuevoTipo, celda.attrs);
    pos += celda.nodeSize;
  }
  editor.view.dispatch(tr);
  return true;
}

/** Elimina la columna actual (al menos debe quedar 1 columna). */
export function eliminarColumna(
  editor: Editor,
  opciones?: { alNoDisponible?: (razon: string) => void },
): boolean {
  const ctx = prepararContextoDeTabla(editor);
  if (!ctx) return false;
  const grid = cuadricula(ctx.tableNode.toJSON() as TablaEstructural);
  if (grid.columnas <= LIMITES_TABLA.MIN_COLUMNAS) {
    opciones?.alNoDisponible?.('Usa «Quitar tabla»');
    return false;
  }
  return editor.commands.deleteColumn();
}

/** Elimina la fila actual (al menos debe quedar 1 fila). */
export function eliminarFila(
  editor: Editor,
  opciones?: { alNoDisponible?: (razon: string) => void },
): boolean {
  const ctx = prepararContextoDeTabla(editor);
  if (!ctx) return false;
  const grid = cuadricula(ctx.tableNode.toJSON() as TablaEstructural);
  if (grid.filas <= LIMITES_TABLA.MIN_FILAS) {
    opciones?.alNoDisponible?.('Usa «Quitar tabla»');
    return false;
  }
  return editor.commands.deleteRow();
}

/** Combina las celdas seleccionadas (solo rectángulos y sin mezclar encabezado y cuerpo). */
export function combinarCeldas(
  editor: Editor,
  opciones?: { alFallar?: (mensaje: string) => void },
): boolean {
  const ctx = prepararContextoDeTabla(editor);
  if (!ctx) return false;
  const { selection } = editor.state;

  if (!(selection instanceof CellSelection) || selection.$anchorCell.pos === selection.$headCell.pos) {
    opciones?.alFallar?.('Las celdas no forman un rectángulo');
    return false;
  }

  const rect = selectedRect(editor.state);
  if (rect.top === 0 && rect.bottom > 1) {
    opciones?.alFallar?.('No se puede combinar el encabezado con el cuerpo');
    return false;
  }

  const { map } = rect;
  const celdasSeleccionadas: { fila: number; columna: number }[] = [];
  const vistas = new Set<number>();
  for (let r = rect.top; r < rect.bottom; r++) {
    for (let c = rect.left; c < rect.right; c++) {
      const pos = map.map[r * map.width + c];
      if (!vistas.has(pos)) {
        vistas.add(pos);
        celdasSeleccionadas.push({ fila: r, columna: c });
      }
    }
  }

  if (!esRectangulo(celdasSeleccionadas)) {
    opciones?.alFallar?.('Las celdas no forman un rectángulo');
    return false;
  }

  const pudo = mergeCells(editor.state, editor.view.dispatch);
  if (!pudo) {
    opciones?.alFallar?.('Las celdas no forman un rectángulo');
    return false;
  }
  return true;
}

/** Combina la celda actual con la celda contigua a la derecha. */
export function combinarConDerecha(editor: Editor): boolean {
  const ctx = prepararContextoDeTabla(editor);
  if (!ctx) return false;
  const { state } = editor;
  const rect = selectedRect(state);
  const { map } = rect;
  const colActual = rect.left;
  const filaActual = rect.top;
  if (colActual + 1 >= map.width) return false;

  const c1 = rect.tableStart + map.map[filaActual * map.width + colActual];
  const c2 = rect.tableStart + map.map[filaActual * map.width + (colActual + 1)];
  const sel = CellSelection.create(state.doc, c1, c2);
  editor.view.dispatch(state.tr.setSelection(sel));
  return mergeCells(editor.state, editor.view.dispatch);
}

/** Combina la celda actual con la celda contigua abajo. */
export function combinarConAbajo(editor: Editor): boolean {
  const ctx = prepararContextoDeTabla(editor);
  if (!ctx) return false;
  const { state } = editor;
  const rect = selectedRect(state);
  const { map } = rect;
  let filaActual = rect.top;
  const colActual = rect.left;

  if (filaActual === 0) {
    if (map.height < 3) return false;
    filaActual = 1;
  } else if (filaActual + 1 >= map.height) {
    return false;
  }

  const c1 = rect.tableStart + map.map[filaActual * map.width + colActual];
  const c2 = rect.tableStart + map.map[(filaActual + 1) * map.width + colActual];
  const sel = CellSelection.create(state.doc, c1, c2);
  editor.view.dispatch(state.tr.setSelection(sel));
  return mergeCells(editor.state, editor.view.dispatch);
}

/** Separa celdas combinadas. */
export function separarCeldas(editor: Editor): boolean {
  const ctx = prepararContextoDeTabla(editor);
  if (!ctx) return false;
  return splitCell(editor.state, editor.view.dispatch);
}

/** Quita la tabla completa a través del comando deleteTable(). */
export function quitarTabla(editor: Editor): boolean {
  const ctx = prepararContextoDeTabla(editor);
  if (!ctx) return false;
  return editor.commands.deleteTable();
}
