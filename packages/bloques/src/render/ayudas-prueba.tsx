// Ayudas compartidas por los tests de los renderers (T044–T046). Solo para tests.
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Contenido } from '../esquema';
import type { Imagen } from '../imagen';
import { Bloques, type PropsImagen } from './index';

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

/**
 * Arma un contenido a mano, sin pasar por el esquema: así se prueban también datos que una
 * validación anterior podría haber dejado pasar (RF-003).
 */
export function contenidoDe(...bloques: Record<string, unknown>[]): Contenido {
  return bloques.map((bloque) => ({ id: crypto.randomUUID(), ...bloque })) as unknown as Contenido;
}

/** HTML estático de `<Bloques>` con la imagen de prueba (o la que se pase). */
export function renderizar(contenido: Contenido, Imagen: (p: PropsImagen) => ReactNode = ImagenPrueba) {
  return renderToStaticMarkup(<Bloques contenido={contenido} componentes={{ Imagen }} />);
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
