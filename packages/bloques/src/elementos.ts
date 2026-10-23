// Los elementos del documento (contracts/documento.md; research D22, D26 y D31 C2 y C6): sus tipos, cómo se crean,
// su texto, lo que el sitio muestra de ellos y el adaptador de los editores de campos del panel. Funciones puras.
import type { DatosDe, Documento, Elemento, ElementoDe, Inline, TipoConDatos, TipoElemento } from './esquema';
import { hrefSeguro } from './render/enlaces';
import { PROVEEDORES } from './render/proveedores-video';
import { anclaDe } from './utilidades';

// Debe coincidir con privado.tipos_elemento() en la base (invariantes.test.ts en @blog/db).
export const TIPOS_ELEMENTO = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'imagen',
  'galeria',
  'cta',
  'video',
] as const satisfies readonly TipoElemento[];

// El esquema cubre exactamente TIPOS_ELEMENTO: falla la compilación si divergen.
type Igual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const cubreTodosLosTipos: Igual<TipoElemento, (typeof TIPOS_ELEMENTO)[number]> = true;
void cubreTodosLosTipos;

const lista = [{ type: 'listItem', content: [{ type: 'paragraph' }] }];

/** Lo propio de cada tipo en un elemento nuevo del editor: tiene id, pero no es válido hasta completarse. */
const INICIALES = {
  paragraph: {},
  heading: { attrs: { level: 2 } },
  bulletList: { content: lista },
  orderedList: { content: lista },
  blockquote: { content: [{ type: 'paragraph' }] },
  codeBlock: {},
  horizontalRule: {},
  imagen: { attrs: { imagen: { ruta: '', ancho: 0, alto: 0, alt: '', decorativa: false } } },
  galeria: { attrs: { imagenes: [], columnas: 3 } },
  cta: { attrs: { titulo: '', etiquetaBoton: '', url: '' } },
  video: { attrs: { proveedor: 'youtube', idVideo: '', titulo: '' } },
} satisfies Record<TipoElemento, { attrs?: object; content?: object[] }>;

/** Elemento nuevo para el editor, con un id uuid nuevo. */
export function crearElemento<T extends TipoElemento>(tipo: T): ElementoDe<T> {
  const { attrs, content } = structuredClone(INICIALES[tipo]) as { attrs?: object; content?: object[] };
  return {
    type: tipo,
    attrs: { id: crypto.randomUUID(), ...attrs },
    ...(content ? { content } : {}),
  } as unknown as ElementoDe<T>;
}

type NodoLibre = { type: string; text?: string; content?: NodoLibre[] };

/** Texto visible de un contenido en línea: sin marcas ni URL; un salto de línea es `separador`. */
const textoEnLinea = (contenido: readonly Inline[] | undefined, salto: string) =>
  (contenido ?? []).map((nodo) => (nodo.type === 'text' ? nodo.text : salto)).join('');

/** Los párrafos internos de un elemento (los ítems de una lista, el de una cita). */
const parrafosDe = (elemento: Elemento): (readonly Inline[] | undefined)[] => {
  switch (elemento.type) {
    case 'paragraph':
    case 'heading':
      return [elemento.content];
    case 'bulletList':
    case 'orderedList':
      return elemento.content.map((item) => item.content[0].content);
    case 'blockquote':
      return [elemento.content[0].content];
    default:
      return [];
  }
};

/** Texto visible del elemento, sin marcas ni URL: un salto de línea o cada ítem de una lista, en otra línea. */
export function textoDeElemento(elemento: Elemento): string {
  if (elemento.type === 'codeBlock') return elemento.content?.[0]?.text ?? '';
  return parrafosDe(elemento)
    .map((contenido) => textoEnLinea(contenido, '\n'))
    .join('\n');
}

/** id reservados por el layout del sitio (el <main id="contenido"> del enlace para saltar). */
const IDS_RESERVADOS = ['contenido'];

