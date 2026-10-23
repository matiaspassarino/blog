// T084 (spec 002): datos estructurados JSON-LD (RSEO-002, RSEO-003; contracts/rutas.md,
// "Metadatos por ruta"). Funciones puras de src/lib/json-ld.ts, sin astro:env: la página
// arma `sitio` con PUBLIC_URL_SITIO, PUBLIC_SUPABASE_URL y el nombre y el logo de la identidad.
//
// Firmas que fija este test:
//   type SitioJsonLd = {
//     url: string;          // PUBLIC_URL_SITIO, absoluta y sin barra final
//     nombre: string;       // landing.sitio.nombre
//     logo: string;         // ruta (/logo.svg) o URL absoluta; la salida siempre es absoluta
//     supabaseUrl: string;  // para las imágenes relativas al bucket `medios` (urlImagen, D7)
//   };
//   blogPosting(articulo: ArticuloPublico, sitio: SitioJsonLd): object
//   migas(items: { nombre: string; ruta: string }[], urlSitio: string): object   // = Miga[]
//   organizacion(sitio: SitioJsonLd): object
//   sitioWeb(sitio: SitioJsonLd): object
//   coleccion(datos: { nombre: string; descripcion: string; ruta: string }, urlSitio: string): object
//   perfil(autor: AutorPublico, urlSitio: string): object   // ProfilePage con mainEntity Person
//
// Todas devuelven un objeto con '@context': 'https://schema.org' y URLs absolutas
// (new URL(ruta, url).href: la portada es `${url}/`).
import type { ArticuloPublico, AutorPublico } from '@blog/db';
import { describe, expect, it } from 'vitest';
import { blogPosting, coleccion, migas, organizacion, perfil, sitioWeb } from './json-ld';

const urlSitio = 'https://estudio.example';
const sitio = {
  url: urlSitio,
  nombre: 'Estudio Demo',
  logo: '/logo.svg',
  supabaseUrl: 'http://127.0.0.1:56321',
};

const autorEva: AutorPublico = {
  id: '00000000-0000-0000-0000-0000000000a1',
  slug: 'eva-editora',
  nombre: 'Eva Editora',
  biografia: 'Diseñadora de identidad visual.',
  avatar: null,
};

function articuloDe(cambios: Partial<ArticuloPublico> = {}): ArticuloPublico {
  return {
    id: '00000000-0000-0000-0000-0000000000b1',
    titulo: 'Guía visual: todos los bloques del blog',
    slug: 'guia-visual-todos-los-bloques-del-blog',
    extracto: 'Un recorrido por los diez tipos de bloque.',
    imagen_destacada: {
      ruta: 'https://picsum.photos/seed/guia/1600/900',
      ancho: 1600,
      alto: 900,
      alt: 'Mesa de trabajo con bocetos',
      decorativa: false,
    },
    contenido: { type: 'doc', content: [] },
    publicado_en: '2026-10-01T12:00:00+00:00',
    actualizado_en: '2026-10-05T09:30:00+00:00',
    categoria: { id: 'c1', nombre: 'Diseño', slug: 'diseno' },
    etiquetas: [{ id: 'e1', nombre: 'UX', slug: 'ux' }],
    autor: autorEva,
    seo: { titulo: 'Guía visual de bloques', descripcion: 'Todos los bloques del blog en una página.' },
    ...cambios,
  };
}

type Dato = Record<string, unknown>;
const comoDato = (valor: unknown) => valor as Dato;
const esAbsoluta = (valor: unknown) => typeof valor === 'string' && /^https?:\/\//.test(valor);

