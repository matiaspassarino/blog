// T016 (spec 003): rutas de imagen usadas por un artículo (D11, RF-007). Adaptado al documento en T094 (spec 005,
// ampliación; contracts/documento.md): las rutas están en `imagen.attrs.imagen.ruta` y
// `galeria.attrs.imagenes[*].ruta`.
// Firmas (T103), exportadas desde './imagenes-en-uso':
//   rutasDeImagenes({ contenido, imagen_destacada }): string[]   (contenido: Documento; sin repetir; en orden)
//   rutasQuitadas(antes, despues): string[]                      (las que estaban en `antes` y ya no)
// `antes` y `despues` son los mismos objetos `{ contenido, imagen_destacada }`.
import { describe, expect, it } from 'vitest';
import { crearElemento } from './elementos';
import type { Documento } from './esquema';
import type { Imagen } from './imagen';
import { rutasDeImagenes, rutasQuitadas } from './imagenes-en-uso';
import { marca, nodo, type NodoPrueba } from './pruebas/corpus-documento';

const imagen = (ruta: string): Imagen => ({ ruta, ancho: 800, alto: 600, alt: 'Texto alternativo', decorativa: false });

const bloqueImagen = (ruta: string) => nodo.imagen(imagen(ruta));
const bloqueGaleria = (...rutas: string[]) => nodo.galeria(3, ...rutas.map(imagen));

type Entrada = { contenido: Documento; imagen_destacada: Imagen | null };
const articulo = (elementos: NodoPrueba[], destacada: string | null = null): Entrada => ({
  contenido: nodo.doc(...elementos) as unknown as Documento,
  imagen_destacada: destacada ? imagen(destacada) : null,
});

describe('rutasDeImagenes', () => {
  it('D11: devuelve la ruta de un elemento imagen', () => {
    expect(rutasDeImagenes(articulo([bloqueImagen('articulos/a.webp')]))).toEqual(['articulos/a.webp']);
  });

  it('D11: devuelve las rutas de todas las imágenes de una galería', () => {
    const entrada = articulo([bloqueGaleria('articulos/g1.webp', 'articulos/g2.webp', 'articulos/g3.webp')]);

    expect(rutasDeImagenes(entrada)).toEqual(['articulos/g1.webp', 'articulos/g2.webp', 'articulos/g3.webp']);
  });

  it('D11: incluye la imagen destacada', () => {
    expect(rutasDeImagenes(articulo([], 'articulos/portada.webp'))).toEqual(['articulos/portada.webp']);
  });

  it('D11: junta elementos imagen, galerías y la destacada, en el orden del documento', () => {
    const entrada = articulo(
      [bloqueGaleria('articulos/g1.webp', 'articulos/g2.webp'), bloqueImagen('articulos/a.webp')],
      'articulos/portada.webp',
    );

    expect(rutasDeImagenes(entrada)).toEqual([
      'articulos/g1.webp',
      'articulos/g2.webp',
      'articulos/a.webp',
      'articulos/portada.webp',
    ]);
  });

  it('D11: no repite una ruta que aparece varias veces', () => {
    const entrada = articulo(
      [
        bloqueImagen('articulos/a.webp'),
        bloqueImagen('articulos/a.webp'),
        bloqueGaleria('articulos/a.webp', 'articulos/b.webp'),
      ],
      'articulos/a.webp',
    );

    expect([...rutasDeImagenes(entrada)].sort()).toEqual(['articulos/a.webp', 'articulos/b.webp']);
  });

  it('D11: ignora los elementos que no tienen imagen', () => {
    const entrada = articulo([
      nodo.parrafo(nodo.texto('Un párrafo')),
      nodo.titulo(2, nodo.texto('Un título')),
      nodo.separador(),
      nodo.cta({ titulo: 'Hola', etiquetaBoton: 'Ir', url: '/blog' }),
      nodo.video('youtube', 'dQw4w9WgXcQ', 'Un video'),
    ]);

    expect(rutasDeImagenes(entrada)).toEqual([]);
  });

  it('no confunde con una imagen un texto, un enlace o un código que parecen una ruta', () => {
    const entrada = articulo([
      nodo.parrafo(
        nodo.texto('articulos/a.webp'),
        nodo.texto(' y '),
        nodo.texto('la foto', marca.enlace('/articulos/b.webp')),
      ),
      nodo.codigo('articulos/c.webp'),
    ]);

    expect(rutasDeImagenes(entrada)).toEqual([]);
  });

  it('D11: una imagen destacada nula no aporta ninguna ruta', () => {
    expect(rutasDeImagenes(articulo([bloqueImagen('articulos/a.webp')], null))).toEqual(['articulos/a.webp']);
  });

  it('D11: ignora un elemento imagen que todavía no tiene ruta (recién agregado)', () => {
    expect(rutasDeImagenes(articulo([crearElemento('imagen') as unknown as NodoPrueba]))).toEqual([]);
  });

  it('D11: un artículo con el documento vacío y sin destacada no usa imágenes', () => {
    expect(rutasDeImagenes(articulo([]))).toEqual([]);
  });
});

describe('rutasQuitadas', () => {
  it('D11: devuelve las rutas que estaban y ya no están', () => {
    const antes = articulo(
      [bloqueImagen('articulos/a.webp'), bloqueImagen('articulos/b.webp')],
      'articulos/portada.webp',
    );
    const despues = articulo([bloqueImagen('articulos/a.webp')], 'articulos/portada.webp');

    expect(rutasQuitadas(antes, despues)).toEqual(['articulos/b.webp']);
  });

  it('D11: cambiar la imagen destacada quita la anterior', () => {
    const antes = articulo([], 'articulos/vieja.webp');
    const despues = articulo([], 'articulos/nueva.webp');

    expect(rutasQuitadas(antes, despues)).toEqual(['articulos/vieja.webp']);
  });

  it('D11: no incluye las rutas que siguen en uso en otro lugar', () => {
    const antes = articulo([bloqueImagen('articulos/a.webp')], null);
    const despues = articulo([], 'articulos/a.webp');

    expect(rutasQuitadas(antes, despues)).toEqual([]);
  });

  it('D11: una imagen que pasa de un elemento imagen a una galería sigue en uso', () => {
    const antes = articulo([bloqueImagen('articulos/a.webp')]);
    const despues = articulo([bloqueGaleria('articulos/a.webp', 'articulos/b.webp')]);

    expect(rutasQuitadas(antes, despues)).toEqual([]);
  });

  it('D11: no incluye las rutas nuevas', () => {
    const antes = articulo([bloqueImagen('articulos/a.webp')]);
    const despues = articulo([bloqueImagen('articulos/a.webp'), bloqueImagen('articulos/nueva.webp')]);

    expect(rutasQuitadas(antes, despues)).toEqual([]);
  });

  it('D11: quitar todo el contenido devuelve todas las rutas sin repetir', () => {
    const antes = articulo(
      [bloqueImagen('articulos/a.webp'), bloqueGaleria('articulos/a.webp', 'articulos/b.webp')],
      'articulos/p.webp',
    );
    const despues = articulo([]);

    expect([...rutasQuitadas(antes, despues)].sort()).toEqual([
      'articulos/a.webp',
      'articulos/b.webp',
      'articulos/p.webp',
    ]);
  });

  it('D11: sin cambios en las imágenes devuelve una lista vacía', () => {
    const entrada = articulo([bloqueImagen('articulos/a.webp')], 'articulos/p.webp');

    expect(rutasQuitadas(entrada, entrada)).toEqual([]);
  });
});
