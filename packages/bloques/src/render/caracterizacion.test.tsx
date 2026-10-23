// T089 (spec 005, research D26 y D31 C2; RF-023, CE-002): caracterización del sitio con el renderer de bloques de
// HOY. Para cada contenido del corpus (que incluye todos los artículos de `supabase/seed.sql`) extrae del HTML de
// `<Bloques>` lo que ve quien lee: el texto visible de cada elemento de primer nivel, las anclas de los títulos, las
// imágenes (`src`, `alt` y leyenda) y los enlaces (`href` y texto). Lo compara con la *fixture*
// `pruebas/salida-anterior.json`, que se commitea ANTES de tocar el renderer: el renderer nuevo (`<Documento>`,
// T104) y los extractores puros (`visibleDeBloques` y `visibleDeDocumento`) tienen que dar lo mismo.
//
// Para regenerar la *fixture* (solo mientras exista `<Bloques>`):
//   GENERAR_SALIDA_ANTERIOR=1 pnpm --filter @blog/bloques test caracterizacion && pnpm formato
//
// Formato de lo visible (el mismo que devuelven `visibleDeBloques` y `visibleDeDocumento`):
// - `textos`: un texto por elemento HTML de primer nivel (un párrafo con líneas en blanco son varios `<p>`), con el
//   texto que se ve: sin el aviso para lectores de pantalla ("se abre en otra pestaña"), con los espacios y saltos
//   de línea reducidos a un espacio y sin espacios en los bordes. Un elemento sin texto (separador, galería) da "".
// - `anclas`: los `id` de los títulos, en orden (un título sin letras ni números no tiene ancla).
// - `imagenes`: `src`, `alt` y la leyenda (el `figcaption` de la figura de la imagen; `null` si no tiene).
// - `enlaces`: `href` y texto visible de cada `<a>`, en orden.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CORPUS_CONTENIDOS } from '../pruebas/corpus-contenido';
import { CORPUS_DOCUMENTOS, DOCUMENTOS_EQUIVALENTES } from '../pruebas/corpus-documento';
import { ImagenPrueba } from './ayudas-prueba';
import { Bloques } from './index';

type Visible = {
  textos: string[];
  anclas: string[];
  imagenes: { src: string; alt: string; leyenda: string | null }[];
  enlaces: { href: string; texto: string }[];
};

const RUTA_FIXTURE = fileURLToPath(new URL('../pruebas/salida-anterior.json', import.meta.url));
const GENERAR = process.env.GENERAR_SALIDA_ANTERIOR === '1';

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

const visibleDeBloquesRenderizados = (contenido: (typeof CORPUS_CONTENIDOS)[number]['contenido']) =>
  visibleDeHtml(renderToStaticMarkup(<Bloques contenido={contenido} componentes={{ Imagen: ImagenPrueba }} />));

function leerFixture(): Record<string, Visible> {
  if (!existsSync(RUTA_FIXTURE)) {
    throw new Error('Falta pruebas/salida-anterior.json: generala con GENERAR_SALIDA_ANTERIOR=1');
  }
  return JSON.parse(readFileSync(RUTA_FIXTURE, 'utf8')) as Record<string, Visible>;
}

