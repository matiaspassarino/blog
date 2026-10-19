// T045: ningún texto se interpreta como marcado y solo se emiten enlaces seguros
// (spec 002, RF-003, H1-E2, H1-E6, caso borde "esquemas peligrosos";
// contracts/bloques-render.md, "Garantías"). Los bloques se arman a mano, sin el esquema,
// para probar que el renderer se protege aunque una validación anterior fallara.
import { describe, expect, it } from 'vitest';
import { contenidoDe, renderizar } from './ayudas-prueba';

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

const cta = (url: string) => ({
  tipo: 'cta',
  titulo: 'Hablemos',
  texto: 'Contanos tu proyecto.',
  etiquetaBoton: 'Escribinos',
  url,
});

/** La etiqueta `<a>` que contiene el texto del botón. */
function enlaceDelBoton(html: string) {
  return html.match(/<a\s[^>]*>(?:(?!<\/a>).)*Escribinos(?:(?!<\/a>).)*<\/a>/s)?.[0];
}

describe('RF-003: el texto de los bloques sale escapado', () => {
  it.each([
    ['parrafo', { tipo: 'parrafo', texto: `Antes ${SCRIPT} después` }],
    ['titulo', { tipo: 'titulo', nivel: 2, texto: `Título ${SCRIPT}` }],
    ['codigo', { tipo: 'codigo', lenguaje: 'html', codigo: SCRIPT }],
    ['lista', { tipo: 'lista', ordenada: false, items: [SCRIPT] }],
    ['cita', { tipo: 'cita', texto: SCRIPT, autor: SCRIPT }],
  ])('H1-E2: un bloque %s con <script> muestra el texto literal (&lt;script&gt;)', (_tipo, bloque) => {
    const html = renderizar(contenidoDe(bloque));

    expect(html).toContain(SCRIPT_ESCAPADO);
    expect(html).not.toContain('<script');
  });

  it('H1-E2: un párrafo con <img onerror> no produce una etiqueta', () => {
    const html = renderizar(contenidoDe({ tipo: 'parrafo', texto: '<img src=x onerror="alert(1)">' }));

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it.each([
    ['parrafo', { tipo: 'parrafo', texto: 'Plantilla {{x}} y ${y}' }],
    ['codigo', { tipo: 'codigo', lenguaje: 'js', codigo: 'Plantilla {{x}} y ${y}' }],
  ])('H1-E2: un bloque %s con {{x}} se muestra literal, sin interpolar', (_tipo, bloque) => {
    const html = renderizar(contenidoDe(bloque));

    expect(html).toContain('Plantilla {{x}} y ${y}');
  });
});

describe('RF-003: la CTA solo enlaza a destinos seguros', () => {
  it.each(URLS_PELIGROSAS)('caso borde: una CTA con la URL %j se muestra como texto, sin href', (url) => {
    const html = renderizar(contenidoDe(cta(url)));

    expect(html).toContain('Escribinos');
    expect(html).not.toMatch(/href=/);
    expect(html).not.toMatch(/<a[\s>]/);
  });

  it('H1-E6: una CTA interna (/…) enlaza sin target', () => {
    const html = renderizar(contenidoDe(cta('/contacto')));

    const enlace = enlaceDelBoton(html);
    expect(enlace).toMatch(/href="\/contacto"/);
    expect(enlace).not.toMatch(/target=/);
  });

  it('H1-E6: una CTA https:// se abre en otra pestaña de forma segura y lo anuncia', () => {
    const html = renderizar(contenidoDe(cta('https://ejemplo.com/pautas')));

    const enlace = enlaceDelBoton(html);
    expect(enlace).toMatch(/href="https:\/\/ejemplo\.com\/pautas"/);
    expect(enlace).toMatch(/target="_blank"/);
    expect(enlace).toMatch(/rel="noopener noreferrer"/);
    expect(enlace).toContain('se abre en otra pestaña');
  });

  it('RF-003: una CTA http:// se acepta como enlace externo', () => {
    const html = renderizar(contenidoDe(cta('http://ejemplo.com/pagina')));

    const enlace = enlaceDelBoton(html);
    expect(enlace).toMatch(/href="http:\/\/ejemplo\.com\/pagina"/);
    expect(enlace).toMatch(/rel="noopener noreferrer"/);
  });

  it('RF-003: una CTA mailto: se acepta como enlace', () => {
    const html = renderizar(contenidoDe(cta('mailto:hola@ejemplo.com')));

    expect(enlaceDelBoton(html)).toMatch(/href="mailto:hola@ejemplo\.com"/);
  });

  it('RF-003: el texto y el título de la CTA se escapan', () => {
    const html = renderizar(contenidoDe({ ...cta('/contacto'), titulo: SCRIPT, texto: SCRIPT }));

    expect(html).not.toContain('<script');
    expect(html).toContain(SCRIPT_ESCAPADO);
  });
});

describe('RF-003: la fuente de una cita solo se enlaza si es segura', () => {
  it.each(URLS_PELIGROSAS)('caso borde: una cita con la fuente %j no lleva href ni cite', (fuente) => {
    const html = renderizar(contenidoDe({ tipo: 'cita', texto: 'Menos es más.', autor: 'Anónimo', fuente }));

    expect(html).toContain('Menos es más.');
    expect(html).toContain('Anónimo');
    expect(html).not.toMatch(/href=/);
    expect(html).not.toMatch(/cite=/);
  });

  it('RF-003: una cita con fuente https:// sí se enlaza', () => {
    const html = renderizar(
      contenidoDe({ tipo: 'cita', texto: 'Menos es más.', autor: 'Anónimo', fuente: 'https://ejemplo.com/fuente' }),
    );

    expect(html).toMatch(/<a[^>]*href="https:\/\/ejemplo\.com\/fuente"/);
  });
});