/** El ancla de cada título por su id: única (sufijo -2, -3…); un título sin letras ni números no lleva. */
export function anclasDeTitulos(titulos: { id: string; texto: string }[]): Map<string, string | undefined> {
  const usados = new Set(IDS_RESERVADOS);
  const anclas = new Map<string, string | undefined>();
  for (const { id, texto } of titulos) {
    const base = anclaDe(texto);
    if (!base) {
      anclas.set(id, undefined);
      continue;
    }
    let candidato = base;
    for (let n = 2; usados.has(candidato); n++) candidato = `${base}-${n}`;
    usados.add(candidato);
    anclas.set(id, candidato);
  }
  return anclas;
}

/** Las anclas de los títulos de un documento. */
export const anclasUnicas = (documento: Documento) =>
  anclasDeTitulos(
    documento.content
      .filter((elemento) => elemento.type === 'heading')
      .map((elemento) => ({ id: elemento.attrs.id, texto: textoDeElemento(elemento) })),
  );

/** Lo que ve quien lee (D26): el formato de `pruebas/salida-anterior.json`. */
export type Visible = {
  textos: string[];
  anclas: string[];
  imagenes: { src: string; alt: string; leyenda: string | null }[];
  enlaces: { href: string; texto: string }[];
};

/** El texto como lo ve quien lee: los espacios y saltos reducidos a uno y sin espacios en los bordes. */
export const limpiar = (texto: string) => texto.replace(/\s+/g, ' ').trim();

/** Los enlaces de un contenido en línea: los textos seguidos con el mismo destino son un solo enlace. */
function enlacesDe(contenido: readonly Inline[] | undefined): Visible['enlaces'] {
  const enlaces: Visible['enlaces'] = [];
  let anterior: string | null = null;
  for (const nodo of contenido ?? []) {
    const marca = nodo.type === 'text' ? nodo.marks?.find((m) => m.type === 'link') : undefined;
    const href = marca?.type === 'link' ? hrefSeguro(marca.attrs.href) : null;
    if (href && href === anterior) enlaces[enlaces.length - 1]!.texto += nodo.type === 'text' ? nodo.text : ' ';
    else if (href && nodo.type === 'text') enlaces.push({ href, texto: nodo.text });
    anterior = href;
  }
  return enlaces.map((enlace) => ({ ...enlace, texto: limpiar(enlace.texto) }));
}

/**
 * Lo que muestra el sitio de un documento, sin JSX: un texto por elemento HTML de primer nivel, las anclas de los
 * títulos, las imágenes y los enlaces (lo mismo que se extrae del HTML de `<Documento>`).
 */
