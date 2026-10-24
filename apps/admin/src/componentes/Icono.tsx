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
  subrayado: 'M7 4v6a5 5 0 0010 0V4M5 20h14',
  tachado:
    'M4 12h16M16 7a4 3 0 00-4-2c-2.2 0-4 1.2-4 3 0 1.5 1 2.4 3 3M8 17a4 3 0 004 2c2.2 0 4-1.2 4-3 0-.8-.3-1.5-.9-2',
  resaltado: 'M9 14l6-9 4 3-6 9zM9 14l-1 4h3l2-1M4 21h16',
  superindice: 'M4 8l8 11M12 8l-8 11M15.5 5.5a1.75 1.75 0 013.5 0c0 1.5-3.5 2-3.5 3.5H19',
  subindice: 'M4 5l8 11M12 5L4 16M15.5 15.5a1.75 1.75 0 013.5 0c0 1.5-3.5 2-3.5 3.5H19',
  alinear_izquierda: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  alinear_centro: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  alinear_derecha: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  alinear_justificado: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  codigo: 'M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14',
  enlace: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  lista: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  lista_numerada:
    'M10 6h10M10 12h10M10 18h10M4 5l1-1v4M3.5 13.5a1.5 1.5 0 013 0c0 1-3 2-3 3.5h3M3.5 19.5h2.5l-1.5 1.5a1.5 1.5 0 11-1 2',
  deshacer: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  rehacer: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  asa: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  insertar: 'M12 5v14M5 12h14',
  acciones: 'M5 12h.01M12 12h.01M19 12h.01M4 6h16M4 18h16',
  propiedades: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6',
  tabla: 'M3 5h18v14H3zM3 10h18M10 5v14M16 5v14',
  fila_arriba: 'M4 14h16M4 18h16M12 2v8M8 6l4-4 4 4',
  fila_abajo: 'M4 6h16M4 10h16M12 14v8M8 18l4 4 4-4',
  columna_izquierda: 'M14 4v16M18 4v16M2 12h8M6 8l-4 4 4 4',
  columna_derecha: 'M6 4v16M10 4v16M14 12h8M18 8l4 4-4 4',
  quitar_fila: 'M4 6h16M4 18h16M6 12h12M15 9l-6 6',
  quitar_columna: 'M6 4v16M18 4v16M12 6v12M9 15l6-6',
  combinar_celdas: 'M4 5h16v14H4zM4 12h16M14 9l-2 3 2 3M10 9l2 3-2 3',
  separar_celdas: 'M4 5h16v14H4zM12 5v14M9 9l-2 3 2 3M15 9l2 3-2 3',
  encabezado_tabla: 'M3 5h18v14H3zM3 10h18M3 10h18v3H3z',
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
