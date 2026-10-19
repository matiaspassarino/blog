// Identidad visual del cliente (constitucion.md §VII.6): junto con tokens.css, es lo
// único que se edita para adaptar la demo. Las apps leen de acá, nunca escriben
// nombres de fuentes ni rutas de logo propias.

export const identidad = {
  /** Familias de Fontsource. Deben coincidir con las de --font-cuerpo y --font-titulos en tokens.css. */
  fuentes: {
    cuerpo: 'Inter',
    titulos: 'Inter Tight',
  },
} as const;

export type Identidad = typeof identidad;
