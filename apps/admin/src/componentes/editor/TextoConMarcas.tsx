'use client';

// Textarea con la barra de marcas: lo comparten párrafo, cita y los demás textos con formato en línea.
import type { ErrorBloque } from '@blog/bloques';
import { useRef } from 'react';
import { BarraMarcas } from './BarraMarcas';
import { CampoBloque, idDeCampoDeBloque } from './CampoBloque';
import { Textarea } from '../ui/textarea';

type Props = {
  indice: number;
  campo: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  errores: ErrorBloque[];
};

export function TextoConMarcas({ indice, campo, etiqueta, valor, alCambiar, errores }: Props) {
  const area = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <BarraMarcas area={area} idArea={idDeCampoDeBloque(indice, campo)} valor={valor} alCambiar={alCambiar} />
      <CampoBloque indice={indice} campo={campo} etiqueta={etiqueta} errores={errores}>
        {(atributos) => (
          <Textarea {...atributos} ref={area} value={valor} onChange={(e) => alCambiar(e.target.value)} />
        )}
      </CampoBloque>
    </div>
  );
}
