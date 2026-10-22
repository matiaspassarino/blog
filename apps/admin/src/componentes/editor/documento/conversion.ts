// Correspondencia entre el documento del editor (JSON de ProseMirror) y la lista de bloques guardada
// (contracts/documento.md de la spec 005). Funciones puras: no importan React ni la librería del editor.
import {
  analizarEnLinea,
  partirParrafos,
  serializarEnLinea,
  unirParrafos,
  type Bloque,
  type Contenido,
  type NodoEnLinea,
  type TramoDeParrafo,
} from '@blog/bloques';

type MarcaDocumento = { type: string; attrs?: Record<string, unknown> };
export type NodoDocumento = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: NodoDocumento[];
  marks?: MarcaDocumento[];
  text?: string;
};

/** Nodo especial (atómico) del documento de cada tipo de bloque que no es texto. */
const NODO_DE_TIPO = { imagen: 'imagenBloque', galeria: 'galeriaBloque', cta: 'ctaBloque', video: 'videoBloque' } as const;
const TIPO_DE_NODO: Record<string, keyof typeof NODO_DE_TIPO> = {
  imagenBloque: 'imagen',
  galeriaBloque: 'galeria',
  ctaBloque: 'cta',
  videoBloque: 'video',
};

// ---------------------------------------------------------------------------------------------------------------
// Texto en línea: árbol de marcas ⇄ tramos de texto con marcas

type Marca = { tipo: 'enlace' | 'negrita' | 'cursiva' | 'codigo'; href?: string };
type Tramo = { texto: string; marcas: Marca[] };

/** Orden de anidado de las marcas: el que fija el esquema del editor (enlace por fuera, código por dentro). */
const ORDEN_DE_MARCAS: Marca['tipo'][] = ['enlace', 'negrita', 'cursiva', 'codigo'];
const MARCA_DE_DOCUMENTO: Record<string, Marca['tipo']> = {
  link: 'enlace',
  bold: 'negrita',
  italic: 'cursiva',
  code: 'codigo',
};

function aTramos(nodos: NodoEnLinea[], marcas: Marca[] = []): Tramo[] {
  return nodos.flatMap((nodo): Tramo[] => {
    switch (nodo.tipo) {
      case 'texto':
        return [{ texto: nodo.texto, marcas }];
      case 'codigo':
        return [{ texto: nodo.texto, marcas: [...marcas, { tipo: 'codigo' }] }];
      case 'enlace':
        return aTramos(nodo.hijos, [...marcas, { tipo: 'enlace', href: nodo.href }]);
      default:
        return aTramos(nodo.hijos, [...marcas, { tipo: nodo.tipo }]);
    }
  });
}

const marcaDeDocumento = (marca: Marca): MarcaDocumento => {
  switch (marca.tipo) {
    case 'enlace':
      return { type: 'link', attrs: { href: marca.href } };
    case 'negrita':
      return { type: 'bold' };
    case 'cursiva':
      return { type: 'italic' };
    case 'codigo':
      return { type: 'code' };
  }
};

const nodoDeTexto = (texto: string, marcas: Marca[]): NodoDocumento => ({
  type: 'text',
  text: texto,
  ...(marcas.length > 0 ? { marks: marcas.map(marcaDeDocumento) } : {}),
});

/** Contenido en línea de un texto guardado. Con `saltos`, el `\n` pasa a `hardBreak` conservando las marcas. */
function enLineaADocumento(texto: string, saltos: boolean): NodoDocumento[] {
  const resultado: NodoDocumento[] = [];
  for (const tramo of aTramos(analizarEnLinea(texto))) {
    const lineas = saltos ? tramo.texto.split('\n') : [tramo.texto];
    lineas.forEach((linea, i) => {
      if (i > 0) {
        resultado.push({ type: 'hardBreak', ...(tramo.marcas.length > 0 ? { marks: tramo.marcas.map(marcaDeDocumento) } : {}) });
      }
      if (linea) resultado.push(nodoDeTexto(linea, tramo.marcas));
    });
  }
  return resultado;
}

/** Un párrafo guardado: cada línea es su propio texto en línea (como en el sitio) y el salto simple es `hardBreak`. */
function parrafoADocumento(texto: string): NodoDocumento[] {
  return texto.split('\n').flatMap((linea, i): NodoDocumento[] => [
    ...(i > 0 ? [{ type: 'hardBreak' }] : []),
    ...enLineaADocumento(linea, false),
  ]);
}

