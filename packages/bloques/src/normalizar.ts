import type { Documento } from './esquema';

// Forma canónica del documento (research D24; contracts/documento.md, "Forma canónica"): abrir y guardar sin tocar
// no cambia nada (RF-012). Pura e idempotente.

type Nodo = {
  type?: unknown;
  attrs?: Record<string, unknown>;
  content?: Nodo[];
  text?: unknown;
  marks?: { type?: unknown; attrs?: Record<string, unknown> }[];
};

const ORDEN_DE_MARCAS = [
  'link',
  'bold',
  'italic',
  'underline',
  'strike',
  'highlight',
  'code',
  'superscript',
  'subscript',
];

/** Atributos que, con este valor, son la ausencia del atributo. */
const POR_DEFECTO: Record<string, (valor: unknown) => boolean> = {
  textAlign: (valor) => valor === 'left',
  colspan: (valor) => valor === 1,
  rowspan: (valor) => valor === 1,
  colwidth: () => true,
};

function atributos(attrs: Record<string, unknown> | undefined) {
  if (!attrs) return undefined;
  const limpios = Object.entries(attrs).filter(
    ([clave, valor]) => valor !== null && valor !== undefined && !POR_DEFECTO[clave]?.(valor),
  );
  return limpios.length > 0 ? Object.fromEntries(limpios) : undefined;
}

const posicion = (tipo: unknown) => {
  const indice = ORDEN_DE_MARCAS.indexOf(String(tipo));
  return indice < 0 ? ORDEN_DE_MARCAS.length : indice;
};

function marcas(lista: Nodo['marks']) {
  if (!lista || lista.length === 0) return undefined;
  return lista
    .map((marca) => {
      const attrs = atributos(marca.attrs);
      return attrs ? { type: marca.type, attrs } : { type: marca.type };
    })
    .sort((a, b) => posicion(a.type) - posicion(b.type));
}

/** Quita los textos vacíos y une los contiguos con las mismas marcas. */
function unirTextos(hijos: Nodo[]): Nodo[] {
  const salida: Nodo[] = [];
  for (const hijo of hijos) {
    if (hijo.type === 'text' && hijo.text === '') continue;
    const anterior = salida.at(-1);
    if (
      hijo.type === 'text' &&
      anterior?.type === 'text' &&
      JSON.stringify(anterior.marks ?? []) === JSON.stringify(hijo.marks ?? [])
    ) {
      anterior.text = `${String(anterior.text)}${String(hijo.text)}`;
      continue;
    }
    salida.push(hijo);
  }
  return salida;
}

function normalizarNodo(nodo: Nodo): Nodo {
  const salida: Nodo = { type: nodo.type };
  const attrs = atributos(nodo.attrs);
  if (attrs) salida.attrs = attrs;
  if (nodo.type === 'text') {
    salida.text = nodo.text;
    const lista = marcas(nodo.marks);
    if (lista) salida.marks = lista;
    return salida;
  }
  const hijos = unirTextos((nodo.content ?? []).map(normalizarNodo));
  if (hijos.length > 0) salida.content = hijos;
  return salida;
}

/** Un párrafo de primer nivel sin texto no se guarda (como antes un párrafo vacío no era un bloque). */
const esParrafoVacio = (nodo: Nodo) =>
  nodo.type === 'paragraph' && !(nodo.content ?? []).some((hijo) => hijo.type === 'text');

/** La forma canónica de un documento (por ejemplo, el JSON del editor). No modifica la entrada. */
export function normalizarDocumento(json: unknown): Documento {
  const contenido = ((json as Nodo | null)?.content ?? []).map(normalizarNodo).filter((nodo) => !esParrafoVacio(nodo));
  return { type: 'doc', content: contenido } as unknown as Documento;
}
