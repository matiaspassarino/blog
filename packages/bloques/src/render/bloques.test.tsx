// T044: salida HTML de cada tipo de bloque (spec 002, RF-002, H1-E1, H1-E3;
// contracts/bloques-render.md, "Salida HTML por tipo"). Render estático, sin DOM.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contenidoDe, imagenDePrueba, ImagenPrueba, renderizar } from './ayudas-prueba';
import type { PropsImagen } from './index';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Posición de cada marca en el HTML; falla si alguna no aparece. */
function posiciones(html: string, marcas: string[]) {
  return marcas.map((marca) => {
    const posicion = html.indexOf(marca);
    expect(posicion, `falta "${marca}" en la salida`).toBeGreaterThanOrEqual(0);
    return posicion;
  });
}

describe('<Bloques>', () => {
  it('H1-E1: un contenido con los 10 tipos sale en el mismo orden del arreglo', () => {
    const contenido = contenidoDe(
      { tipo: 'parrafo', texto: 'Marca del párrafo.' },
      { tipo: 'titulo', nivel: 2, texto: 'Marca del título' },
      { tipo: 'imagen', imagen: imagenDePrueba(1, { alt: 'Marca de la imagen' }), leyenda: 'Leyenda de la imagen' },
      { tipo: 'cita', texto: 'Marca de la cita.', autor: 'Autora de la cita' },
      { tipo: 'lista', ordenada: false, items: ['Marca de la lista'] },
      {
        tipo: 'galeria',
        columnas: 2,
        imagenes: [imagenDePrueba(2, { alt: 'Marca de la galería' }), imagenDePrueba(3)],
      },
      { tipo: 'cta', titulo: 'Marca de la llamada', etiquetaBoton: 'Contactanos', url: '/contacto' },
      { tipo: 'separador' },
      { tipo: 'codigo', lenguaje: 'js', codigo: 'const marcaDelCodigo = 1;' },
      { tipo: 'video', proveedor: 'youtube', idVideo: 'dQw4w9WgXcQ', titulo: 'Marca del video' },
    );

    const html = renderizar(contenido);

    const orden = posiciones(html, [
      'Marca del párrafo.',
      'Marca del título',
      'Marca de la imagen',
      'Marca de la cita.',
      'Marca de la lista',
      'Marca de la galería',
      'Marca de la llamada',
      '<hr',
      'const marcaDelCodigo = 1;',
      'Marca del video',
    ]);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  it('H1-E1: usa el componente Imagen que recibe por props, con sizes', () => {
    const imagenPropia = vi.fn((props: PropsImagen) => <ImagenPrueba {...props} />);
    const imagen = imagenDePrueba(1, { alt: 'Una foto propia' });

    const html = renderizar(contenidoDe({ tipo: 'imagen', imagen }), imagenPropia);

    expect(imagenPropia).toHaveBeenCalledTimes(1);
    const props = imagenPropia.mock.calls[0]?.[0];
    expect(props?.imagen).toEqual(imagen);
    expect(props?.sizes).toEqual(expect.any(String));
    expect(props?.sizes.length).toBeGreaterThan(0);
    expect(html).toContain('alt="Una foto propia"');
  });

  it('H1-E1: la galería también delega cada imagen en el componente Imagen', () => {
    const imagenPropia = vi.fn((props: PropsImagen) => <ImagenPrueba {...props} />);

    renderizar(
      contenidoDe({
        tipo: 'galeria',
        columnas: 3,
        imagenes: [imagenDePrueba(1), imagenDePrueba(2), imagenDePrueba(3)],
      }),
      imagenPropia,
    );

    expect(imagenPropia).toHaveBeenCalledTimes(3);
  });
});

describe('bloque titulo', () => {
  it.each([2, 3, 4] as const)('RF-002: el nivel %i produce un h%i', (nivel) => {
    const html = renderizar(contenidoDe({ tipo: 'titulo', nivel, texto: 'Un subtítulo' }));

    expect(html).toMatch(new RegExp(`<h${nivel}[^>]*>Un subtítulo</h${nivel}>`));
  });

  it('RF-002: lleva como id el slug del texto, para enlazar anclas', () => {
    const html = renderizar(contenidoDe({ tipo: 'titulo', nivel: 2, texto: 'Cómo empezar: el diseño, paso a paso' }));

    expect(html).toMatch(/<h2[^>]*\sid="como-empezar-el-diseno-paso-a-paso"[^>]*>/);
  });
});

describe('bloque parrafo', () => {
  it('RF-002: un doble salto de línea separa dos <p>', () => {
    const html = renderizar(contenidoDe({ tipo: 'parrafo', texto: 'Primer párrafo.\n\nSegundo párrafo.' }));

    expect(html.match(/<p[\s>]/g)).toHaveLength(2);
    expect(html).toMatch(/<p[^>]*>Primer párrafo\.<\/p>\s*<p[^>]*>Segundo párrafo\.<\/p>/);
  });

  it('RF-002: un salto simple se convierte en <br>', () => {
    const html = renderizar(contenidoDe({ tipo: 'parrafo', texto: 'Primera línea.\nSegunda línea.' }));

    expect(html.match(/<p[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<p[^>]*>Primera línea\.<br\s*\/?>Segunda línea\.<\/p>/);
  });
});

describe('bloque lista', () => {
  it('RF-002: una lista ordenada produce <ol> con un <li> por item', () => {
    const html = renderizar(contenidoDe({ tipo: 'lista', ordenada: true, items: ['Uno', 'Dos', 'Tres'] }));

    expect(html).toMatch(/<ol[\s>]/);
    expect(html).not.toContain('<ul');
    expect(html).toMatch(/<li[^>]*>Uno<\/li>\s*<li[^>]*>Dos<\/li>\s*<li[^>]*>Tres<\/li>/);
  });

  it('RF-002: una lista no ordenada produce <ul>', () => {
    const html = renderizar(contenidoDe({ tipo: 'lista', ordenada: false, items: ['Uno', 'Dos'] }));

    expect(html).toMatch(/<ul[\s>]/);
    expect(html).not.toContain('<ol');
    expect(html.match(/<li[\s>]/g)).toHaveLength(2);
  });
});

describe('bloque imagen', () => {
  it('H1-E3: con leyenda produce <figure> con la imagen y un <figcaption>', () => {
    const html = renderizar(
      contenidoDe({
        tipo: 'imagen',
        imagen: imagenDePrueba(1, { alt: 'Boceto de una interfaz' }),
        leyenda: 'Un boceto.',
      }),
    );

    expect(html).toMatch(
      /<figure[\s>].*<img[^>]*alt="Boceto de una interfaz"[^>]*>.*<figcaption[^>]*>Un boceto\.<\/figcaption><\/figure>/s,
    );
    expect(html).toMatch(/<img[^>]*width="1600"[^>]*>/);
    expect(html).toMatch(/<img[^>]*height="900"[^>]*>/);
  });

  it('H1-E3: sin leyenda no produce <figcaption>', () => {
    const html = renderizar(contenidoDe({ tipo: 'imagen', imagen: imagenDePrueba(1) }));

    expect(html).toContain('<img');
    expect(html).not.toContain('<figcaption');
  });

  it('H1-E3: una imagen decorativa sale con alt="" y sin leyenda accesible, aunque tenga leyenda', () => {
    const decorativa = { ruta: 'https://ejemplo.com/decorativa.jpg', ancho: 1600, alto: 900, decorativa: true };

    const html = renderizar(contenidoDe({ tipo: 'imagen', imagen: decorativa, leyenda: 'No se debería anunciar' }));

    expect(html).toMatch(/<img[^>]*alt=""[^>]*>/);
    expect(html).not.toContain('<figcaption');
    expect(html).not.toContain('No se debería anunciar');
  });
});

describe('bloque cita', () => {
  it('RF-002: produce <blockquote cite> y un <figcaption> con el autor y la fuente enlazada', () => {
    const html = renderizar(
      contenidoDe({
        tipo: 'cita',
        texto: 'Menos es más.',
        autor: 'Mies van der Rohe',
        fuente: 'https://ejemplo.com/fuente',
      }),
    );

    expect(html).toMatch(/<figure[\s>]/);
    expect(html).toMatch(
      /<blockquote[^>]*cite="https:\/\/ejemplo\.com\/fuente"[^>]*>.*Menos es más\..*<\/blockquote>/s,
    );
    const pie = html.match(/<figcaption[^>]*>(.*?)<\/figcaption>/s)?.[1] ?? '';
    expect(pie).toContain('Mies van der Rohe');
    expect(pie).toMatch(/<a[^>]*href="https:\/\/ejemplo\.com\/fuente"[^>]*>/);
  });

  it('RF-002: sin fuente no lleva cite ni enlace', () => {
    const html = renderizar(contenidoDe({ tipo: 'cita', texto: 'Menos es más.', autor: 'Anónimo' }));

    expect(html).toContain('<blockquote');
    expect(html).not.toContain('cite=');
    expect(html).not.toContain('<a');
    expect(html).toContain('Anónimo');
  });
});

describe('bloque galeria', () => {
  it('RF-002: produce <ul role="list"> con un <li> por imagen', () => {
    const imagenes = [1, 2, 3, 4].map((n) => imagenDePrueba(n));

    const html = renderizar(contenidoDe({ tipo: 'galeria', columnas: 4, imagenes }));

    expect(html).toMatch(/<ul[^>]*role="list"[^>]*>/);
    expect(html.match(/<li[\s>]/g)).toHaveLength(4);
    expect(html.match(/<img[\s>]/g)).toHaveLength(4);
  });

  it.each([2, 3, 4] as const)('RF-002: con %i columnas usa esa grilla desde 768 px (md:grid-cols-%i)', (columnas) => {
    const html = renderizar(
      contenidoDe({ tipo: 'galeria', columnas, imagenes: [imagenDePrueba(1), imagenDePrueba(2)] }),
    );

    const clases = html.match(/<ul[^>]*class="([^"]*)"/)?.[1] ?? '';
    expect(clases.split(/\s+/)).toContain(`md:grid-cols-${columnas}`);
    expect(clases.split(/\s+/).filter((clase) => clase.startsWith('md:grid-cols-'))).toHaveLength(1);
  });
});

describe('bloque codigo', () => {
  it('RF-002: produce <pre tabindex="0"><code data-lenguaje> y el lenguaje visible en <figcaption>', () => {
    const html = renderizar(contenidoDe({ tipo: 'codigo', lenguaje: 'typescript', codigo: 'const a = 1;' }));

    expect(html).toMatch(/<figure[\s>]/);
    expect(html).toMatch(
      /<pre[^>]*tabindex="0"[^>]*><code[^>]*data-lenguaje="typescript"[^>]*>const a = 1;<\/code><\/pre>/,
    );
    expect(html).toMatch(/<figcaption[^>]*>.*typescript.*<\/figcaption>/is);
  });

  it('RF-002: conserva los saltos de línea y la indentación del código', () => {
    const codigo = 'function hola() {\n  return 1;\n}';

    const html = renderizar(contenidoDe({ tipo: 'codigo', lenguaje: 'js', codigo }));

    expect(html).toContain(codigo);
  });
});

describe('bloque separador', () => {
  it('RF-002: produce un <hr>', () => {
    expect(renderizar(contenidoDe({ tipo: 'separador' }))).toMatch(/<hr[\s/>]/);
  });
});

describe('tipo desconocido', () => {
  it('RF-002: no rompe el render, no produce nada y avisa con console.warn', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const contenido = contenidoDe(
      { tipo: 'parrafo', texto: 'Antes.' },
      { tipo: 'tabla', filas: [['a', 'b']] },
      { tipo: 'parrafo', texto: 'Después.' },
    );

    const html = renderizar(contenido);

    expect(html).toMatch(/<p[^>]*>Antes\.<\/p><p[^>]*>Después\.<\/p>/);
    expect(aviso).toHaveBeenCalled();
    expect(String(aviso.mock.calls[0]?.join(' '))).toContain('tabla');
  });
});
