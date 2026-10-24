// Validación de la 002 (U-M3): los `id` de los títulos son únicos, no chocan con los del layout y nunca quedan
// vacíos. Adaptado al documento en T095 (spec 005, ampliación): `<Documento>` calcula las anclas como hoy, con el
// texto visible del título (sin las marcas).
import { describe, expect, it } from 'vitest';
import { marca, nodo } from '../pruebas/corpus-documento';
import { renderizarElementos } from './ayudas-documento';

const titulo = (texto: string, nivel: 2 | 3 | 4 = 2) => nodo.titulo(nivel, nodo.texto(texto));
const ids = (html: string) => [...html.matchAll(/<h[2-4][^>]*\sid="([^"]*)"/g)].map((m) => m[1]);

describe('anclas de los títulos', () => {
  it('dos títulos iguales reciben id distintos (sufijo -2)', () => {
    const html = renderizarElementos(titulo('Primeros pasos'), titulo('Primeros pasos', 3));

    expect(ids(html)).toEqual(['primeros-pasos', 'primeros-pasos-2']);
  });

  it('un título "Contenido" no pisa el id="contenido" del <main> del layout', () => {
    expect(ids(renderizarElementos(titulo('Contenido')))).toEqual(['contenido-2']);
  });

  it('un título sin letras ni números no emite un id vacío', () => {
    const html = renderizarElementos(titulo('¿¡…!?'));

    expect(html).toMatch(/<h2[^>]*>¿¡…!\?<\/h2>/);
    expect(html).not.toContain('id=""');
  });

  it('el ancla de un título con formato sale de su texto, igual que sin formato', () => {
    const conFormato = nodo.titulo(2, nodo.texto('Primeros '), nodo.texto('pasos', marca.negrita));

    expect(ids(renderizarElementos(conFormato, titulo('Primeros pasos')))).toEqual([
      'primeros-pasos',
      'primeros-pasos-2',
    ]);
  });
});
