// Correspondencia entre la lista de bloques del formato anterior y el documento guardado (contracts/documento.md,
// "Correspondencia con el formato anterior"; research D25). Solo para el script de conversión de un solo uso.
// Funciones puras: no importan React ni la librería del editor.
import { createHash } from 'node:crypto';
import type { Documento } from '../esquema';
import { normalizarDocumento } from '../normalizar';
import { analizarEnLinea, serializarEnLinea, type NodoEnLinea } from './en-linea';
import type { Bloque, Contenido } from './esquema-bloques';
import { partirParrafos } from './parrafos';

type MarcaDocumento = { type: string; attrs?: Record<string, unknown> };
type NodoDocumento = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: NodoDocumento[];
  marks?: MarcaDocumento[];
  text?: string;
};

/**
 * uuid v5 (RFC 9562) con el id del bloque como espacio de nombres y el número de tramo como nombre: el id del n-ésimo
 * párrafo que sale de un párrafo con líneas en blanco. Repetible: convertir dos veces da los mismos ids.
 */
export function idDeTramo(idBloque: string, numero: number): string {
  const hash = createHash('sha1')
    .update(Buffer.concat([Buffer.from(idBloque.replaceAll('-', ''), 'hex'), Buffer.from(String(numero), 'utf8')]))
    .digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Los tramos de un párrafo que el sitio mostraba (un `<p>` por tramo que no está en blanco). */
const tramosVisibles = (texto: string) => partirParrafos(texto).filter((tramo) => tramo.texto.trim() !== '');

/**
 * Lo que devuelve la ida y vuelta: cada párrafo con sus tramos visibles unidos por una sola línea en blanco; un
 * párrafo sin tramos visibles desaparece. El resto del contenido queda igual.
 */
export function reducirTramos(contenido: Contenido): Contenido {
  return contenido.flatMap((bloque): Bloque[] => {
    if (bloque.tipo !== 'parrafo') return [bloque];
    const tramos = tramosVisibles(bloque.texto);
    return tramos.length > 0 ? [{ ...bloque, texto: tramos.map((tramo) => tramo.texto).join('\n\n') }] : [];
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Texto en línea: árbol de marcas ⇄ tramos de texto con marcas

type Marca = { tipo: 'enlace' | 'negrita' | 'cursiva' | 'codigo'; href?: string };
type Tramo = { texto: string; marcas: Marca[] };

/** Orden de anidado de las marcas: el canónico del documento (enlace por fuera, código por dentro). */
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

/** Contenido en línea de un texto guardado. Con `saltos`, el `\n` pasa a `hardBreak` (las marcas siguen después). */
function enLineaADocumento(texto: string, saltos: boolean): NodoDocumento[] {
  const resultado: NodoDocumento[] = [];
  for (const tramo of aTramos(analizarEnLinea(texto))) {
    const lineas = saltos ? tramo.texto.split('\n') : [tramo.texto];
    lineas.forEach((linea, i) => {
      if (i > 0) resultado.push({ type: 'hardBreak' });
      if (!linea) return;
      const marcas = tramo.marcas.map(marcaDeDocumento);
      resultado.push({ type: 'text', text: linea, ...(marcas.length > 0 ? { marks: marcas } : {}) });
    });
  }
  return resultado;
}

/** Un tramo de párrafo: cada línea es su propio texto en línea (como en el sitio) y el salto simple, `hardBreak`. */
const parrafoADocumento = (texto: string): NodoDocumento[] =>
  texto
    .split('\n')
    .flatMap((linea, i): NodoDocumento[] => [
      ...(i > 0 ? [{ type: 'hardBreak' }] : []),
      ...enLineaADocumento(linea, false),
    ]);

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

/** Tramo de párrafo guardado: las líneas se serializan por separado, igual que las lee el sitio. */
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
const parrafoInterno = (texto: string): NodoDocumento => ({
  type: 'paragraph',
  ...conContenido(enLineaADocumento(texto, true)),
});
const opcionales = (campos: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(campos).filter(([, valor]) => valor !== undefined && valor !== ''));

/** Los elementos del documento de un bloque (un párrafo con líneas en blanco da uno por tramo visible). */
export function bloqueADocumento(bloque: Bloque): NodoDocumento[] {
  const { id } = bloque;
  switch (bloque.tipo) {
    case 'parrafo':
      return tramosVisibles(bloque.texto).map((tramo, n) => ({
        type: 'paragraph',
        attrs: { id: n === 0 ? id : idDeTramo(id, n) },
        ...conContenido(parrafoADocumento(tramo.texto)),
      }));
    case 'titulo':
      // El sitio dibujaba el título sin leer marcas: el texto pasa tal cual.
      return [
        {
          type: 'heading',
          attrs: { id, level: bloque.nivel },
          ...conContenido(bloque.texto ? [{ type: 'text', text: bloque.texto }] : []),
        },
      ];
    case 'cita':
      return [
        {
          type: 'blockquote',
          attrs: { id, ...opcionales({ autor: bloque.autor, fuente: bloque.fuente }) },
          content: [parrafoInterno(bloque.texto)],
        },
      ];
    case 'lista':
      return [
        {
          type: bloque.ordenada ? 'orderedList' : 'bulletList',
          attrs: { id },
          content: bloque.items.map((item) => ({ type: 'listItem', content: [parrafoInterno(item)] })),
        },
      ];
    case 'codigo':
      return [
        {
          type: 'codeBlock',
          attrs: { id, ...opcionales({ lenguaje: bloque.lenguaje }) },
          ...conContenido(bloque.codigo ? [{ type: 'text', text: bloque.codigo }] : []),
        },
      ];
    case 'separador':
      return [{ type: 'horizontalRule', attrs: { id } }];
    default: {
      const { tipo, id: _id, ...campos } = bloque;
      return [{ type: tipo, attrs: { id, ...campos } }];
    }
  }
}

/** El documento de un contenido del formato anterior, en forma canónica. */
export function bloquesADocumento(contenido: Contenido): Documento {
  return normalizarDocumento({ type: 'doc', content: contenido.flatMap(bloqueADocumento) });
}

// ---------------------------------------------------------------------------------------------------------------
// Documento → bloques (la verificación de ida y vuelta del script)

const textoDe = (valor: unknown) => (typeof valor === 'string' ? valor : '');
const opcional = <T extends string>(campo: T, valor: unknown) => (textoDe(valor) ? { [campo]: textoDe(valor) } : {});
const primerParrafo = (nodo: NodoDocumento) => nodo.content?.find((hijo) => hijo.type === 'paragraph');

function bloqueDeDocumento(nodo: NodoDocumento): Bloque {
  const atributos = nodo.attrs ?? {};
  const id = textoDe(atributos.id);
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
      return {
        id,
        tipo: 'codigo',
        codigo: textoSinMarcas(nodo.content),
        ...opcional('lenguaje', atributos.lenguaje),
      } as Bloque;
    case 'horizontalRule':
      return { id, tipo: 'separador' };
    default: {
      const { id: _id, ...campos } = atributos;
      return { id, tipo: nodo.type, ...campos } as Bloque;
    }
  }
}

/**
 * El contenido del formato anterior de un documento. Los párrafos seguidos con los ids `idDeTramo(id, 1)`,
 * `idDeTramo(id, 2)`… del párrafo anterior vuelven a ser tramos de su bloque, unidos por una línea en blanco.
 */
export function documentoABloques(documento: Documento): Contenido {
  const contenido: Bloque[] = [];
  let grupo: { bloque: Extract<Bloque, { tipo: 'parrafo' }>; siguiente: number } | null = null;
  for (const nodo of documento.content as NodoDocumento[]) {
    const id = textoDe(nodo.attrs?.id);
    if (nodo.type === 'paragraph') {
      const texto = parrafoDeDocumento(nodo.content);
      if (grupo && id === idDeTramo(grupo.bloque.id, grupo.siguiente)) {
        grupo.bloque.texto += `\n\n${texto}`;
        grupo.siguiente += 1;
        continue;
      }
      grupo = { bloque: { id, tipo: 'parrafo', texto }, siguiente: 1 };
      contenido.push(grupo.bloque);
      continue;
    }
    grupo = null;
    contenido.push(bloqueDeDocumento(nodo));
  }
  return contenido;
}
