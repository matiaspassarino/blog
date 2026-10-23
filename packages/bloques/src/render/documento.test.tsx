// T095 (spec 005, ampliación): salida HTML de <Documento> (research D27; contracts/documento.md; RF-002 y RF-003
// de la spec 002, RF-026 de la 005). Render estático, sin DOM. Reutiliza los componentes de hoy (Titulo, Cita, Lista,
// Codigo, Galeria, Cta, Video, ImagenBloque) y un `EnLinea` que pinta las marcas: strong, em, code, a y br.
//
// Firmas propuestas (T104), exportadas desde './index':
//   Documento({ contenido, componentes }: { contenido: Documento; componentes: ComponentesDocumento }): ReactNode
//   EnLinea({ contenido }: { contenido: Inline[] }): ReactNode   (en './EnLinea')
import { afterEach, describe, expect, it, vi } from 'vitest';
import { alineado, imagenDePrueba as imagenDelCorpus, marca, nodo } from '../pruebas/corpus-documento';
import { documentoDe, renderizarDocumento, renderizarElementos } from './ayudas-documento';
import { imagenDePrueba, ImagenPrueba } from './ayudas-prueba';
import { CLASE_ENLACE } from './enlaces';
import { CLASES_PARRAFO, type PropsImagen } from './index';

const { texto, salto, parrafo, titulo, item, vinetas, numerada, cita, codigo, separador } = nodo;

afterEach(() => {
  vi.restoreAllMocks();
});

const P = (interior: string) => `<p class="${CLASES_PARRAFO}">${interior}</p>`;

/** Posición de cada marca en el HTML; falla si alguna no aparece. */
function posiciones(html: string, marcas: string[]) {
  return marcas.map((textoBuscado) => {
    const posicion = html.indexOf(textoBuscado);
    expect(posicion, `falta "${textoBuscado}" en la salida`).toBeGreaterThanOrEqual(0);
    return posicion;
  });
}

