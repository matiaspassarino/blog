'use client';

// Barra de formato en línea de los textos (D9 de la spec 001): solo las cuatro marcas que el sitio
// interpreta, sin HTML ni subrayado. Tras aplicar una marca, el foco y la selección vuelven al textarea.
import { aplicarMarca, type MarcaEnLinea } from '@blog/bloques';
import type { RefObject } from 'react';
import { Button } from '../ui/button';

const MARCAS: { marca: MarcaEnLinea; nombre: string }[] = [
  { marca: 'negrita', nombre: 'Negrita' },
  { marca: 'cursiva', nombre: 'Cursiva' },
  { marca: 'codigo', nombre: 'Código' },
  { marca: 'enlace', nombre: 'Enlace' },
];

type Props = {
  /** El textarea al que aplica las marcas. */
  area: RefObject<HTMLTextAreaElement | null>;
  idArea: string;
  valor: string;
  alCambiar: (valor: string) => void;
};

export function BarraMarcas({ area, idArea, valor, alCambiar }: Props) {
  function aplicar(marca: MarcaEnLinea) {
    const campo = area.current;
    if (!campo) return;
    const { texto, seleccion } = aplicarMarca(valor, { inicio: campo.selectionStart, fin: campo.selectionEnd }, marca);
    alCambiar(texto);
    // El valor se actualiza en el siguiente render: se espera un cuadro para restaurar foco y selección.
    requestAnimationFrame(() => {
      campo.focus();
      campo.setSelectionRange(seleccion.inicio, seleccion.fin);
    });
  }

  return (
    <div role="toolbar" aria-label="Formato del texto" aria-controls={idArea} className="flex flex-wrap gap-2">
      {MARCAS.map(({ marca, nombre }) => (
        <Button key={marca} variante="secundaria" className="px-3" onClick={() => aplicar(marca)}>
          {nombre}
        </Button>
      ))}
    </div>
  );
}
