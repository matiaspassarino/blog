// Debe coincidir con privado.tipos_bloque() en la base (invariantes.test.ts en @blog/db).
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