function tramosDeDocumento(hijos: NodoDocumento[]): Tramo[] {
  return hijos.flatMap((hijo): Tramo[] => {
    const texto = hijo.type === 'hardBreak' ? '\n' : (hijo.text ?? '');
    if (!texto) return [];
    const tipos = new Set((hijo.marks ?? []).map((marca) => MARCA_DE_DOCUMENTO[marca.type]));
    const marcas = ORDEN_DE_MARCAS.filter((tipo) => tipos.has(tipo)).map((tipo): Marca => {
      const origen = (hijo.marks ?? []).find((marca) => MARCA_DE_DOCUMENTO[marca.type] === tipo);
      return tipo === 'enlace' ? { tipo, href: String(origen?.attrs?.href ?? '') } : { tipo };
    });
    return [{ texto, marcas }];
  });
}

const igualMarca = (a: Marca | undefined, b: Marca | undefined) => a?.tipo === b?.tipo && a?.href === b?.href;

function aArbol(tramos: Tramo[]): NodoEnLinea[] {
  const salida: NodoEnLinea[] = [];
  let i = 0;
  while (i < tramos.length) {
    const marca = tramos[i]?.marcas[0];
    let j = i;
    while (j < tramos.length && igualMarca(tramos[j]?.marcas[0], marca)) j++;
    const grupo = tramos.slice(i, j);
    i = j;
    if (!marca) {
      salida.push({ tipo: 'texto', texto: grupo.map((tramo) => tramo.texto).join('') });
      continue;
    }
    const interior = grupo.map((tramo) => ({ ...tramo, marcas: tramo.marcas.slice(1) }));
    if (marca.tipo === 'codigo') salida.push({ tipo: 'codigo', texto: interior.map((tramo) => tramo.texto).join('') });
    else if (marca.tipo === 'enlace') salida.push({ tipo: 'enlace', href: marca.href ?? '', hijos: aArbol(interior) });
    else salida.push({ tipo: marca.tipo, hijos: aArbol(interior) });
  }
  return salida;
}

const enLineaDeDocumento = (hijos: NodoDocumento[] = []) => serializarEnLinea(aArbol(tramosDeDocumento(hijos)));

/** Párrafo guardado: las líneas se serializan por separado, igual que las lee el sitio. */
function parrafoDeDocumento(hijos: NodoDocumento[] = []): string {
  const lineas: NodoDocumento[][] = [[]];
  for (const hijo of hijos) {
    if (hijo.type === 'hardBreak') lineas.push([]);
    else lineas[lineas.length - 1]?.push(hijo);
  }
  return lineas.map((linea) => enLineaDeDocumento(linea)).join('\n');
}

const textoSinMarcas = (hijos: NodoDocumento[] = []) =>
  hijos.map((hijo) => (hijo.type === 'hardBreak' ? '\n' : (hijo.text ?? ''))).join('');

// ---------------------------------------------------------------------------------------------------------------
// Bloques → documento

const conContenido = (content: NodoDocumento[]) => (content.length > 0 ? { content } : {});
const parrafoEnLinea = (texto: string): NodoDocumento => ({ type: 'paragraph', ...conContenido(enLineaADocumento(texto, true)) });

function bloqueADocumento(bloque: Bloque): NodoDocumento[] {
  const bloqueId = bloque.id;
  switch (bloque.tipo) {
    case 'parrafo':
      return partirParrafos(bloque.texto).map((tramo, i) => ({
        type: 'paragraph',
        attrs: { bloqueId, continuacion: i === 0 ? '' : tramo.separador },
        ...conContenido(parrafoADocumento(tramo.texto)),
      }));
    case 'titulo':
      return [
        {
          type: 'heading',
          attrs: { level: bloque.nivel, bloqueId },
          ...conContenido(bloque.texto ? [{ type: 'text', text: bloque.texto }] : []),
        },
      ];
    case 'cita':
      return [
        {
          type: 'blockquote',
          attrs: { autor: bloque.autor ?? '', fuente: bloque.fuente ?? '', bloqueId },
          content: [parrafoEnLinea(bloque.texto)],
        },
      ];
    case 'lista':
      return [
        {
          type: bloque.ordenada ? 'orderedList' : 'bulletList',
          attrs: { bloqueId },
          content: bloque.items.map((item) => ({ type: 'listItem', content: [parrafoEnLinea(item)] })),
        },
      ];
    case 'codigo':
      return [
        {
          type: 'codeBlock',
          attrs: { lenguaje: bloque.lenguaje ?? '', bloqueId },
          ...conContenido(bloque.codigo ? [{ type: 'text', text: bloque.codigo }] : []),
        },
      ];
    case 'separador':
      return [{ type: 'horizontalRule', attrs: { bloqueId } }];
    default:
      return [{ type: NODO_DE_TIPO[bloque.tipo], attrs: { bloqueId, bloque } }];
  }
}

