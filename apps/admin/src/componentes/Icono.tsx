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
  negrita: 'M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z',
  cursiva: 'M10 5h8M6 19h8M15 5l-6 14',
  codigo: 'M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14',
  enlace: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  lista: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  lista_numerada: 'M10 6h10M10 12h10M10 18h10M4 5l1-1v4M3.5 13.5a1.5 1.5 0 013 0c0 1-3 2-3 3.5h3M3.5 19.5h2.5l-1.5 1.5a1.5 1.5 0 11-1 2',
  deshacer: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  rehacer: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  asa: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  insertar: 'M12 5v14M5 12h14',
  acciones: 'M5 12h.01M12 12h.01M19 12h.01M4 6h16M4 18h16',
  propiedades: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6',
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
