// Validación de la 002 (U-M3): los `id` de los títulos son únicos, no chocan con los del layout
// y nunca quedan vacíos.
import { describe, expect, it } from 'vitest';
import { contenidoDe, renderizar } from './ayudas-prueba';

const titulo = (texto: string, nivel = 2) => ({ tipo: 'titulo', nivel, texto });
const ids = (html: string) => [...html.matchAll(/<h[2-4][^>]*\sid="([^"]*)"/g)].map((m) => m[1]);

describe('anclas de los títulos', () => {
  it('dos títulos iguales reciben id distintos (sufijo -2)', () => {
    const html = renderizar(contenidoDe(titulo('Primeros pasos'), titulo('Primeros pasos', 3)));

    expect(ids(html)).toEqual(['primeros-pasos', 'primeros-pasos-2']);
  });

  it('un título "Contenido" no pisa el id="contenido" del <main> del layout', () => {
    const html = renderizar(contenidoDe(titulo('Contenido')));

    expect(ids(html)).toEqual(['contenido-2']);
  });

  it('un título sin letras ni números no emite un id vacío', () => {
    const html = renderizar(contenidoDe(titulo('¿¡…!?')));

    expect(html).toMatch(/<h2[^>]*>¿¡…!\?<\/h2>/);
    expect(html).not.toContain('id=""');
  });
});
