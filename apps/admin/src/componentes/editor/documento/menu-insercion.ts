// Lista única de elementos que se pueden insertar (contracts/componentes.md): la usan el menú «/», el botón
// «Insertar» de la barra y el botón de cada línea vacía. Los nombres salen de `nombreDeTipo`.
import { crearBloque, type TipoBloque } from '@blog/bloques';
import type { Editor, JSONContent } from '@tiptap/core';
import { nombreDeTipo } from '../anuncios';

export type ItemDeInsercion = {
  id: string;
  nombre: string;
  descripcion: string;
  grupo: 'texto' | 'especial';
  insertar: (editor: Editor) => void;
};

const conMayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
const nombreDe = (tipo: TipoBloque, sufijo = '') => `${conMayuscula(nombreDeTipo(tipo))}${sufijo}`;

/**
 * Inserta un nodo: reemplaza la línea si está vacía o lo pone después del elemento actual. Deja el cursor dentro
 * del nodo nuevo si tiene texto.
 */
function insertarElemento(editor: Editor, nodo: JSONContent) {
  const { $from } = editor.state.selection;
  const actual = $from.node(1);
  const inicio = $from.before(1);
  const vacia = actual.type.name === 'paragraph' && actual.content.size === 0;
  const desde = vacia ? inicio : inicio + actual.nodeSize;
  editor
    .chain()
    .focus()
    .insertContentAt({ from: desde, to: vacia ? inicio + actual.nodeSize : desde }, nodo)
    .run();
  if (nodo.type !== 'horizontalRule' && !nodo.type?.endsWith('Bloque')) editor.commands.setTextSelection(desde + 1);
}

const lista = (type: 'bulletList' | 'orderedList'): JSONContent => ({
  type,
  content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
});

const especial = (tipo: 'imagen' | 'galeria' | 'cta' | 'video', type: string) => (editor: Editor) => {
  const bloque = crearBloque(tipo);
  insertarElemento(editor, { type, attrs: { bloqueId: bloque.id, bloque } });
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
    insertar: especial('imagen', 'imagenBloque'),
  },
  {
    id: 'galeria',
    nombre: nombreDe('galeria'),
    descripcion: 'Varias imágenes en columnas',
    grupo: 'especial',
    insertar: especial('galeria', 'galeriaBloque'),
  },
  {
    id: 'cta',
    nombre: nombreDe('cta'),
    descripcion: 'Un título y un botón que lleva a otra página',
    grupo: 'especial',
    insertar: especial('cta', 'ctaBloque'),
  },
  {
    id: 'video',
    nombre: nombreDe('video'),
    descripcion: 'Un video de YouTube o Vimeo',
    grupo: 'especial',
    insertar: especial('video', 'videoBloque'),
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
