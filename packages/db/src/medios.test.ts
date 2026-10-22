// T013 (spec 003): URL pública de las imágenes y ruta relativa al bucket `medios`.
// `urlImagen` se movió desde apps/web/src/lib/imagenes.ts (mismos casos que imagenes.test.ts, más
// la ruta con "/" inicial); `rutaDeMedio` es nueva (D11). Sin base de datos.
// Firmas supuestas (T026): `urlImagen(ruta, supabaseUrl)` y `rutaDeMedio(url): string | null`,
// exportadas desde './medios'. `rutaDeMedio` recibe solo la URL (el prefijo del bucket es fijo:
// `/storage/v1/object/public/medios/`).
import { describe, expect, it } from 'vitest';
import { rutaDeMedio, urlImagen } from './medios';

const supabaseUrl = 'http://127.0.0.1:56321';

describe('urlImagen', () => {
  it('D7: devuelve igual una ruta absoluta https://…', () => {
    const ruta = 'https://picsum.photos/seed/guia/1600/900';

    expect(urlImagen(ruta, supabaseUrl)).toBe(ruta);
  });

  it('D7: devuelve igual una ruta absoluta http://…', () => {
    expect(urlImagen('http://ejemplo.com/a.jpg', supabaseUrl)).toBe('http://ejemplo.com/a.jpg');
  });

  it('D7: convierte una ruta relativa en la URL pública del bucket medios', () => {
    expect(urlImagen('articulos/portada.jpg', supabaseUrl)).toBe(
      'http://127.0.0.1:56321/storage/v1/object/public/medios/articulos/portada.jpg',
    );
  });

  it('D7: quita la barra inicial de una ruta relativa', () => {
    expect(urlImagen('/articulos/portada.jpg', supabaseUrl)).toBe(
      'http://127.0.0.1:56321/storage/v1/object/public/medios/articulos/portada.jpg',
    );
  });
});

describe('rutaDeMedio', () => {
  it('D11: obtiene la ruta relativa al bucket desde una URL pública de Storage', () => {
    const url = 'http://127.0.0.1:56321/storage/v1/object/public/medios/articulos/2026/10/foto.webp';

    expect(rutaDeMedio(url)).toBe('articulos/2026/10/foto.webp');
  });

  it('D11: es la inversa de urlImagen para rutas relativas', () => {
    const ruta = 'avatares/yo.avif';

    expect(rutaDeMedio(urlImagen(ruta, supabaseUrl))).toBe(ruta);
  });

  it('D11: devuelve null si la URL es de otro bucket', () => {
    expect(rutaDeMedio('http://127.0.0.1:56321/storage/v1/object/public/otro/articulos/foto.webp')).toBeNull();
  });

  it('D11: devuelve null si la URL no es de Storage', () => {
    expect(rutaDeMedio('https://picsum.photos/seed/guia/1600/900')).toBeNull();
  });

  it('D11: devuelve null si la entrada no es una URL', () => {
    expect(rutaDeMedio('articulos/portada.jpg')).toBeNull();
    expect(rutaDeMedio('')).toBeNull();
  });
});
