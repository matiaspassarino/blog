// Set cerrado de íconos del sitio (specs/002-sitio-publico/research.md D8). El esquema de la
// landing solo acepta estos nombres.
export const NOMBRES_ICONOS = [
  'estrategia',
  'diseno',
  'desarrollo',
  'seo',
  'contenido',
  'soporte',
  'whatsapp',
  'correo',
  'rss',
] as const;

export type NombreIcono = (typeof NOMBRES_ICONOS)[number];
