// Lista única de elementos que se pueden insertar (contracts/componentes.md): la usan el menú «/», el botón
// «Insertar» de la barra y el botón de cada línea vacía. Los nombres salen de `nombreDeTipo`.
import { crearElemento } from '@blog/bloques';
import type { Editor, JSONContent } from '@tiptap/core';
import type { Node as NodoPm } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import { nombreDeTipo, type TipoVisible } from '../anuncios';

export type ItemDeInsercion = {
  id: string;
  nombre: string;
  descripcion: string;
  grupo: 'texto' | 'especial';
  insertar: (editor: Editor) => void;
};

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
const nombreDe = (tipo: TipoVisible, sufijo = '') => `${conMayuscula(nombreDeTipo(tipo))}${sufijo}`;

const MAXIMO_DE_ELEMENTOS = 200;

/**
 * El elemento de primer nivel después del cual se inserta: el que tiene el cursor o, si hay elementos enteros
 * seleccionados (una isla, el modo elementos), el último de ellos.
 */
export function elementoDeLaSeleccion({ selection, doc }: EditorState): { actual: NodoPm; inicio: number } {
  const { $from, $to } = selection;
  if ($from.depth > 0) return { actual: $from.node(1), inicio: $from.before(1) };
  const actual = $to.nodeBefore ?? doc.firstChild!;
  return { actual, inicio: $to.nodeBefore ? $to.pos - actual.nodeSize : 0 };
}

/**
 * Inserta un nodo: reemplaza la línea si está vacía o lo pone después del elemento actual, y deja el foco donde
 * corresponde (contracts/atajos.md): dentro del elemento de texto, en el párrafo siguiente al separador o, con un
 * elemento especial, seleccionado y con el panel abierto.
 */
function insertarElemento(editor: Editor, nodo: JSONContent) {
  const { actual, inicio } = elementoDeLaSeleccion(editor.state);
  const vacia = actual.type.name === 'paragraph' && actual.content.size === 0;
  if (!vacia && editor.state.doc.childCount >= MAXIMO_DE_ELEMENTOS) {
    editor.storage.atributosDelDocumento.anunciar(`Se alcanzó el máximo de ${MAXIMO_DE_ELEMENTOS} elementos`);
    return;
  }
  const desde = vacia ? inicio : inicio + actual.nodeSize;
  const especial = ['imagen', 'galeria', 'cta', 'video'].includes(nodo.type ?? '');
  if (especial) editor.storage.atributosDelDocumento.abrirPanel = 'foco';
  else if (nodo.type === 'codeBlock') editor.storage.atributosDelDocumento.abrirPanel = 'pestana';
  // Un elemento especial no lleva el foco al lienzo: el foco es del primer campo de su panel.
  const cadena = especial ? editor.chain() : editor.chain().focus();
  cadena.insertContentAt({ from: desde, to: vacia ? inicio + actual.nodeSize : desde }, nodo).run();
  if (especial) editor.commands.setNodeSelection(desde);
  else if (nodo.type === 'horizontalRule')
    editor.commands.setTextSelection(Math.min(desde + 1, editor.state.doc.content.size - 1));
  else editor.commands.setTextSelection(desde + 1);
}

const lista = (type: 'bulletList' | 'orderedList'): JSONContent => ({
  type,
  content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
});

const especial = (tipo: 'imagen' | 'galeria' | 'cta' | 'video') => (editor: Editor) => {
  insertarElemento(editor, crearElemento(tipo) as JSONContent);
};

const texto = (id: string, nombre: string, descripcion: string, nodo: JSONContent): ItemDeInsercion => ({
  id,
  nombre,
  descripcion,
  grupo: 'texto',
  insertar: (editor) => insertarElemento(editor, nodo),
});

export const ITEMS: ItemDeInsercion[] = [
  texto('parrafo', nombreDe('parrafo'), 'Texto normal del artículo', { type: 'paragraph' }),
  texto('titulo-2', nombreDe('titulo', ' 2'), 'Título de sección grande', { type: 'heading', attrs: { level: 2 } }),
  texto('titulo-3', nombreDe('titulo', ' 3'), 'Subtítulo dentro de una sección', {
    type: 'heading',
    attrs: { level: 3 },
  }),
  texto('titulo-4', nombreDe('titulo', ' 4'), 'Título menor', { type: 'heading', attrs: { level: 4 } }),
  texto('cita', nombreDe('cita'), 'Una frase destacada con su autor', {
    type: 'blockquote',
    content: [{ type: 'paragraph' }],
  }),
  texto('lista-vinietas', nombreDe('lista', ' con viñetas'), 'Enumeración sin orden', lista('bulletList')),
  texto('lista-numerada', nombreDe('lista', ' numerada'), 'Pasos o elementos con orden', lista('orderedList')),
  {
    id: 'imagen',
    nombre: nombreDe('imagen'),
    descripcion: 'Una foto con su texto alternativo',
    grupo: 'especial',
    insertar: especial('imagen'),
  },
  {
    id: 'galeria',
    nombre: nombreDe('galeria'),
    descripcion: 'Varias imágenes en columnas',
    grupo: 'especial',
    insertar: especial('galeria'),
  },
  {
    id: 'cta',
    nombre: nombreDe('cta'),
    descripcion: 'Un título y un botón que lleva a otra página',
    grupo: 'especial',
    insertar: especial('cta'),
  },
  {
    id: 'video',
    nombre: nombreDe('video'),
    descripcion: 'Un video de YouTube o Vimeo',
    grupo: 'especial',
    insertar: especial('video'),
  },
  texto('codigo', nombreDe('codigo'), 'Un fragmento de código sin formato', { type: 'codeBlock' }),
  texto('separador', nombreDe('separador'), 'Una línea que divide el artículo', { type: 'horizontalRule' }),
];

const sinTildes = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Sin tildes ni mayúsculas, por nombre y descripción; los que coinciden por nombre van primero. */
export function filtrarItems(consulta: string): ItemDeInsercion[] {
  const buscada = sinTildes(consulta.replace(/^\//, '').trim());
  if (!buscada) return [...ITEMS];
  const porNombre = ITEMS.filter((item) => sinTildes(item.nombre).includes(buscada));
  const porDescripcion = ITEMS.filter(
    (item) => !porNombre.includes(item) && sinTildes(item.descripcion).includes(buscada),
  );
  return [...porNombre, ...porDescripcion];
}