describe('blogPosting (RSEO-002)', () => {
  const dato = comoDato(blogPosting(articuloDe(), sitio));

  it('RSEO-002: es un BlogPosting de schema.org', () => {
    expect(dato['@context']).toBe('https://schema.org');
    expect(dato['@type']).toBe('BlogPosting');
  });

  it('RSEO-002: headline es el título del artículo', () => {
    expect(dato.headline).toBe('Guía visual: todos los bloques del blog');
  });

  it('RSEO-002: url y mainEntityOfPage apuntan a la URL absoluta del artículo', () => {
    const urlArticulo = 'https://estudio.example/blog/guia-visual-todos-los-bloques-del-blog';
    expect(dato.url).toBe(urlArticulo);
    expect(dato.mainEntityOfPage).toEqual({ '@type': 'WebPage', '@id': urlArticulo });
  });

  it('RSEO-002: datePublished y dateModified son las fechas del artículo', () => {
    expect(new Date(String(dato.datePublished)).getTime()).toBe(Date.parse('2026-10-01T12:00:00+00:00'));
    expect(new Date(String(dato.dateModified)).getTime()).toBe(Date.parse('2026-10-05T09:30:00+00:00'));
  });

  it('RSEO-002: image es la URL absoluta de la imagen destacada', () => {
    expect(dato.image).toBe('https://picsum.photos/seed/guia/1600/900');
  });

  it('RSEO-002: una imagen destacada relativa se resuelve contra el bucket medios', () => {
    const conRelativa = comoDato(
      blogPosting(
        articuloDe({
          imagen_destacada: {
            ruta: 'articulos/portada.jpg',
            ancho: 1200,
            alto: 630,
            alt: 'Portada',
            decorativa: false,
          },
        }),
        sitio,
      ),
    );
    expect(conRelativa.image).toBe('http://127.0.0.1:56321/storage/v1/object/public/medios/articulos/portada.jpg');
  });

  it('caso borde: sin imagen destacada, image es la imagen genérica absoluta (/og-generica.png)', () => {
    const sinImagen = comoDato(blogPosting(articuloDe({ imagen_destacada: null }), sitio));
    expect(sinImagen.image).toBe('https://estudio.example/og-generica.png');
  });

  it('RSEO-002: author es una Person con el nombre y la URL absoluta de su página', () => {
    expect(dato.author).toEqual({
      '@type': 'Person',
      name: 'Eva Editora',
      url: 'https://estudio.example/blog/autor/eva-editora',
    });
  });

  it('RSEO-002: sin autor, author es la organización del sitio', () => {
    const sinAutor = comoDato(blogPosting(articuloDe({ autor: null }), sitio));
    const autor = comoDato(sinAutor.author);
    expect(autor['@type']).toBe('Organization');
    expect(autor.name).toBe('Estudio Demo');
  });

  it('RSEO-002: publisher es una Organization con logo ImageObject absoluto', () => {
    const editor = comoDato(dato.publisher);
    expect(editor['@type']).toBe('Organization');
    expect(editor.name).toBe('Estudio Demo');
    expect(editor.logo).toEqual({ '@type': 'ImageObject', url: 'https://estudio.example/logo.svg' });
  });

  it('RSEO-002: description es la descripción SEO y, si falta, el extracto', () => {
    expect(dato.description).toBe('Todos los bloques del blog en una página.');
    const sinSeo = comoDato(
      blogPosting(articuloDe({ seo: { titulo: 'Guía visual de bloques', descripcion: null } }), sitio),
    );
    expect(sinSeo.description).toBe('Un recorrido por los diez tipos de bloque.');
  });

  it('RSEO-002: declara la sección (categoría) y las etiquetas como keywords', () => {
    expect(dato.articleSection).toBe('Diseño');
    expect(dato.keywords).toEqual(['UX']);
  });

  it('RSEO-002: inLanguage es es', () => {
    expect(dato.inLanguage).toBe('es');
  });

  it('el resultado se serializa a JSON sin pérdida (sin undefined ni funciones)', () => {
    expect(JSON.parse(JSON.stringify(dato))).toEqual(dato);
  });
});

describe('migas (RSEO-002, RSEO-003)', () => {
  const items = [
    { nombre: 'Inicio', ruta: '/' },
    { nombre: 'Blog', ruta: '/blog' },
    { nombre: 'Diseño', ruta: '/blog/categoria/diseno' },
    { nombre: 'Guía visual', ruta: '/blog/guia-visual-todos-los-bloques-del-blog' },
  ];
  const dato = comoDato(migas(items, urlSitio));

  it('RSEO-002: es un BreadcrumbList de schema.org', () => {
    expect(dato['@context']).toBe('https://schema.org');
    expect(dato['@type']).toBe('BreadcrumbList');
  });

  it('RSEO-002: un ListItem por miga, en orden, con position desde 1 e item absoluto', () => {
    expect(dato.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://estudio.example/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://estudio.example/blog' },
      { '@type': 'ListItem', position: 3, name: 'Diseño', item: 'https://estudio.example/blog/categoria/diseno' },
      {
        '@type': 'ListItem',
        position: 4,
        name: 'Guía visual',
        item: 'https://estudio.example/blog/guia-visual-todos-los-bloques-del-blog',
      },
    ]);
  });
});

