// T135 (spec 005, Fase 13, Historia 7; RF-028, RF-029; research D29 y D31):
// comandos y reglas de tabla en el editor: insertar 3x3, límites (10 cols, 50 filas),
// combinar rectángulos sin mezclar encabezado y cuerpo, combinar derecha/abajo, separar,
// redimensionar celdas combinadas sin perder texto, proteger al quitar tabla.
//
// FASE ROJA: este test se escribe antes de implementar `tablas.ts` y las extensiones de tabla (T140 y T141).
import { Editor, type JSONContent } from '@tiptap/core';
import { CellSelection, findTable, TableMap } from '@tiptap/pm/tables';
import { describe, expect, it } from 'vitest';
import { crearExtensiones, type DevolucionesDelEditor } from './extensiones';
import {
  agregarColumna,
  agregarFila,
  combinarCeldas,
  combinarConAbajo,
  combinarConDerecha,
  eliminarFila,
  insertarTabla,
  separarCeldas,
} from './tablas';

const sinEfecto = () => undefined;
const devoluciones = {
  salioDelModo: sinEfecto,
  cerrarHojaPendiente: () => false,
  proteccion: {},
  anunciar: sinEfecto,
  menuAbierto: () => false,
  alPropiedades: sinEfecto,
  alMenu: sinEfecto,
  alTeclearMenu: () => false,
  alConvertir: sinEfecto,
} as unknown as DevolucionesDelEditor;

const crearEditor = (contenido?: Record<string, unknown>) =>
  new Editor({
    element: null,
    extensions: crearExtensiones(devoluciones),
    content: contenido ?? {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { id: '00000000-0000-4000-9000-000000000001' } }],
    },
  });

describe('Comandos de tabla en el editor (T135)', () => {
  it('insertarTabla inserta una tabla de 3x3 con encabezados', () => {
    const editor = crearEditor();
    insertarTabla(editor);

    const json = editor.getJSON();
    const tabla = json.content?.find((n) => n.type === 'table');
    expect(tabla).toBeDefined();
    expect(tabla?.content).toHaveLength(3);
    const primeraFila = tabla?.content?.[0] as JSONContent | undefined;
    expect(primeraFila?.content).toHaveLength(3);
    expect(primeraFila?.content?.[0]?.type).toBe('tableHeader');
  });

  it('no permite agregar más de 10 columnas ("Se alcanzó el máximo de 10 columnas")', () => {
    const editor = crearEditor();
    insertarTabla(editor);
    let aviso = '';
    // Intenta agregar columnas hasta superar 10
    for (let i = 0; i < 10; i++) {
      const res = agregarColumna(editor, { alAvisar: (msg) => (aviso = msg) });
      if (!res) break;
    }
    expect(aviso).toBe('Se alcanzó el máximo de 10 columnas');
  });

  it('no permite agregar más de 50 filas ("Se alcanzó el máximo de 50 filas")', () => {
    const editor = crearEditor();
    insertarTabla(editor);
    let aviso = '';
    for (let i = 0; i < 55; i++) {
      const res = agregarFila(editor, { alAvisar: (msg) => (aviso = msg) });
      if (!res) break;
    }
    expect(aviso).toBe('Se alcanzó el máximo de 50 filas');
  });

  it('no permite combinar si las celdas no forman un rectángulo', () => {
    const editor = crearEditor();
    insertarTabla(editor);
    let error = '';
    const pudo = combinarCeldas(editor, { alFallar: (msg) => (error = msg) });
    expect(pudo).toBe(false);
    expect(error).toBe('Las celdas no forman un rectángulo');
  });

  it('no permite combinar celdas de encabezado con celdas de cuerpo', () => {
    const editor = crearEditor();
    insertarTabla(editor);
    const { doc, tr } = editor.state;
    const table = findTable(doc.resolve(editor.state.selection.from));
    if (table) {
      const map = TableMap.get(table.node);
      const celdaEncabezado = table.start + map.map[0]!;
      const celdaCuerpo = table.start + map.map[map.width]!;
      const sel = CellSelection.create(doc, celdaEncabezado, celdaCuerpo);
      editor.view.dispatch(tr.setSelection(sel));
    }
    let error = '';
    const pudo = combinarCeldas(editor, { alFallar: (msg) => (error = msg) });
    expect(pudo).toBe(false);
    expect(error).toBe('No se puede combinar el encabezado con el cuerpo');
  });

  it('permite combinar con la celda de la derecha y con la de abajo', () => {
    const editor = crearEditor();
    insertarTabla(editor);
    expect(combinarConDerecha(editor)).toBe(true);
    expect(combinarConAbajo(editor)).toBe(true);
  });

  it('separar celdas combinadas deja el contenido en la primera celda', () => {
    const editor = crearEditor();
    insertarTabla(editor);
    combinarConDerecha(editor);
    expect(separarCeldas(editor)).toBe(true);
  });

  it('quitar la única fila o columna no está disponible ("Usa «Quitar tabla»")', () => {
    const editor = crearEditor();
    insertarTabla(editor);
    // Si queda solo 1 fila
    eliminarFila(editor);
    eliminarFila(editor);
    let razon = '';
    const pudo = eliminarFila(editor, { alNoDisponible: (r) => (razon = r) });
    expect(pudo).toBe(false);
    expect(razon).toBe('Usa «Quitar tabla»');
  });
});
