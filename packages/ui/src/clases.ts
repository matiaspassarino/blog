// Clases de las primitivas compartidas (constitucion.md §VII.3): una sola definición del botón
// para el sitio (Boton.astro), los renderers de bloques (Cta.tsx) y el panel. Solo utilidades de
// Tailwind sobre tokens.

const BOTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-2.5 font-titulos font-semibold transition-colors duration-(--duracion-corta) ease-estandar';

const VARIANTES_BOTON = {
  primaria: 'bg-marca text-marca-contraste hover:bg-marca-hover',
  secundaria: 'border border-borde bg-fondo text-texto hover:bg-superficie',
  // Acciones destructivas del panel (eliminar, desactivar): texto de error sobre su fondo suave (≥ 4,5:1).
  peligro: 'border border-error-borde bg-error-suave text-error hover:bg-fondo',
} as const;

// Versión del panel (spec 004, research D2 y D3): todas con borde de 1 px (así miden lo mismo), alto mínimo
// táctil, estados de puntero y presionado, y aspecto inactivo con `aria-disabled` y `disabled`.
const BOTON_PANEL =
  'inline-flex min-h-(--tactil-min) items-center justify-center gap-2 rounded-md border font-titulos font-semibold text-balance transition-colors duration-(--duracion-corta) ease-estandar aria-disabled:cursor-not-allowed aria-disabled:opacity-60 disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTES_PANEL = {
  primaria:
    'border-transparent bg-marca text-marca-contraste hover:bg-marca-hover active:translate-y-px active:bg-marca-hover',
  secundaria: 'border-borde bg-fondo text-texto hover:bg-superficie active:bg-separador',
  terciaria:
    'border-transparent text-marca hover:bg-marca-suave hover:underline active:bg-marca-suave aria-pressed:bg-marca-suave',
  peligro: 'border-error-borde bg-error-suave text-error hover:bg-fondo active:bg-separador',
} as const;

const TAMANIOS_PANEL = {
  estandar: 'px-5 py-2.5',
  compacto: 'min-w-(--tactil-min) px-3 py-1.5 text-sm',
  soloIcono: 'size-(--tactil-min) min-w-(--tactil-min) p-0',
} as const;

export type VarianteBoton = 'primaria' | 'secundaria' | 'terciaria' | 'peligro';
export type TamanioBoton = 'estandar' | 'compacto';
export type OpcionesBoton = { tamanio: 'compacto'; soloIcono: true } | { tamanio: TamanioBoton; soloIcono?: false };

/**
 * Sin `opciones` devuelve exactamente la versión del sitio (RF-016); la `terciaria` solo existe en el panel.
 * Con `opciones`, la versión del panel con el tamaño pedido.
 */
export function clasesBoton(variante: VarianteBoton = 'primaria', opciones?: OpcionesBoton) {
  if (!opciones) {
    return `${BOTON_BASE} ${VARIANTES_BOTON[variante === 'terciaria' ? 'secundaria' : variante]}`;
  }
  const tamanio = opciones.soloIcono ? TAMANIOS_PANEL.soloIcono : TAMANIOS_PANEL[opciones.tamanio];
  return `${BOTON_PANEL} ${tamanio} ${VARIANTES_PANEL[variante]}`;
}
