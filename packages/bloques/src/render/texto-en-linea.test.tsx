// Markdown inline de los bloques de texto (research D9 de la spec 001; contracts/bloques-render.md
// de la 002). Todo se escapa y solo se interpretan cuatro marcas; nunca se genera HTML crudo.
import { describe, expect, it } from 'vitest';
import { contenidoDe, renderizar } from './ayudas-prueba';

const parrafo = (texto: string) => renderizar(contenidoDe({ tipo: 'parrafo', texto }));

describe('Markdown inline en párrafos, citas y listas', () => {
  it('D9: **negrita** produce <strong>', () => {
    expect(parrafo('La tipografía es la **voz visual** de tu marca.')).toContain(
      'La tipografía es la <strong>voz visual</strong> de tu marca.',
    );
  });

  it('D9: _cursiva_ produce <em>', () => {
    expect(parrafo('Un texto _importante_ acá.')).toContain('Un texto <em>importante</em> acá.');
  });

  it('D9: `código` produce <code> y su contenido no se interpreta', () => {
    expect(parrafo('Usá `**no es negrita**` así.')).toContain('Usá <code>**no es negrita**</code> así.');
  });

  it('D9: [texto](url) produce un enlace interno sin target', () => {
    const html = parrafo('Mirá [el blog](/blog) primero.');

    expect(html).toContain('<a href="/blog">el blog</a>');
    expect(html).not.toContain('target=');
  });

  it('D9: un enlace externo lleva rel="noopener noreferrer"', () => {
    expect(parrafo('Leé [la guía](https://www.w3.org/WAI/).')).toMatch(
      /<a href="https:\/\/www\.w3\.org\/WAI\/"[^>]*rel="noopener noreferrer"[^>]*>la guía/,
    );
  });

  it('RF-003: un enlace con esquema peligroso queda como texto, sin href', () => {
    const html = parrafo('No [hagas clic](javascript:alert(1)) acá.');

    expect(html).not.toContain('href=');
    expect(html).toContain('hagas clic');
  });

  it('RF-003: el HTML dentro de las marcas se escapa', () => {
    const html = parrafo('**<script>alert(1)</script>**');

    expect(html).toContain('<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>');
  });

  it('una marca sin cerrar se muestra literal', () => {
    expect(parrafo('Precio: 2 ** 3 y snake_case_largo.')).toContain('Precio: 2 ** 3 y snake_case_largo.');
  });

  it('D9: las citas y los ítems de lista también interpretan las marcas', () => {
    const html = renderizar(
      contenidoDe(
        { tipo: 'cita', texto: 'Menos es **más**.' },
        { tipo: 'lista', ordenada: false, items: ['Un ítem con _énfasis_.'] },
      ),
    );

    expect(html).toContain('Menos es <strong>más</strong>.');
    expect(html).toContain('Un ítem con <em>énfasis</em>.');
  });
});
