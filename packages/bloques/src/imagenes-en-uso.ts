// Rutas de imagen que usa un artículo (spec 003, research D11): para borrar del almacenamiento las
// que se quitan, salvo que otro contenido las siga usando. Funciones puras.
import type { Contenido } from './esquema';
import type { Imagen } from './imagen';

export type ImagenesDeArticulo = { contenido: Contenido; imagen_destacada: Imagen | null };

/** Rutas de imágenes del contenido (bloques imagen y galerías) y de la destacada, sin repetir y en orden. */
export function rutasDeImagenes({ contenido, imagen_destacada }: ImagenesDeArticulo): string[] {
  const rutas: string[] = [];
  for (const bloque of contenido) {
    if (bloque.tipo === 'imagen') rutas.push(bloque.imagen.ruta);
    else if (bloque.tipo === 'galeria') rutas.push(...bloque.imagenes.map((imagen) => imagen.ruta));
  }
  if (imagen_destacada) rutas.push(imagen_destacada.ruta);
  // Un bloque recién agregado todavía no tiene ruta: no cuenta como imagen.
  return [...new Set(rutas.filter((ruta) => ruta !== ''))];
}

/** Rutas que estaban en `antes` y ya no están en `despues`. */
export function rutasQuitadas(antes: ImagenesDeArticulo, despues: ImagenesDeArticulo): string[] {
  const siguen = new Set(rutasDeImagenes(despues));
  return rutasDeImagenes(antes).filter((ruta) => !siguen.has(ruta));
}