/** Documento del editor para un contenido guardado. Siempre tiene al menos un párrafo. */
export function bloquesADocumento(contenido: Contenido): NodoDocumento {
  const content = contenido.flatMap(bloqueADocumento);
  return { type: 'doc', content: content.length > 0 ? content : [{ type: 'paragraph', attrs: { bloqueId: '', continuacion: '' } }] };
}

// ---------------------------------------------------------------------------------------------------------------
// Documento → bloques

function idDe(nodo: NodoDocumento): string {
  const id = nodo.attrs?.bloqueId;
  if (typeof id !== 'string' || id === '') {
    throw new Error(`El elemento "${nodo.type ?? '?'}" no tiene bloqueId: asegurarIds tiene que correr antes de convertir.`);
  }
  return id;
}

const textoDe = (valor: unknown) => (typeof valor === 'string' ? valor : '');
const opcional = <T extends string>(campo: T, valor: unknown) => (textoDe(valor) ? { [campo]: textoDe(valor) } : {});
const primerParrafo = (nodo: NodoDocumento) => nodo.content?.find((hijo) => hijo.type === 'paragraph');

type Grupo = { nodo: NodoDocumento; tramos: TramoDeParrafo[]; vacio: boolean };

/** Une cada párrafo con `continuacion` al párrafo anterior; un párrafo vacío sin continuación no genera bloque. */
function agruparParrafos(nodos: NodoDocumento[]): (NodoDocumento | Grupo)[] {
  const salida: (NodoDocumento | Grupo)[] = [];
  for (const nodo of nodos) {
    const anterior = salida[salida.length - 1];
    const separador = textoDe(nodo.attrs?.continuacion);
    const texto = parrafoDeDocumento(nodo.content);
    if (nodo.type === 'paragraph' && separador && anterior && 'tramos' in anterior) {
      anterior.tramos.push({ texto, separador });
      anterior.vacio = false;
    } else if (nodo.type === 'paragraph') {
      salida.push({ nodo, tramos: [{ texto, separador: '' }], vacio: texto === '' });
    } else {
      salida.push(nodo);
    }
  }
  return salida;
}

function bloqueDeDocumento(nodo: NodoDocumento): Bloque {
  const id = idDe(nodo);
  const atributos = nodo.attrs ?? {};
  switch (nodo.type) {
    case 'heading':
      return { id, tipo: 'titulo', nivel: atributos.level, texto: textoSinMarcas(nodo.content) } as Bloque;
    case 'blockquote':
      return {
        id,
        tipo: 'cita',
        texto: enLineaDeDocumento(primerParrafo(nodo)?.content),
        ...opcional('autor', atributos.autor),
        ...opcional('fuente', atributos.fuente),
      } as Bloque;
    case 'bulletList':
    case 'orderedList':
      return {
        id,
        tipo: 'lista',
        ordenada: nodo.type === 'orderedList',
        items: (nodo.content ?? []).map((item) => enLineaDeDocumento(primerParrafo(item)?.content)),
      };
    case 'codeBlock':
      return { id, tipo: 'codigo', codigo: textoSinMarcas(nodo.content), ...opcional('lenguaje', atributos.lenguaje) } as Bloque;
    case 'horizontalRule':
      return { id, tipo: 'separador' };
    default: {
      const tipo = TIPO_DE_NODO[nodo.type ?? ''];
      if (!tipo) throw new Error(`El elemento "${nodo.type ?? '?'}" no tiene un bloque equivalente.`);
      const { leyenda, ...bloque } = atributos.bloque as Record<string, unknown>;
      return { ...bloque, id, ...(textoDe(leyenda) ? { leyenda } : {}) } as Bloque;
    }
  }
}

/** Contenido guardado de un documento. Pura: no genera ids ni valida (eso lo hace el esquema al guardar). */
export function documentoABloques(doc: NodoDocumento): Contenido {
  const contenido: Bloque[] = [];
  for (const elemento of agruparParrafos(doc.content ?? [])) {
    if ('tramos' in elemento) {
      if (elemento.vacio) continue;
      contenido.push({ id: idDe(elemento.nodo), tipo: 'parrafo', texto: unirParrafos(elemento.tramos) });
    } else {
      contenido.push(bloqueDeDocumento(elemento));
    }
  }
  return contenido;
}
