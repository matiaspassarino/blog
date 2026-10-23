// T045: ningún texto se interpreta como marcado y solo se emiten enlaces seguros (spec 002, RF-003, H1-E2, H1-E6,
// caso borde "esquemas peligrosos"; contracts/bloques-render.md, "Garantías"). Adaptado al documento en T095
// (spec 005, ampliación; constitución §VI.3: sin dangerouslySetInnerHTML ni HTML del contenido). Los documentos se
// arman a mano, sin el esquema, para probar que el renderer se protege aunque una validación anterior fallara.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { marca, nodo, type NodoPrueba } from '../pruebas/corpus-documento';
import { renderizarElementos } from './ayudas-documento';

const { texto, parrafo, titulo, item, vinetas, cita, codigo } = nodo;

const SCRIPT = '<script>alert(1)</script>';
const SCRIPT_ESCAPADO = '&lt;script&gt;alert(1)&lt;/script&gt;';

const URLS_PELIGROSAS = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  '  javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'vbscript:msgbox(1)',
  '//sitio-ajeno.com/pagina',
];

const cta = (url: string, cambios: Record<string, unknown> = {}): NodoPrueba => {
  const elemento = nodo.cta({ titulo: 'Hablemos', texto: 'Cuéntanos tu proyecto.', etiquetaBoton: 'Escríbenos', url });
  return { ...elemento, attrs: { ...elemento.attrs, ...cambios } };
};

/** La etiqueta `<a>` que contiene el texto del botón. */
function enlaceDelBoton(html: string) {
  return html.match(/<a\s[^>]*>(?:(?!<\/a>).)*Escríbenos(?:(?!<\/a>).)*<\/a>/s)?.[0];
}

