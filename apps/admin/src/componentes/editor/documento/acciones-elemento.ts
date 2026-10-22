// Acciones sobre el elemento activo (contracts/atajos.md): las que ofrecen el botón «Acciones» de la barra y el asa.
// Todas entran primero al modo elementos con el elemento del cursor y después aplican el comando de rango, así el
// menú, los atajos y el arrastre comparten el mismo camino.
import type { Editor } from '@tiptap/core';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { anuncioConvertido, anuncioDeshacer, anuncioDuplicado, anuncioRehacer } from '../anuncios';
import {
  convertirElemento,
  duplicarRango,
  elementoActivo,
  moverRango,
  pierdeAlConvertir,
  quitarRango,
  rangoDeElementos,
  salirDelModo,
  seleccionarElementoActivo,
  type TipoDeTexto,
} from './comandos';

export type IdDeAccion =
  'subir' | 'bajar' | 'duplicar' | 'convertir' | 'quitar' | 'seleccionar' | 'propiedades' | 'atajos';

export type ItemDeAccion = { id: IdDeAccion; etiqueta: string; atajo?: string; deshabilitado: boolean };

const esMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const teclaModificadora = () => (esMac() ? '⌘' : 'Ctrl');

/** El estado con el elemento activo ya seleccionado en modo elementos (sin despacharlo), o `null` si no hay. */
function estadoEnModo(estado: EditorState): EditorState | null {
  if (rangoDeElementos(estado)) return estado;
  // Un rango de texto que cruza elementos es para dar formato: no habilita mover, duplicar ni quitar.
  const { $from, $to } = estado.selection;
  if ($from.depth > 0 && $from.index(0) !== $to.index(0)) return null;
  let tr: Transaction | null = null;
  if (!seleccionarElementoActivo()(estado, (t) => (tr = t))) return null;
  return tr ? estado.apply(tr) : null;
}

/** Cuántos elementos abarca la acción: los seleccionados en modo elementos o el elemento del cursor. */
function cantidadSeleccionada(estado: EditorState): number {
  const rango = rangoDeElementos(estado);
  if (!rango) return 1;
  let cantidad = 0;
  estado.doc.nodesBetween(rango.desde, rango.hasta, (_nodo, _pos, padre) => {
    if (padre === estado.doc) cantidad++;
    return false;
  });
  return cantidad;
}

/** Algún elemento seleccionado (o el activo) tiene una subida en curso. */
function conSubidaEnCurso(editor: Editor, subidas: ReadonlySet<string>): boolean {
  if (subidas.size === 0) return false;
  const rango = rangoDeElementos(editor.state);
  const { doc } = editor.state;
  const activo = elementoActivo(editor.state);
  const desde = rango?.desde ?? activo?.pos ?? 0;
  const hasta = rango?.hasta ?? (activo ? activo.pos + activo.nodo.nodeSize : 0);
  let con = false;
  doc.nodesBetween(desde, hasta, (nodo, _pos, padre) => {
    if (padre === doc && subidas.has(String(nodo.attrs.bloqueId ?? ''))) con = true;
    return false;
  });
  return con;
}

export function itemsDeAcciones(editor: Editor, contexto: ContextoDeAcciones): ItemDeAccion[] {
  const virtual = estadoEnModo(editor.state);
  const activo = elementoActivo(editor.state);
  const varios = cantidadSeleccionada(editor.state) > 1;
  const sinPropiedades = !activo || varios || activo.tipo === 'parrafo' || activo.tipo === 'separador';
  const mod = teclaModificadora();
  const subiendo = conSubidaEnCurso(editor, contexto.subidasEnCurso());
  const items: ItemDeAccion[] = [
    {
      id: 'subir',
      etiqueta: 'Subir',
      atajo: 'Alt + ↑',
      deshabilitado: subiendo || !virtual || !moverRango(-1)(virtual),
    },
    {
      id: 'bajar',
      etiqueta: 'Bajar',
      atajo: 'Alt + ↓',
      deshabilitado: subiendo || !virtual || !moverRango(1)(virtual),
    },
    { id: 'duplicar', etiqueta: 'Duplicar', atajo: `${mod} + D`, deshabilitado: !virtual },
  ];
  if (!varios) {
    items.push({
      id: 'convertir',
      etiqueta: 'Convertir en…',
      deshabilitado: !virtual || !convertirElemento('parrafo')(virtual),
    });
  }
  items.push(
    { id: 'quitar', etiqueta: 'Quitar', atajo: 'Supr', deshabilitado: subiendo || !virtual },
    { id: 'seleccionar', etiqueta: 'Seleccionar', atajo: 'Esc', deshabilitado: !activo },
    { id: 'propiedades', etiqueta: 'Propiedades', atajo: 'Enter', deshabilitado: sinPropiedades },
    { id: 'atajos', etiqueta: 'Atajos', deshabilitado: false },
  );
  return items;
}

export type EstiloDeConversion = { etiqueta: string; tipo: TipoDeTexto; nivel?: 2 | 3 | 4; nombre: string };