export function visibleDeDocumento(documento: Documento): Visible {
  const visible: Visible = { textos: [], anclas: [], imagenes: [], enlaces: [] };
  const anclas = anclasUnicas(documento);
  for (const elemento of documento.content) {
    const parrafos = parrafosDe(elemento);
    const texto = parrafos.map((contenido) => textoEnLinea(contenido, ' ')).join(' ');
    visible.enlaces.push(...parrafos.flatMap(enlacesDe));
    switch (elemento.type) {
      case 'paragraph':
      case 'bulletList':
      case 'orderedList':
        visible.textos.push(limpiar(texto));
        break;
      case 'heading': {
        visible.textos.push(limpiar(texto));
        const ancla = anclas.get(elemento.attrs.id);
        if (ancla) visible.anclas.push(ancla);
        break;
      }
      case 'blockquote': {
        const { autor } = elemento.attrs;
        const fuente = hrefSeguro(elemento.attrs.fuente);
        const pie = autor || fuente ? ` — ${autor ?? ''}${autor && fuente ? ', ' : ''}${fuente ? 'ver la fuente' : ''}` : '';
        if (fuente) visible.enlaces.push({ href: fuente, texto: 'ver la fuente' });
        visible.textos.push(limpiar(texto + pie));
        break;
      }
      case 'codeBlock':
        visible.textos.push(limpiar(`${textoDeElemento(elemento)} ${elemento.attrs.lenguaje ?? ''}`));
        break;
      case 'horizontalRule':
      case 'galeria':
        visible.textos.push('');
        if (elemento.type === 'galeria') {
          for (const imagen of elemento.attrs.imagenes) {
            visible.imagenes.push({ src: imagen.ruta, alt: imagen.decorativa ? '' : (imagen.alt ?? ''), leyenda: null });
          }
        }
        break;
      case 'imagen': {
        const { imagen, leyenda } = elemento.attrs;
        const mostrada = imagen.decorativa ? '' : limpiar(leyenda ?? '');
        visible.imagenes.push({ src: imagen.ruta, alt: imagen.decorativa ? '' : (imagen.alt ?? ''), leyenda: mostrada || null });
        visible.textos.push(mostrada);
        break;
      }
      case 'cta': {
        const { titulo, texto: bajada, etiquetaBoton, url } = elemento.attrs;
        const href = hrefSeguro(url);
        if (href) visible.enlaces.push({ href, texto: limpiar(etiquetaBoton) });
        visible.textos.push(limpiar(`${titulo} ${bajada ?? ''} ${etiquetaBoton}`));
        break;
      }
      case 'video': {
        const proveedor = PROVEEDORES[elemento.attrs.proveedor];
        const enlace = `Ver en ${proveedor.nombre}`;
        visible.enlaces.push({ href: proveedor.original(encodeURIComponent(elemento.attrs.idVideo)), texto: enlace });
        visible.textos.push(limpiar(`${elemento.attrs.titulo} · ${enlace}`));
        break;
      }
    }
  }
  return visible;
}

/** Copia de `objeto` sin las claves con valor `undefined` (forma canónica: el campo ausente no se guarda). */
const sinIndefinidos = <T extends object>(objeto: T): T =>
  Object.fromEntries(Object.entries(objeto).filter(([, valor]) => valor !== undefined)) as T;

/** Los campos que edita el panel, con los nombres de la spec 001 (`nivel`, `ordenada`…). */
export function datosDeElemento<T extends TipoConDatos>(elemento: ElementoDe<T>): DatosDe<T> {
  const actual = elemento as Elemento;
  switch (actual.type) {
    case 'heading':
      return { nivel: actual.attrs.level } as DatosDe<T>;
    case 'bulletList':
    case 'orderedList':
      return { ordenada: actual.type === 'orderedList' } as DatosDe<T>;
    default: {
      const { id: _id, ...campos } = actual.attrs;
      return sinIndefinidos(campos) as DatosDe<T>;
    }
  }
}

/** El elemento con estos campos del panel mezclados; el id y el contenido no cambian. */
export function elementoDesdeDatos<T extends TipoConDatos>(
  elemento: ElementoDe<T>,
  datos: Partial<DatosDe<T>>,
): ElementoDe<T> {
  const actual = elemento as Elemento;
  if (actual.type === 'heading') {
    const { nivel } = datos as Partial<DatosDe<'heading'>>;
    return { ...actual, attrs: { ...actual.attrs, ...(nivel ? { level: nivel } : {}) } } as ElementoDe<T>;
  }
  if (actual.type === 'bulletList' || actual.type === 'orderedList') {
    const { ordenada } = datos as Partial<DatosDe<'bulletList'>>;
    if (ordenada === undefined) return elemento;
    return { ...actual, type: ordenada ? 'orderedList' : 'bulletList' } as ElementoDe<T>;
  }
  return { ...actual, attrs: sinIndefinidos({ ...actual.attrs, ...datos }) } as ElementoDe<T>;
}

/** Visita cada nodo del documento en orden de lectura, con el índice de su elemento de primer nivel. */
export function recorrer(documento: Documento, visitante: (nodo: NodoLibre, indice: number) => void): void {
  const visitar = (nodo: NodoLibre, indice: number) => {
    visitante(nodo, indice);
    for (const hijo of nodo.content ?? []) visitar(hijo, indice);
  };
  documento.content.forEach((elemento, indice) => visitar(elemento as NodoLibre, indice));
}
