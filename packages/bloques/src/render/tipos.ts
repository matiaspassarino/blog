// API de composición de los renderers (specs/002-sitio-publico/contracts/bloques-render.md).
import type { ReactNode } from 'react';
import type { Imagen } from '../imagen';

/** Cada app decide cómo optimiza sus imágenes (web: ImagenWeb con astro:assets). */
export type PropsImagen = { imagen: Imagen; sizes: string; prioridad?: boolean };
export type ComponentesDocumento = { Imagen: (props: PropsImagen) => ReactNode };
