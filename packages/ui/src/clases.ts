// Clases de las primitivas compartidas (constitucion.md §VII.3): una sola definición del botón
// para el sitio (Boton.astro) y para los renderers de bloques (Cta.tsx). Solo utilidades de
// Tailwind sobre tokens.

const BOTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-2.5 font-titulos font-semibold transition-colors duration-(--duracion-corta) ease-estandar';

const VARIANTES_BOTON = {
  primaria: 'bg-marca text-marca-contraste hover:bg-marca-hover',
  secundaria: 'border border-borde bg-fondo text-texto hover:bg-superficie',
} as const;

export type VarianteBoton = keyof typeof VARIANTES_BOTON;

export const clasesBoton = (variante: VarianteBoton = 'primaria') => `${BOTON_BASE} ${VARIANTES_BOTON[variante]}`;