describe('<Documento>', () => {
  it('H1-E1: un documento con los once tipos sale en el mismo orden del contenido', () => {
    const html = renderizarElementos(
      parrafo(texto('Marca del párrafo.')),
      titulo(2, texto('Marca del título')),
      vinetas(item(texto('Marca de la lista con viñetas'))),
      numerada(item(texto('Marca de la lista numerada'))),
      cita({ autor: 'Autora de la cita' }, texto('Marca de la cita.')),
      codigo('const marcaDelCodigo = 1;', 'js'),
      separador(),
      nodo.imagen(imagenDePrueba(1, { alt: 'Marca de la imagen' }), 'Leyenda de la imagen'),
      nodo.galeria(2, imagenDePrueba(2, { alt: 'Marca de la galería' }), imagenDePrueba(3)),
      nodo.cta({ titulo: 'Marca de la llamada', etiquetaBoton: 'Contáctanos', url: '/contacto' }),
      nodo.video('youtube', 'dQw4w9WgXcQ', 'Marca del video'),
    );

    const orden = posiciones(html, [
      'Marca del párrafo.',
      'Marca del título',
      'Marca de la lista con viñetas',
      'Marca de la lista numerada',
      'Marca de la cita.',
      'const marcaDelCodigo = 1;',
      '<hr',
      'Marca de la imagen',
      'Marca de la galería',
      'Marca de la llamada',
      'Marca del video',
    ]);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  it('el documento vacío no produce nada', () => {
    expect(renderizarDocumento(documentoDe())).toBe('');
  });

  it('sin contenedores por elemento: dos párrafos son dos <p> seguidos', () => {
    expect(renderizarElementos(parrafo(texto('Uno.')), parrafo(texto('Dos.')))).toBe(P('Uno.') + P('Dos.'));
  });

  it('H1-E1: usa el componente Imagen que recibe por props, con sizes', () => {
    const imagenPropia = vi.fn((props: PropsImagen) => <ImagenPrueba {...props} />);
    const imagen = imagenDePrueba(1, { alt: 'Una foto propia' });

    const html = renderizarDocumento(documentoDe(nodo.imagen(imagen)), imagenPropia);

    expect(imagenPropia).toHaveBeenCalledTimes(1);
    const props = imagenPropia.mock.calls[0]?.[0];
    expect(props?.imagen).toEqual(imagen);
    expect(props?.sizes.length).toBeGreaterThan(0);
    expect(html).toContain('alt="Una foto propia"');
  });

  it('H1-E1: la galería también delega cada imagen en el componente Imagen', () => {
    const imagenPropia = vi.fn((props: PropsImagen) => <ImagenPrueba {...props} />);

    renderizarDocumento(
      documentoDe(nodo.galeria(3, imagenDePrueba(1), imagenDePrueba(2), imagenDePrueba(3))),
      imagenPropia,
    );

    expect(imagenPropia).toHaveBeenCalledTimes(3);
  });

  it('un tipo desconocido no rompe el render, no produce nada y avisa con console.warn', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const html = renderizarElementos(
      parrafo(texto('Antes.')),
      { type: 'tabla', attrs: { id: crypto.randomUUID() } },
      parrafo(texto('Después.')),
    );

    expect(html).toBe(P('Antes.') + P('Después.'));
    expect(aviso).toHaveBeenCalled();
    expect(String(aviso.mock.calls[0]?.join(' '))).toContain('tabla');
  });
});

describe('paragraph y EnLinea', () => {
  it('RF-002: un párrafo es un <p> con las clases de hoy', () => {
    expect(renderizarElementos(parrafo(texto('Hola.')))).toBe(P('Hola.'));
  });

  it('RF-002: un hardBreak es un <br>', () => {
    expect(renderizarElementos(parrafo(texto('Primera línea.'), salto(), texto('Segunda línea.')))).toBe(
      P('Primera línea.<br/>Segunda línea.'),
    );
  });

  it.each([
    ['bold', marca.negrita, '<strong>fuerte</strong>'],
    ['italic', marca.cursiva, '<em>fuerte</em>'],
    ['code', marca.codigo, '<code>fuerte</code>'],
  ])('la marca %s se dibuja con su etiqueta', (_caso, marcaDelTexto, esperado) => {
    expect(renderizarElementos(parrafo(texto('Muy '), texto('fuerte', marcaDelTexto)))).toBe(P(`Muy ${esperado}`));
  });

  it('bold e italic juntos se anidan', () => {
    const html = renderizarElementos(parrafo(texto('ambas', marca.negrita, marca.cursiva)));

    expect(html).toMatch(/<strong><em>ambas<\/em><\/strong>|<em><strong>ambas<\/strong><\/em>/);
  });

  it('un enlace interno es un <a> con la clase de enlace y sin target', () => {
    const html = renderizarElementos(parrafo(texto('Mirá '), texto('el blog', marca.enlace('/blog'))));

    expect(html).toBe(P(`Mirá <a href="/blog" class="${CLASE_ENLACE}">el blog</a>`));
  });

  it('H1-E6: un enlace externo se abre en otra pestaña de forma segura y lo anuncia', () => {
    const html = renderizarElementos(parrafo(texto('la guía', marca.enlace('https://www.w3.org/WAI/'))));

    expect(html).toMatch(/<a href="https:\/\/www\.w3\.org\/WAI\/" target="_blank" rel="noopener noreferrer"/);
    expect(html).toContain('se abre en otra pestaña');
  });

  it('un enlace con negrita: la negrita va dentro del enlace (link es la primera marca)', () => {
    const html = renderizarElementos(parrafo(texto('la guía', marca.enlace('/guia'), marca.negrita)));

    expect(html).toMatch(/<a href="\/guia"[^>]*><strong>la guía<\/strong><\/a>/);
  });

  it('dos textos seguidos con el mismo enlace son un solo <a>', () => {
    const html = renderizarElementos(
      parrafo(texto('una ', marca.enlace('/x')), texto('guía', marca.enlace('/x'), marca.negrita)),
    );

    expect(html.match(/<a[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<a href="\/x"[^>]*>una <strong>guía<\/strong><\/a>/);
  });
});

describe('heading', () => {
  it.each([2, 3, 4] as const)('RF-002: el level %i produce un h%i', (level) => {
    const html = renderizarElementos(titulo(level, texto('Un subtítulo')));

    expect(html).toMatch(new RegExp(`<h${level}[^>]*>Un subtítulo</h${level}>`));
  });

  it('RF-002: lleva como id el ancla del texto, como hoy', () => {
    const html = renderizarElementos(titulo(2, texto('Cómo empezar: el diseño, paso a paso')));

    expect(html).toMatch(/<h2[^>]*\sid="como-empezar-el-diseno-paso-a-paso"[^>]*>/);
  });

  it('RF-009: un título con formato dibuja las marcas y calcula el ancla con el texto', () => {
    const html = renderizarElementos(titulo(2, texto('Un título con '), texto('negrita', marca.negrita)));

    expect(html).toMatch(/<h2[^>]*\sid="un-titulo-con-negrita"[^>]*>Un título con <strong>negrita<\/strong><\/h2>/);
  });

  it('RSEO-008: nunca produce un h1', () => {
    const html = renderizarElementos(titulo(2, texto('Uno')), titulo(3, texto('Dos')), titulo(4, texto('Tres')));

    expect(html).not.toContain('<h1');
  });
});

describe('bulletList y orderedList', () => {
  it('RF-002: una lista numerada produce <ol> con un <li> por ítem y sus marcas', () => {
    const html = renderizarElementos(numerada(item(texto('Uno')), item(texto('Dos '), texto('fuerte', marca.negrita))));

    expect(html).toMatch(/<ol[\s>]/);
    expect(html).not.toContain('<ul');
    expect(html).toMatch(/<li[^>]*>Uno<\/li>\s*<li[^>]*>Dos <strong>fuerte<\/strong><\/li>/);
  });

  it('RF-002: una lista con viñetas produce <ul>, sin <p> dentro de los ítems', () => {
    const html = renderizarElementos(vinetas(item(texto('Uno')), item(texto('Dos'))));

    expect(html).toMatch(/<ul[\s>]/);
    expect(html).not.toContain('<ol');
    expect(html.match(/<li[\s>]/g)).toHaveLength(2);
    expect(html).not.toContain('<p');
  });
});

describe('blockquote', () => {
  it('RF-002: produce <blockquote cite> y un <figcaption> con el autor y la fuente enlazada', () => {
    const html = renderizarElementos(
      cita(
        { autor: 'Mies van der Rohe', fuente: 'https://ejemplo.com/fuente' },
        texto('Menos es '),
        texto('más', marca.cursiva),
      ),
    );

    expect(html).toMatch(/<figure[\s>]/);
    expect(html).toMatch(
      /<blockquote[^>]*cite="https:\/\/ejemplo\.com\/fuente"[^>]*>Menos es <em>más<\/em><\/blockquote>/,
    );
    const pie = html.match(/<figcaption[^>]*>(.*?)<\/figcaption>/s)?.[1] ?? '';
    expect(pie).toContain('Mies van der Rohe');
    expect(pie).toMatch(/<a[^>]*href="https:\/\/ejemplo\.com\/fuente"[^>]*>/);
  });

  it('RF-002: sin autor ni fuente no lleva cite, enlace ni figcaption', () => {
    const html = renderizarElementos(cita({}, texto('Menos es más.')));

    expect(html).toContain('<blockquote');
    expect(html).not.toContain('cite=');
    expect(html).not.toContain('<a');
    expect(html).not.toContain('<figcaption');
  });
});

describe('codeBlock', () => {
  it('RF-002: produce <pre tabindex="0"><code data-lenguaje> y el lenguaje visible', () => {
    const html = renderizarElementos(codigo('const a = 1;', 'typescript'));

    expect(html).toMatch(
      /<pre[^>]*tabindex="0"[^>]*><code[^>]*data-lenguaje="typescript"[^>]*>const a = 1;<\/code><\/pre>/,
    );
    expect(html).toMatch(/<figcaption[^>]*>.*typescript.*<\/figcaption>/is);
  });

  it('RF-002: conserva los saltos de línea, la indentación y los marcadores como texto', () => {
    const fuente = 'function hola() {\n  return **1**;\n}';

    expect(renderizarElementos(codigo(fuente, 'js'))).toContain(fuente);
  });

  it('un bloque de código vacío produce un <code> vacío', () => {
    expect(renderizarElementos(codigo(''))).toMatch(/<code[^>]*><\/code>/);
  });
});

describe('horizontalRule', () => {
  it('RF-002: produce un <hr>', () => {
    expect(renderizarElementos(separador())).toMatch(/<hr[\s/>]/);
  });
});

describe('imagen', () => {
  it('H1-E3: con leyenda produce <figure> con la imagen y un <figcaption>', () => {
    const html = renderizarElementos(nodo.imagen(imagenDePrueba(1, { alt: 'Boceto de una interfaz' }), 'Un boceto.'));

    expect(html).toMatch(
      /<figure[\s>].*<img[^>]*alt="Boceto de una interfaz"[^>]*>.*<figcaption[^>]*>Un boceto\.<\/figcaption><\/figure>/s,
    );
    expect(html).toMatch(/<img[^>]*width="1600"[^>]*>/);
  });

  it('H1-E3: una imagen decorativa sale con alt="" y sin leyenda, aunque tenga una', () => {
    const html = renderizarElementos(nodo.imagen(imagenDelCorpus('decorativa'), 'No se debería anunciar'));

    expect(html).toMatch(/<img[^>]*alt=""[^>]*>/);
    expect(html).not.toContain('<figcaption');
    expect(html).not.toContain('No se debería anunciar');
  });
});

describe('galeria', () => {
  it.each([2, 3, 4] as const)('RF-002: con %i columnas usa esa grilla desde 768 px (md:grid-cols-%i)', (columnas) => {
    const html = renderizarElementos(nodo.galeria(columnas, imagenDePrueba(1), imagenDePrueba(2)));

    expect(html).toMatch(/<ul[^>]*role="list"[^>]*>/);
    const clases = html.match(/<ul[^>]*class="([^"]*)"/)?.[1] ?? '';
    expect(clases.split(/\s+/)).toContain(`md:grid-cols-${columnas}`);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// T124 (spec 005, Fase 12, H6 esc. 1 a 5; RF-026; research D27, D31 U9 y U16): las marcas nuevas y la alineación en el
// renderer del sitio (y del lienzo, que usa las mismas clases de `render/clases.ts`). FASE ROJA: `EnLinea` solo dibuja
// strong, em, code y a, y los párrafos y títulos no leen `textAlign`.
//
// Decisiones de interfaz que fija esta prueba (T129):
//   - `u` con las clases `decoration-1 underline-offset-2 decoration-current` (sin `hover:`): no se parece al enlace,
//     que conserva `CLASE_ENLACE` (línea de marca, `underline-offset-4`, `hover:decoration-2`).
//   - `mark` con los tokens nuevos: `bg-resaltado` y `text-resaltado-texto` (el modo `forced-colors` lo resuelve
//     `tokens.css`, T125).
//   - `s`, `sup` y `sub` sin clases propias (los estilos de base de Tailwind alcanzan).
//   - Anidadas de afuera hacia adentro en el orden canónico: a, strong, em, u, s, mark, code, sup, sub.
//   - Un texto con enlace y subrayado se dibuja solo como enlace (sin `u`): no agrega una segunda línea.
//   - Alineación: `text-center`, `text-right` y `text-justify hyphens-auto`, sumadas a las clases de hoy del párrafo o
//     del título; un valor que no es de la lista no agrega nada.
// ---------------------------------------------------------------------------------------------------------------------

const CLASES_SUBRAYADO = ['decoration-1', 'underline-offset-2', 'decoration-current'];
const CLASES_RESALTADO = ['bg-resaltado', 'text-resaltado-texto'];

/** Las clases de la primera etiqueta `<nombre …>` del HTML (`[]` si no está o no tiene clases). */
const clasesDeLaEtiqueta = (html: string, nombre: string) =>
  (new RegExp(`<${nombre}(?:\\s[^>]*)?>`).exec(html)?.[0].match(/class="([^"]*)"/)?.[1] ?? '')
    .split(/\s+/)
    .filter(Boolean);

describe('EnLinea: más formato (H6, RF-009, RF-026)', () => {
  it.each([
    ['strike', 's', marca.tachado],
    ['superscript', 'sup', marca.superindice],
    ['subscript', 'sub', marca.subindice],
  ])('H6-E5: la marca %s se dibuja con <%s>', (_caso, etiqueta, marcaDelTexto) => {
    const html = renderizarElementos(parrafo(texto('Muy '), texto('marcado', marcaDelTexto)));

    expect(html).toMatch(
      new RegExp(`^<p class="${CLASES_PARRAFO}">Muy <${etiqueta}(\\s[^>]*)?>marcado</${etiqueta}></p>$`),
    );
  });

  it('D31 U9: el subrayado es un <u> con línea fina del color del texto y sin efecto al pasar el puntero', () => {
    const html = renderizarElementos(parrafo(texto('Muy '), texto('subrayado', marca.subrayado)));

    expect(html).toMatch(/<u[\s>][^]*>subrayado<\/u>/);
    const clases = clasesDeLaEtiqueta(html, 'u');
    expect(clases).toEqual(expect.arrayContaining(CLASES_SUBRAYADO));
    expect(clases.filter((clase) => clase.startsWith('hover:'))).toEqual([]);
    expect(clases).not.toContain('decoration-marca');
  });

  it('H6-E5: el resaltado es un <mark> con los colores del diseño del sitio (tokens)', () => {
    const html = renderizarElementos(parrafo(texto('Un '), texto('resaltado', marca.resaltado)));

    expect(html).toMatch(/<mark[\s>][^]*>resaltado<\/mark>/);
    expect(clasesDeLaEtiqueta(html, 'mark')).toEqual(expect.arrayContaining(CLASES_RESALTADO));
  });

  it('H6-PI: «m2» con el 2 en superíndice y «H2O» con el 2 en subíndice', () => {
    const html = renderizarElementos(
      parrafo(texto('m'), texto('2', marca.superindice), texto(' y H'), texto('2', marca.subindice), texto('O')),
    );

    expect(html).toBe(P('m<sup>2</sup> y H<sub>2</sub>O'));
  });

  it('H6-E3: las marcas combinadas se anidan en el orden canónico (strong, em, u, s, mark)', () => {
    const html = renderizarElementos(
      parrafo(texto('todo', marca.negrita, marca.cursiva, marca.subrayado, marca.tachado, marca.resaltado)),
    );

    expect(html).toMatch(/<strong><em><u [^>]*><s><mark [^>]*>todo<\/mark><\/s><\/u><\/em><\/strong>/);
  });

  it('H6-E3: el superíndice va dentro de los demás formatos', () => {
    const html = renderizarElementos(parrafo(texto('2', marca.negrita, marca.resaltado, marca.superindice)));

    expect(html).toMatch(/<strong><mark [^>]*><sup>2<\/sup><\/mark><\/strong>/);
  });

  it('H6-E3 / D31 U9: un enlace subrayado se dibuja solo como enlace, sin una segunda línea', () => {
    const html = renderizarElementos(
      parrafo(texto('Mirá '), texto('el blog', marca.enlace('/blog'), marca.negrita, marca.subrayado)),
    );

    expect(html).toBe(P(`Mirá <a href="/blog" class="${CLASE_ENLACE}"><strong>el blog</strong></a>`));
    expect(html).not.toContain('<u');
  });

  it('H6-E3: un enlace con resaltado y tachado conserva esas marcas dentro del enlace', () => {
    const html = renderizarElementos(parrafo(texto('aviso', marca.enlace('/x'), marca.tachado, marca.resaltado)));

    expect(html).toMatch(/<a href="\/x"[^>]*><s><mark [^>]*>aviso<\/mark><\/s><\/a>/);
  });

  it('H6-E1: los formatos nuevos se dibujan también en títulos, citas e ítems de lista', () => {
    const html = renderizarElementos(
      titulo(2, texto('Un '), texto('título', marca.subrayado)),
      cita({}, texto('Una '), texto('cita', marca.resaltado)),
      vinetas(item(texto('Un '), texto('ítem', marca.tachado))),
    );

    expect(html).toMatch(/<h2[^>]*>Un <u [^>]*>título<\/u><\/h2>/);
    expect(html).toMatch(/<blockquote[^>]*>Una <mark [^>]*>cita<\/mark><\/blockquote>/);
    expect(html).toMatch(/<li[^>]*>Un <s>ítem<\/s><\/li>/);
  });

  it('H6-E1: el ancla de un título con formatos se calcula con su texto', () => {
    const html = renderizarElementos(titulo(2, texto('Agua: H'), texto('2', marca.subindice), texto('O')));

    expect(html).toMatch(/<h2[^>]*\sid="agua-h2o"[^>]*>Agua: H<sub>2<\/sub>O<\/h2>/);
  });

  it('H6-E5: los lectores de pantalla reciben el texto completo (sin texto oculto ni aria-hidden)', () => {
    const html = renderizarElementos(
      parrafo(texto('m'), texto('2', marca.superindice), texto(' '), texto('ojo', marca.resaltado, marca.subrayado)),
    );

    expect(html).not.toContain('aria-hidden');
    expect(html).not.toContain('sr-only');
    expect(html.replace(/<[^>]*>/g, '')).toBe('m2 ojo');
  });
});

describe('alineación de párrafos y títulos (H6-E4, RF-024, RF-026)', () => {
  it.each([
    ['center', ['text-center']],
    ['right', ['text-right']],
    ['justify', ['text-justify', 'hyphens-auto']],
  ])('un párrafo con textAlign %j suma %j a sus clases de hoy', (textAlign, esperadas) => {
    const html = renderizarElementos(alineado(parrafo(texto('Alineado.')), textAlign));
    const clases = clasesDeLaEtiqueta(html, 'p');

    expect(clases).toEqual(expect.arrayContaining([...CLASES_PARRAFO.split(' '), ...esperadas]));
    expect(html).toMatch(/<p [^>]*>Alineado\.<\/p>/);
  });

  it.each([
    ['center', ['text-center']],
    ['right', ['text-right']],
    ['justify', ['text-justify', 'hyphens-auto']],
  ])('un título con textAlign %j suma %j y conserva su ancla', (textAlign, esperadas) => {
    const html = renderizarElementos(alineado(titulo(3, texto('Un título alineado')), textAlign));

    expect(clasesDeLaEtiqueta(html, 'h3')).toEqual(expect.arrayContaining(esperadas));
    expect(html).toMatch(/<h3[^>]*\sid="un-titulo-alineado"/);
  });

  it('D31 U16: hyphens-auto acompaña solo al justificado', () => {
    const html = renderizarElementos(alineado(parrafo(texto('Centrado.')), 'center'));

    expect(clasesDeLaEtiqueta(html, 'p')).not.toContain('hyphens-auto');
  });

  it('sin textAlign (la izquierda) el párrafo sale exactamente como hoy', () => {
    expect(renderizarElementos(parrafo(texto('Hola.')))).toBe(P('Hola.'));
  });

  it.each(['left', 'centro', 'center; color: red', '"><script>alert(1)</script>'])(
    'un textAlign %j que no es de la lista no agrega clases ni atributos (RF-003)',
    (textAlign) => {
      const html = renderizarElementos(alineado(parrafo(texto('Hola.')), textAlign));

      expect(html).toBe(P('Hola.'));
    },
  );

  it('la alineación de un párrafo no pasa al siguiente', () => {
    const html = renderizarElementos(alineado(parrafo(texto('Uno.')), 'right'), parrafo(texto('Dos.')));

    expect(html.endsWith(P('Dos.'))).toBe(true);
  });
});

describe('cta y video', () => {
  it('la llamada a la acción usa sus campos', () => {
    const html = renderizarElementos(
      nodo.cta({ titulo: '¿Hablamos?', texto: 'Respondemos en 24 h.', etiquetaBoton: 'Escríbenos', url: '/contacto' }),
    );

    expect(html).toContain('¿Hablamos?');
    expect(html).toContain('Respondemos en 24 h.');
    expect(html).toMatch(/<a href="\/contacto"[^>]*>Escríbenos<\/a>/);
  });

  it('el video usa su título y su proveedor', () => {
    const html = renderizarElementos(nodo.video('vimeo', '76979871', 'Recorrido por el estudio'));

    expect(html).toMatch(/<iframe[^>]*title="Recorrido por el estudio"/);
    expect(html).toContain('Ver en Vimeo');
  });
});