describe('RF-003: el texto del documento sale escapado', () => {
  it.each([
    ['paragraph', parrafo(texto(`Antes ${SCRIPT} después`))],
    ['heading', titulo(2, texto(`Título ${SCRIPT}`))],
    ['codeBlock', codigo(SCRIPT, 'html')],
    ['bulletList', vinetas(item(texto(SCRIPT)))],
    ['blockquote', cita({ autor: SCRIPT }, texto(SCRIPT))],
    ['un texto con negrita', parrafo(texto(SCRIPT, marca.negrita))],
    ['un enlace', parrafo(texto(SCRIPT, marca.enlace('/x')))],
  ])('H1-E2: %s con <script> muestra el texto literal (&lt;script&gt;)', (_caso, elemento) => {
    const html = renderizarElementos(elemento);

    expect(html).toContain(SCRIPT_ESCAPADO);
    expect(html).not.toContain('<script');
  });

  it('H1-E2: un párrafo con <img onerror> no produce una etiqueta', () => {
    const html = renderizarElementos(parrafo(texto('<img src=x onerror="alert(1)">')));

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it.each([
    ['paragraph', parrafo(texto('Plantilla {{x}} y ${y}'))],
    ['codeBlock', codigo('Plantilla {{x}} y ${y}', 'js')],
  ])('H1-E2: %s con {{x}} se muestra literal, sin interpolar', (_caso, elemento) => {
    expect(renderizarElementos(elemento)).toContain('Plantilla {{x}} y ${y}');
  });

  it('un nodo html o un texto con type desconocido no producen marcado', () => {
    const html = renderizarElementos(
      { type: 'html', attrs: { id: crypto.randomUUID() }, content: [texto(SCRIPT)] },
      parrafo({ type: 'rawHtml', text: SCRIPT }),
    );

    expect(html).not.toContain('<script');
  });
});

describe('§VI.2: lo que no está en la lista permitida no se dibuja', () => {
  it('una marca desconocida (color, estilo) deja el texto sin atributos de estilo', () => {
    const html = renderizarElementos(
      parrafo(texto('Rojo', { type: 'textStyle', attrs: { color: 'red', style: 'color: red' } })),
    );

    expect(html).toContain('Rojo');
    expect(html).not.toMatch(/style=|color/);
  });

  it('un atributo desconocido de un elemento no llega al HTML', () => {
    const elemento = parrafo(texto('Hola'));
    const html = renderizarElementos({
      ...elemento,
      attrs: { ...elemento.attrs, style: 'color: red', class: 'otra', onclick: 'alert(1)' },
    });

    expect(html).not.toMatch(/style=|onclick|class="otra"/);
  });

  it('los atributos target, rel y class del enlace guardado no se usan: los pone el renderer', () => {
    const html = renderizarElementos(
      parrafo(texto('Interno', { type: 'link', attrs: { href: '/x', target: '_blank', rel: 'opener', class: 'x' } })),
    );

    expect(html).toMatch(/<a href="\/x"/);
    expect(html).not.toMatch(/target=|rel="opener"|class="x"/);
  });

  it('constitución §VI.3: el renderer no usa dangerouslySetInnerHTML', () => {
    for (const archivo of ['./Documento.tsx', './EnLinea.tsx']) {
      const fuente = readFileSync(fileURLToPath(new URL(archivo, import.meta.url)), 'utf8');
      expect(fuente, archivo).not.toContain('dangerouslySetInnerHTML');
    }
  });
});

describe('RF-003: los enlaces del texto solo apuntan a destinos seguros', () => {
  it.each(URLS_PELIGROSAS)('caso borde: un enlace con %j se muestra como texto, sin href', (href) => {
    const html = renderizarElementos(parrafo(texto('Clic acá', marca.enlace(href))));

    expect(html).toContain('Clic acá');
    expect(html).not.toMatch(/href=/);
    expect(html).not.toMatch(/<a[\s>]/);
  });

  it('un enlace mailto: se acepta', () => {
    const html = renderizarElementos(parrafo(texto('Escríbenos', marca.enlace('mailto:hola@ejemplo.com'))));

    expect(html).toMatch(/<a href="mailto:hola@ejemplo\.com"/);
  });
});

describe('RF-003: la llamada a la acción solo enlaza a destinos seguros', () => {
  it.each(URLS_PELIGROSAS)('caso borde: con la URL %j se muestra como texto, sin href', (url) => {
    const html = renderizarElementos(cta(url));

    expect(html).toContain('Escríbenos');
    expect(html).not.toMatch(/href=/);
    expect(html).not.toMatch(/<a[\s>]/);
  });

  it('H1-E6: una interna (/…) enlaza sin target', () => {
    const enlace = enlaceDelBoton(renderizarElementos(cta('/contacto')));

    expect(enlace).toMatch(/href="\/contacto"/);
    expect(enlace).not.toMatch(/target=/);
  });

  it('H1-E6: una https:// se abre en otra pestaña de forma segura y lo anuncia', () => {
    const enlace = enlaceDelBoton(renderizarElementos(cta('https://ejemplo.com/pautas')));

    expect(enlace).toMatch(/href="https:\/\/ejemplo\.com\/pautas"/);
    expect(enlace).toMatch(/target="_blank"/);
    expect(enlace).toMatch(/rel="noopener noreferrer"/);
    expect(enlace).toContain('se abre en otra pestaña');
  });

  it('RF-003: una http:// se acepta como enlace externo y una mailto: como enlace', () => {
    expect(enlaceDelBoton(renderizarElementos(cta('http://ejemplo.com/pagina')))).toMatch(
      /href="http:\/\/ejemplo\.com\/pagina"[^>]*rel="noopener noreferrer"/,
    );
    expect(enlaceDelBoton(renderizarElementos(cta('mailto:hola@ejemplo.com')))).toMatch(
      /href="mailto:hola@ejemplo\.com"/,
    );
  });

  it('RF-003: el texto y el título se escapan', () => {
    const html = renderizarElementos(cta('/contacto', { titulo: SCRIPT, texto: SCRIPT }));

    expect(html).not.toContain('<script');
    expect(html).toContain(SCRIPT_ESCAPADO);
  });
});

describe('RF-003: la fuente de una cita solo se enlaza si es segura', () => {
  it.each(URLS_PELIGROSAS)('caso borde: una cita con la fuente %j no lleva href ni cite', (fuente) => {
    const html = renderizarElementos(cita({ autor: 'Anónimo', fuente }, texto('Menos es más.')));

    expect(html).toContain('Menos es más.');
    expect(html).toContain('Anónimo');
    expect(html).not.toMatch(/href=/);
    expect(html).not.toMatch(/cite=/);
  });

  it('RF-003: una cita con fuente https:// sí se enlaza', () => {
    const html = renderizarElementos(
      cita({ autor: 'Anónimo', fuente: 'https://ejemplo.com/fuente' }, texto('Menos es más.')),
    );

    expect(html).toMatch(/<a[^>]*href="https:\/\/ejemplo\.com\/fuente"/);
  });
});
