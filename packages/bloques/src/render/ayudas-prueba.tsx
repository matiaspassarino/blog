// Ayudas compartidas por los tests del renderer (T044–T046, T095). Solo para tests.
import type { Imagen } from '../imagen';
import type { PropsImagen } from './index';

/**
 * Imagen de prueba que se pasa por `componentes.Imagen`. Imita a `ImagenWeb` (T055) en lo
 * mínimo: dimensiones explícitas y `alt` vacío si la imagen es decorativa.
 */
export function ImagenPrueba({ imagen, sizes, prioridad }: PropsImagen) {
  return (
    <img
      src={imagen.ruta}
      alt={imagen.decorativa ? '' : (imagen.alt ?? '')}
      width={imagen.ancho}
      height={imagen.alto}
      sizes={sizes}
      data-prioridad={prioridad ? 'si' : undefined}
    />
  );
}

export function imagenDePrueba(n: number, cambios: Partial<Imagen> = {}): Imagen {
  return {
    ruta: `https://ejemplo.com/foto-${n}.jpg`,
    ancho: 1600,
    alto: 900,
    alt: `Foto ${n}`,
    decorativa: false,
    ...cambios,
  };
}

/** Deshace el escape de atributos de React para leer el `srcdoc` como HTML. */
export function desescapar(valor: string) {
  return valor
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
}