describe('caracterización del renderer de bloques (T089)', () => {
  it('cada contenido del corpus tiene un nombre distinto', () => {
    const nombres = CORPUS_CONTENIDOS.map(({ nombre }) => nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('el extractor lee texto, anclas, imágenes con leyenda y enlaces de un artículo del seed', () => {
    const tipografia = CORPUS_CONTENIDOS.find(({ nombre }) => nombre === 'artículo del seed: tipografía');
    const visible = visibleDeBloquesRenderizados(tipografia?.contenido ?? []);

    expect(visible.textos[0]).toBe(
      'La tipografía es la voz visual de tu marca: transmite personalidad antes de que alguien lea una palabra.',
    );
    expect(visible.anclas).toEqual(['empeza-por-los-valores-de-la-marca']);
    expect(visible.imagenes).toEqual([
      {
        src: 'https://picsum.photos/seed/muestras/1600/900',
        alt: 'Comparación entre una serif clásica y una sans geométrica',
        leyenda: 'Serif y sans: dos personalidades distintas.',
      },
    ]);
    expect(visible.enlaces).toEqual([{ href: 'https://ellenlupton.com', texto: 'ver la fuente' }]);
    expect(visible.textos).toContain('La tipografía es lo que el lenguaje parece. — Ellen Lupton, ver la fuente');
  });

  it('un párrafo con una línea en blanco son dos elementos y el salto simple es un espacio', () => {
    const guia = CORPUS_CONTENIDOS.find(
      ({ nombre }) => nombre === 'artículo del seed: guía visual de todos los bloques',
    );
    const visible = visibleDeBloquesRenderizados(guia?.contenido ?? []);

    expect(visible.textos.slice(0, 2)).toEqual([
      'Este artículo reúne todos los bloques del editor.',
      'Sirve para revisar que cada uno se vea bien. Este renglón va en la misma línea lógica que el anterior.',
    ]);
  });

  if (GENERAR) {
    it('genera pruebas/salida-anterior.json con el renderer de hoy', () => {
      const salida = Object.fromEntries(
        CORPUS_CONTENIDOS.map(({ nombre, contenido }) => [nombre, visibleDeBloquesRenderizados(contenido)]),
      );
      writeFileSync(RUTA_FIXTURE, `${JSON.stringify(salida, null, 2)}\n`);
      expect(Object.keys(salida)).toHaveLength(CORPUS_CONTENIDOS.length);
    });
    return;
  }

  it('la fixture cubre exactamente el corpus (sin contenidos de más ni de menos)', () => {
    expect(Object.keys(leerFixture())).toEqual(CORPUS_CONTENIDOS.map(({ nombre }) => nombre));
  });

  it.each(CORPUS_CONTENIDOS.map(({ nombre, contenido }) => [nombre, contenido] as const))(
    'RF-023, CE-002: "%s" se ve igual que en la fixture',
    (nombre, contenido) => {
      expect(visibleDeBloquesRenderizados(contenido)).toEqual(leerFixture()[nombre]);
    },
  );
});

// ---------------------------------------------------------------------------------------------------------------
// T095 (fase roja): el renderer nuevo y su extractor puro. `<Documento>` muestra lo mismo que `visibleDeDocumento`
// (D31 C2) y, para los documentos equivalentes a contenidos del corpus anterior, lo mismo que la fixture (CE-002).
// Los módulos se importan al correr la prueba para que la parte de T089 siga en verde mientras no existen; T104 los
// pasa a imports estáticos y quita la parte de `<Bloques>`.
// Firmas propuestas: `Documento` en './Documento' (T104) y `visibleDeDocumento` en '../elementos' (T101).
// ---------------------------------------------------------------------------------------------------------------
type ModuloDocumento = {
  Documento: (props: { contenido: unknown; componentes: { Imagen: typeof ImagenPrueba } }) => ReactNode;
};
type ModuloElementos = { visibleDeDocumento: (documento: unknown) => Visible };

const RUTA_DOCUMENTO = './Documento';
const RUTA_ELEMENTOS = '../elementos';

async function rendererNuevo() {
  const { Documento } = (await import(/* @vite-ignore */ RUTA_DOCUMENTO)) as ModuloDocumento;
  const { visibleDeDocumento } = (await import(/* @vite-ignore */ RUTA_ELEMENTOS)) as ModuloElementos;
  const visibleRenderizado = (contenido: unknown) =>
    visibleDeHtml(renderToStaticMarkup(<Documento contenido={contenido} componentes={{ Imagen: ImagenPrueba }} />));
  return { visibleRenderizado, visibleDeDocumento };
}

describe('caracterización del renderer del documento (T095)', () => {
  it.each(CORPUS_DOCUMENTOS.map(({ nombre, documento }) => [nombre, documento] as const))(
    'D31 C2: <Documento> muestra lo mismo que visibleDeDocumento para "%s"',
    async (_nombre, documento) => {
      const { visibleRenderizado, visibleDeDocumento } = await rendererNuevo();

      expect(visibleRenderizado(documento)).toEqual(visibleDeDocumento(documento));
    },
  );

  it.each(Object.entries(DOCUMENTOS_EQUIVALENTES))(
    'CE-002: el documento equivalente a "%s" se ve igual que en la fixture del renderer anterior',
    async (nombre, documento) => {
      const { visibleRenderizado } = await rendererNuevo();

      expect(visibleRenderizado(documento)).toEqual(leerFixture()[nombre]);
    },
  );
});
