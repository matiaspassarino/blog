// Esquema único de bloques (constitucion.md §VI).
// La unión discriminada Zod se define en la spec 001-modelo-de-contenido.
export const TIPOS_BLOQUE = [
  'parrafo',
  'titulo',
  'imagen',
  'cita',
  'lista',
  'galeria',
  'cta',
  'separador',
  'codigo',
  'video',
] as const;

export type TipoBloque = (typeof TIPOS_BLOQUE)[number];