/** Los estilos de «Convertir en…». */
export const ESTILOS_DE_CONVERSION: EstiloDeConversion[] = [
  { etiqueta: 'Párrafo', tipo: 'parrafo', nombre: 'párrafo' },
  { etiqueta: 'Título 2', tipo: 'titulo', nivel: 2, nombre: 'título 2' },
  { etiqueta: 'Título 3', tipo: 'titulo', nivel: 3, nombre: 'título 3' },
  { etiqueta: 'Título 4', tipo: 'titulo', nivel: 4, nombre: 'título 4' },
  { etiqueta: 'Cita', tipo: 'cita', nombre: 'cita' },
  { etiqueta: 'Lista con viñetas', tipo: 'lista', nombre: 'lista con viñetas' },
  { etiqueta: 'Código', tipo: 'codigo', nombre: 'bloque de código' },
];

export type ContextoDeAcciones = {
  anunciar: (mensaje: string) => void;
  /** Elementos con una subida en curso: no se pueden mover ni quitar. */
  subidasEnCurso: () => ReadonlySet<string>;
  alPropiedades: () => void;
  abrirAtajos: () => void;
  /** La conversión pierde datos: la interfaz pide confirmar y luego llama a `aplicar`. */
  pedirConversion: (pierde: string[], aplicar: () => void) => void;
};

const despachar = (editor: Editor) => (tr: Transaction) => editor.view.dispatch(tr);

/** Entra al modo elementos con el elemento activo (como `Esc`). */
export function entrarAlModo(editor: Editor) {
  seleccionarElementoActivo()(editor.state, despachar(editor));
}

export function convertirDesdeMenu(editor: Editor, estilo: EstiloDeConversion, contexto: ContextoDeAcciones) {
  const virtual = estadoEnModo(editor.state);
  if (!virtual) return;
  const aplicar = () => {
    entrarAlModo(editor);
    if (convertirElemento(estilo.tipo, { nivel: estilo.nivel })(editor.state, despachar(editor))) {
      contexto.anunciar(anuncioConvertido(estilo.nombre));
    }
    editor.commands.focus();
  };
  const { pierde } = pierdeAlConvertir(virtual, estilo.tipo, { nivel: estilo.nivel });
  if (pierde.length > 0) contexto.pedirConversion(pierde, aplicar);
  else aplicar();
}

export function ejecutarAccion(editor: Editor, id: IdDeAccion, contexto: ContextoDeAcciones) {
  if (id === 'atajos') return contexto.abrirAtajos();
  if (id === 'propiedades') return contexto.alPropiedades();
  const estabaEnModo = rangoDeElementos(editor.state) !== null;
  entrarAlModo(editor);
  const comandos = { subir: moverRango(-1), bajar: moverRango(1), duplicar: duplicarRango(), quitar: quitarRango() };
  if (id in comandos && comandos[id as keyof typeof comandos](editor.state, despachar(editor))) {
    if (id === 'duplicar') {
      const copia = elementoActivo(editor.state);
      if (copia) contexto.anunciar(anuncioDuplicado(copia.posicion, copia.total));
    }
    registrarAccion(editor, NOMBRES_DE_ACCION[id as keyof typeof comandos]);
    // Desde el menú, el cursor queda dentro del elemento; en el modo elementos (atajos) la selección sigue.
    if (!estabaEnModo && id !== 'quitar') salirDelModo()(editor.state, despachar(editor));
  }
  if (id !== 'seleccionar') editor.commands.focus();
  else editor.view.focus();
}

// Deshacer y rehacer anuncian la acción (RF-008): se recuerda el nombre de las últimas acciones sobre elementos.
const NOMBRES_DE_ACCION = {
  subir: 'mover elemento',
  bajar: 'mover elemento',
  duplicar: 'duplicar elemento',
  quitar: 'quitar elemento',
} as const;
const historial = new WeakMap<Editor, { hechas: string[]; rehechas: string[] }>();
const de = (editor: Editor) => {
  const actual = historial.get(editor) ?? { hechas: [], rehechas: [] };
  historial.set(editor, actual);
  return actual;
};

/** Anota una acción sobre elementos para anunciarla al deshacer o rehacer. */
export function registrarAccion(editor: Editor, nombre: string) {
  const { hechas, rehechas } = de(editor);
  hechas.push(nombre);
  rehechas.length = 0;
}

/** Deshace o rehace y anuncia qué se deshizo o rehízo, si fue una acción sobre elementos. */
export function deshacerORehacer(editor: Editor, rehacer: boolean, anunciar: (mensaje: string) => void) {
  const { hechas, rehechas } = de(editor);
  const aplicado = rehacer ? editor.commands.redo() : editor.commands.undo();
  const nombre = rehacer ? rehechas.pop() : hechas.pop();
  if (!aplicado || !nombre) return aplicado;
  (rehacer ? hechas : rehechas).push(nombre);
  anunciar(rehacer ? anuncioRehacer(nombre) : anuncioDeshacer(nombre));
  return aplicado;
}
