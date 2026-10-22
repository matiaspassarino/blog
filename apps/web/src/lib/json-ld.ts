// Datos estructurados de schema.org (specs/002-sitio-publico/spec.md RSEO-002 y RSEO-003).
// Funciones puras: reciben los datos de dominio y la URL del sitio, y devuelven objetos listos
// para <Seo jsonLd>. Todas las URLs son absolutas.
import { urlImagen, type ArticuloPublico, type AutorPublico } from '@blog/db';

export type SitioJsonLd = { url: string; nombre: string; logo: string; supabaseUrl: string };
type Miga = { nombre: string; ruta: string };

const CONTEXTO = 'https://schema.org';
const absoluta = (ruta: string, urlSitio: string) => new URL(ruta, urlSitio).href;

const organizacionBase = (sitio: SitioJsonLd) => ({
  '@type': 'Organization',
  name: sitio.nombre,
  url: absoluta('/', sitio.url),
});

export function organizacion(sitio: SitioJsonLd) {
  return { '@context': CONTEXTO, ...organizacionBase(sitio), logo: absoluta(sitio.logo, sitio.url) };
}

export function sitioWeb(sitio: SitioJsonLd) {
  return {
    '@context': CONTEXTO,
    '@type': 'WebSite',
    name: sitio.nombre,
    url: absoluta('/', sitio.url),
    inLanguage: 'es',
  };
}

export function blogPosting(articulo: ArticuloPublico, sitio: SitioJsonLd) {
  const url = absoluta(`/blog/${articulo.slug}`, sitio.url);
  const destacada = articulo.imagen_destacada;
  const descripcion = articulo.seo.descripcion ?? articulo.extracto;
  return {
    '@context': CONTEXTO,
    '@type': 'BlogPosting',
    headline: articulo.titulo,
    ...(descripcion ? { description: descripcion } : {}),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image: destacada ? urlImagen(destacada.ruta, sitio.supabaseUrl) : absoluta('/og-generica.png', sitio.url),
    datePublished: articulo.publicado_en,
    dateModified: articulo.actualizado_en,
    author: articulo.autor
      ? {
          '@type': 'Person',
          name: articulo.autor.nombre,
          url: absoluta(`/blog/autor/${articulo.autor.slug}`, sitio.url),
        }
      : organizacionBase(sitio),
    publisher: { ...organizacionBase(sitio), logo: { '@type': 'ImageObject', url: absoluta(sitio.logo, sitio.url) } },
    ...(articulo.categoria ? { articleSection: articulo.categoria.nombre } : {}),
    keywords: articulo.etiquetas.map((etiqueta) => etiqueta.nombre),
    inLanguage: 'es',
  };
}

export function migas(items: Miga[], urlSitio: string) {
  return {
    '@context': CONTEXTO,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((miga, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: miga.nombre,
      item: absoluta(miga.ruta, urlSitio),
    })),
  };
}

export function coleccion(
  { nombre, descripcion, ruta }: { nombre: string; descripcion: string; ruta: string },
  urlSitio: string,
) {
  return {
    '@context': CONTEXTO,
    '@type': 'CollectionPage',
    name: nombre,
    description: descripcion,
    url: absoluta(ruta, urlSitio),
  };
}

export function perfil(autor: AutorPublico, urlSitio: string) {
  const url = absoluta(`/blog/autor/${autor.slug}`, urlSitio);
  return {
    '@context': CONTEXTO,
    '@type': 'ProfilePage',
    url,
    mainEntity: {
      '@type': 'Person',
      name: autor.nombre,
      url,
      ...(autor.biografia ? { description: autor.biografia } : {}),
    },
  };
}
