// Identidad visual del cliente (constitucion.md §VII.6): junto con tokens.css, es lo
// único que se edita para adaptar la demo. Las apps leen de acá, nunca escriben
// nombres de fuentes ni rutas de logo propias.

// Logo genérico de la demo. Va como data URI para que web, admin y los tests lo usen
// sin cargadores de assets. Para un cliente, reemplazar el SVG (y ancho/alto).
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 40" width="160" height="40">
<rect x="0" y="4" width="32" height="32" rx="8" fill="#2f5fb3"/>
<path d="M10 28V12h7.5a5 5 0 0 1 0 10H10m7.5 0 5 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<text x="42" y="27" font-family="Inter Tight, system-ui, sans-serif" font-size="18" font-weight="700" fill="#1e2a3b">Estudio Demo</text>
</svg>`;

export const identidad = {
  /** Familias de Fontsource. Deben coincidir con las de --font-cuerpo y --font-titulos en tokens.css. */
  fuentes: {
    cuerpo: 'Inter',
    titulos: 'Inter Tight',
  },
  logo: {
    src: `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`,
    alt: 'Estudio Demo',
    ancho: 160,
    alto: 40,
  },
} as const;

export type Identidad = typeof identidad;
