// T089 y T095 (spec 005, research D26 y D31 C2; RF-023, CE-002): caracterización del sitio. La *fixture*
// `pruebas/salida-anterior.json` guarda lo que mostraba el renderer de bloques (T089, generada antes de retirarlo en
// T104 y fija desde entonces): para cada contenido del corpus, el texto visible de cada elemento de primer nivel, las
// anclas de los títulos, las imágenes (`src`, `alt` y leyenda) y los enlaces (`href` y texto). `<Documento>` tiene que
// mostrar lo mismo que el extractor puro `visibleDeDocumento` y, para los documentos equivalentes, lo de la fixture.
//
// Formato de lo visible (el mismo que devuelve `visibleDeDocumento`):
// - `textos`: un texto por elemento HTML de primer nivel, con el texto que se ve: sin el aviso para lectores de
//   pantalla ("se abre en otra pestaña"), con los espacios y saltos de línea reducidos a un espacio y sin espacios en
//   los bordes. Un elemento sin texto (separador, galería) da "".
// - `anclas`: los `id` de los títulos, en orden (un título sin letras ni números no tiene ancla).
// - `imagenes`: `src`, `alt` y la leyenda (el `figcaption` de la figura de la imagen; `null` si no tiene).
// - `enlaces`: `href` y texto visible de cada `<a>`, en orden.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CORPUS_DOCUMENTOS, DOCUMENTOS_EQUIVALENTES } from '../pruebas/corpus-documento';
import { visibleDeDocumento, type Visible } from '../elementos';
import { ImagenPrueba } from './ayudas-prueba';
import { Documento } from './index';

const RUTA_FIXTURE = fileURLToPath(new URL('../pruebas/salida-anterior.json', import.meta.url));

/** Etiquetas que separan texto (un salto visual): entre ellas se pone un espacio. */
const ETIQUETAS_DE_BLOQUE = new Set([
  'p',
  'li',
  'h2',
  'h3',
  'h4',
  'figcaption',
  'blockquote',
  'pre',
  'ul',
  'ol',
  'figure',
  'aside',
  'br',
  'hr',
  'iframe',
  'div',
  'table',
  'caption',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
]);
// React 19 adelanta un <link rel="preload"> por imagen: no es visible y no cuenta como elemento.
const ETIQUETAS_VACIAS = new Set(['img', 'br', 'hr', 'link', 'meta', 'source', 'wbr']);

const desescapar = (valor: string) =>
  valor
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');

const limpiar = (texto: string) => texto.replace(/\s+/g, ' ').trim();

function atributos(crudo: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [, nombre, valor] of crudo.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) {
    if (nombre !== undefined && valor !== undefined) salida[nombre] = desescapar(valor);
  }
  return salida;
}

type Abierta = { etiqueta: string; atributos: Record<string, string>; ocultaTexto: boolean };

/**
 * Lo visible de un HTML estático de React (bien formado, con los atributos escapados). Sin DOM: recorre las
 * etiquetas con una pila.
 */
function visibleDeHtml(html: string): Visible {
  const visible: Visible = { textos: [], anclas: [], imagenes: [], enlaces: [] };
  const pila: Abierta[] = [];
  let textoElemento = '';
  let textoEnlace: string | null = null;
  let hrefEnlace = '';
  let textoLeyenda: string | null = null;
  let imagenesDeLaFigura: Visible['imagenes'] = [];

  const oculto = () => pila.some((abierta) => abierta.ocultaTexto);
  const agregarTexto = (texto: string) => {
    if (oculto()) return;
    textoElemento += texto;
    if (textoEnlace !== null) textoEnlace += texto;
    if (textoLeyenda !== null) textoLeyenda += texto;
  };

  for (const [, cierre, etiqueta, crudo, texto] of html.matchAll(/<(\/?)([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g)) {
    if (texto !== undefined) {
      agregarTexto(desescapar(texto));
      continue;
    }
    const nombre = (etiqueta ?? '').toLowerCase();
    if (ETIQUETAS_DE_BLOQUE.has(nombre)) agregarTexto(' ');

    if (cierre) {
      pila.pop();
      if (nombre === 'a' && textoEnlace !== null) {
        visible.enlaces.push({ href: hrefEnlace, texto: limpiar(textoEnlace) });
        textoEnlace = null;
      }
      if (nombre === 'figcaption' && textoLeyenda !== null) {
        const leyenda = limpiar(textoLeyenda);
        for (const imagen of imagenesDeLaFigura) imagen.leyenda = leyenda || null;
        textoLeyenda = null;
      }
      if (pila.length === 0) {
        visible.textos.push(limpiar(textoElemento));
        textoElemento = '';
        imagenesDeLaFigura = [];
      }
      continue;
    }

    const attrs = atributos(crudo ?? '');
    if (nombre === 'img') {
      const imagen = { src: attrs.src ?? '', alt: attrs.alt ?? '', leyenda: null };
      visible.imagenes.push(imagen);
      // La leyenda solo es de la imagen si la figura de primer nivel la contiene directamente (no en una galería).
      if (pila.length === 1 && pila[0]?.etiqueta === 'figure') imagenesDeLaFigura.push(imagen);
    }
    if (/^h[2-4]$/.test(nombre) && attrs.id) visible.anclas.push(attrs.id);
    if (nombre === 'a') {
      textoEnlace = '';
      hrefEnlace = attrs.href ?? '';
    }
    if (nombre === 'figcaption' && pila.length === 1 && imagenesDeLaFigura.length > 0) textoLeyenda = '';

    if (ETIQUETAS_VACIAS.has(nombre)) {
      if (pila.length === 0 && nombre === 'hr') visible.textos.push('');
      continue;
    }
    pila.push({
      etiqueta: nombre,
      atributos: attrs,
      ocultaTexto: (attrs.class ?? '').split(/\s+/).includes('sr-only'),
    });
  }
  return visible;
}

function leerFixture(): Record<string, Visible> {
  return JSON.parse(readFileSync(RUTA_FIXTURE, 'utf8')) as Record<string, Visible>;
}

const visibleRenderizado = (contenido: unknown) =>
  visibleDeHtml(
    renderToStaticMarkup(<Documento contenido={contenido as never} componentes={{ Imagen: ImagenPrueba }} />),
  );

describe('caracterización del renderer del documento (T095)', () => {
  it.each(CORPUS_DOCUMENTOS.map(({ nombre, documento }) => [nombre, documento] as const))(
    'D31 C2: <Documento> muestra lo mismo que visibleDeDocumento para "%s"',
    (_nombre, documento) => {
      expect(visibleRenderizado(documento)).toEqual(visibleDeDocumento(documento));
    },
  );

  it.each(Object.entries(DOCUMENTOS_EQUIVALENTES))(
    'CE-002: el documento equivalente a "%s" se ve igual que en la fixture del renderer anterior',
    (nombre, documento) => {
      expect(visibleRenderizado(documento)).toEqual(leerFixture()[nombre]);
    },
  );
});