describe('organizacion y sitioWeb: portada (RSEO-003, H5-E4)', () => {
  it('H5-E4: organizacion(sitio) es una Organization con nombre, URL de la portada y logo absoluto', () => {
    const dato = comoDato(organizacion(sitio));
    expect(dato['@context']).toBe('https://schema.org');
    expect(dato['@type']).toBe('Organization');
    expect(dato.name).toBe('Estudio Demo');
    expect(dato.url).toBe('https://estudio.example/');
    expect(dato.logo).toBe('https://estudio.example/logo.svg');
  });

  it('H5-E4: un logo ya absoluto se conserva', () => {
    const dato = comoDato(organizacion({ ...sitio, logo: 'https://cdn.example/logo.png' }));
    expect(dato.logo).toBe('https://cdn.example/logo.png');
  });

  it('H5-E4: sitioWeb(sitio) es un WebSite con nombre, URL de la portada e idioma es', () => {
    const dato = comoDato(sitioWeb(sitio));
    expect(dato['@context']).toBe('https://schema.org');
    expect(dato['@type']).toBe('WebSite');
    expect(dato.name).toBe('Estudio Demo');
    expect(dato.url).toBe('https://estudio.example/');
    expect(dato.inLanguage).toBe('es');
  });
});

describe('coleccion: listados y taxonomías (RSEO-003)', () => {
  it('RSEO-003: es una CollectionPage con nombre, descripción y URL absoluta', () => {
    const dato = comoDato(
      coleccion({ nombre: 'Diseño', descripcion: 'Artículos sobre diseño.', ruta: '/blog/categoria/diseno' }, urlSitio),
    );
    expect(dato['@context']).toBe('https://schema.org');
    expect(dato['@type']).toBe('CollectionPage');
    expect(dato.name).toBe('Diseño');
    expect(dato.description).toBe('Artículos sobre diseño.');
    expect(dato.url).toBe('https://estudio.example/blog/categoria/diseno');
  });

  it('RSEO-004: una página paginada conserva su propia URL', () => {
    const dato = comoDato(
      coleccion({ nombre: 'Blog', descripcion: 'Todos los artículos.', ruta: '/blog/pagina/2' }, urlSitio),
    );
    expect(dato.url).toBe('https://estudio.example/blog/pagina/2');
  });
});

describe('perfil: página de autor (RSEO-003)', () => {
  const dato = comoDato(perfil(autorEva, urlSitio));

  it('RSEO-003: es una ProfilePage con la URL absoluta del autor', () => {
    expect(dato['@context']).toBe('https://schema.org');
    expect(dato['@type']).toBe('ProfilePage');
    expect(dato.url).toBe('https://estudio.example/blog/autor/eva-editora');
  });

  it('RSEO-003: mainEntity es una Person con nombre, URL y biografía', () => {
    const persona = comoDato(dato.mainEntity);
    expect(persona['@type']).toBe('Person');
    expect(persona.name).toBe('Eva Editora');
    expect(persona.url).toBe('https://estudio.example/blog/autor/eva-editora');
    expect(persona.description).toBe('Diseñadora de identidad visual.');
  });

  it('RSEO-003: sin biografía, la Person no declara description', () => {
    const persona = comoDato(comoDato(perfil({ ...autorEva, biografia: null }, urlSitio)).mainEntity);
    expect(persona).not.toHaveProperty('description');
  });

  it('todas las URLs del perfil son absolutas', () => {
    expect(esAbsoluta(dato.url)).toBe(true);
    expect(esAbsoluta(comoDato(dato.mainEntity).url)).toBe(true);
  });
});
