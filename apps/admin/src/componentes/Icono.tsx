// Íconos del panel como SVG en línea (research D17: sin librería de íconos). Siempre decorativos:
// el significado lo da el texto que los acompaña, nunca el ícono solo (WCAG 1.4.1).
import type { SVGProps } from 'react';

const TRAZADOS = {
  subir: 'M12 19V5M5 12l7-7 7 7',
  bajar: 'M12 5v14M19 12l-7 7-7-7',
  duplicar: 'M9 9h10v10H9zM5 15V5h10',
  quitar: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  menu: 'M4 6h16M4 12h16M4 18h16',
  cerrar: 'M6 6l12 12M18 6L6 18',
  lapiz: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3',
  reloj: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z',
  check: 'M5 12l5 5 9-10',
  archivo: 'M4 7h16v4H4zM6 11v8h12v-8M10 15h4',
  sobre: 'M4 6h16v12H4zM4 7l8 6 8-6',
  prohibido: 'M12 3a9 9 0 100 18 9 9 0 000-18zM6 6l12 12',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
  papelera: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
} as const;

export type NombreIcono = keyof typeof TRAZADOS;

export function Icono({ nombre, ...props }: { nombre: NombreIcono } & Omit<SVGProps<SVGSVGElement>, 'children'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={TRAZADOS[nombre]} />
    </svg>
  );
}
