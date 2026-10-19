// T069 (spec 002, H3): sección "Últimos artículos" de la portada (RF-012, RF-014).
// Se renderiza con el Container API de Astro, sin servidor ni base.
// Los artículos de prueba llevan imagen_destacada null: así TarjetaArticulo usa la imagen
// genérica local y el test no depende del servicio de imágenes de astro:assets con URLs
// remotas (picsum o Supabase Storage).
import type { ResumenArticulo } from '@blog/db';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import { landing } from '../../contenido/landing';
import UltimosArticulos from './UltimosArticulos.astro';

function crearArticulo(numero: number): ResumenArticulo {
  return {
    id: `00000000-0000-4000-8000-00000000000${numero}`,
    titulo: `Artículo de prueba ${numero}`,
    slug: `articulo-de-prueba-${numero}`,
    extracto: `Extracto del artículo de prueba ${numero}.`,
    imagen_destacada: null,
    publicado_en: `2026-10-0${numero}T12:00:00.000Z`,
    categoria: { id: `cat-${numero}`, nombre: 'Diseño', slug: 'diseno' },
  };
}

const tresArticulos = [crearArticulo(3), crearArticulo(2), crearArticulo(1)];

let contenedor: AstroContainer;

beforeAll(async () => {
  contenedor = await AstroContainer.create();
});

function contar(html: string, patron: RegExp) {
  return html.match(patron)?.length ?? 0;
}

describe('UltimosArticulos', () => {
  it('H3-E3 / RF-014: con una lista vacía no renderiza nada', async () => {
    const html = await contenedor.renderToString(UltimosArticulos, { props: { articulos: [] } });

    expect(html).not.toMatch(/<section\b/);
    expect(html).not.toMatch(/<article\b/);
    expect(html.trim()).toBe('');
  });

  it('H3-E2 / RF-012: con 3 artículos renderiza 3 tarjetas, una por artículo y en el mismo orden', async () => {
    const html = await contenedor.renderToString(UltimosArticulos, { props: { articulos: tresArticulos } });

    expect(contar(html, /<article\b/g)).toBe(3);
    const enlaces = [...html.matchAll(/href="(\/blog\/articulo-de-prueba-\d)"/g)].map(
      (coincidencia) => coincidencia[1],
    );
    expect(enlaces).toEqual(['/blog/articulo-de-prueba-3', '/blog/articulo-de-prueba-2', '/blog/articulo-de-prueba-1']);
  });

  it('RSEO-008: las tarjetas usan h3 bajo el h2 de la sección', async () => {
    const html = await contenedor.renderToString(UltimosArticulos, { props: { articulos: tresArticulos } });

    expect(contar(html, /<h2\b/g)).toBe(1);
    expect(html).toContain(landing.blog.titulo);
    expect(contar(html, /<h3\b/g)).toBe(3);
  });
});
