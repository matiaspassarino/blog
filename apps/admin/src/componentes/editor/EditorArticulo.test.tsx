// Pruebas unitarias de la reorganización estética de EditorArticulo (spec 006, RF-001 a RF-007, CE-001).
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DATOS_NUEVO } from './datos';
import { EditorArticulo } from './EditorArticulo';
import { ProveedorSalida } from '../salida/ProveedorSalida';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/articulos/nuevo',
}));

const DATOS_PRUEBA = {
  ...DATOS_NUEVO,
  titulo: 'Título de prueba',
  slug: 'titulo-de-prueba',
  extracto: 'Extracto breve del artículo para la prueba.',
};

const PUBLICACION_PRUEBA = {
  estado: 'borrador' as const,
  programado_para: null,
  publicado_en: null,
};

function renderizarEditor(nuevo = true) {
  return renderToStaticMarkup(
    <ProveedorSalida>
      <EditorArticulo
        nuevo={nuevo}
        datos={DATOS_PRUEBA}
        publicacion={PUBLICACION_PRUEBA}
        rol="editor"
        categorias={[{ id: 'cat-1', nombre: 'Diseño', slug: 'diseno' }]}
        etiquetas={[{ id: 'eti-1', nombre: 'CSS', slug: 'css' }]}
      />
    </ProveedorSalida>,
  );
}

describe('EditorArticulo - Estética y lienzo limpio (spec 006)', () => {
  it('RF-001: el título se renderiza como textarea integrado con tipografía destacada', () => {
    const html = renderizarEditor();

    // Contiene el textarea con id="campo-titulo" y placeholder adecuado
    expect(html).toContain('id="campo-titulo"');
    expect(html).toContain('placeholder="Título del artículo..."');
    expect(html).toContain('font-titulos');
    expect(html).toContain('text-2xl');
    expect(html).toContain('sm:text-3xl');
    expect(html).toContain('lg:text-4xl');
  });

  it('RF-006 / CE-001: el slug, extracto e imagen destacada NO están en el lienzo principal antes del editor', () => {
    const html = renderizarEditor();

    const posicionTitulo = html.indexOf('id="campo-titulo"');
    const posicionLienzo = html.indexOf('role="status"'); // esqueleto del cargador de editor
    const posicionSlug = html.indexOf('id="campo-slug"');
    const posicionExtracto = html.indexOf('id="campo-extracto"');
    const posicionDestacada = html.indexOf('id="titulo-imagen-destacada"');

    expect(posicionTitulo).toBeGreaterThan(-1);
    expect(posicionLienzo).toBeGreaterThan(-1);

    // En el DOM, el lienzo se ubica antes que la barra lateral
    expect(posicionTitulo).toBeLessThan(posicionLienzo);

    // El slug, el extracto y la imagen destacada están en la barra lateral (después del lienzo)
    expect(posicionSlug).toBeGreaterThan(posicionLienzo);
    expect(posicionExtracto).toBeGreaterThan(posicionLienzo);
    expect(posicionDestacada).toBeGreaterThan(posicionLienzo);
  });

  it('RF-003 / RF-004 / RF-005: la barra lateral (panel-articulo) contiene Detalles, Imagen destacada, Taxonomías y Buscadores', () => {
    const html = renderizarEditor();

    const posicionPanel = html.indexOf('id="panel-articulo"');
    expect(posicionPanel).toBeGreaterThan(-1);

    const htmlPanel = html.slice(posicionPanel);

    expect(htmlPanel).toContain('id="titulo-detalles"');
    expect(htmlPanel).toContain('id="campo-slug"');
    expect(htmlPanel).toContain('id="campo-extracto"');
    expect(htmlPanel).toContain('id="titulo-imagen-destacada"');
    expect(htmlPanel).toContain('id="campo-imagen_destacada"');
    expect(htmlPanel).toContain('id="titulo-taxonomias"');
    expect(htmlPanel).toContain('id="campo-categoria"');
    expect(htmlPanel).toContain('id="titulo-buscadores"');
    expect(htmlPanel).toContain('id="campo-titulo-seo"');
  });

  it('RF-007: los campos conservan etiquetas accesibles para lectores de pantalla', () => {
    const html = renderizarEditor();

    // Título tiene label sr-only y aria-label
    expect(html).toContain('for="campo-titulo"');
    expect(html).toContain('aria-label="Título"');

    // Slug y extracto tienen sus labels asociados
    expect(html).toContain('for="campo-slug"');
    expect(html).toContain('for="campo-extracto"');
  });

  it('RF-008: los controles interactivos respetan el área táctil mínima (44 px / --tactil-min)', () => {
    const html = renderizarEditor();

    expect(html).toContain('min-h-(--tactil-min)');
  });
});
