// T021 (spec 002): URL pública de una imagen (research D7). Imagen.ruta puede ser absoluta
// (picsum en el seed) o relativa al bucket `medios` de Supabase Storage.
import { describe, expect, it } from 'vitest';
import { urlImagen } from './imagenes';

const supabaseUrl = 'http://127.0.0.1:56321';

describe('urlImagen', () => {
  it('D7: devuelve igual una ruta absoluta https://…', () => {
    const ruta = 'https://picsum.photos/seed/guia/1600/900';

    expect(urlImagen(ruta, supabaseUrl)).toBe(ruta);
  });

  it('D7: convierte una ruta relativa en la URL pública del bucket medios', () => {
    expect(urlImagen('articulos/portada.jpg', supabaseUrl)).toBe(
      'http://127.0.0.1:56321/storage/v1/object/public/medios/articulos/portada.jpg',
    );
  });
});
