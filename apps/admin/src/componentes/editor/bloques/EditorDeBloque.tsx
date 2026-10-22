'use client';

import type { Bloque, ErrorBloque } from '@blog/bloques';
import type { CambiosDeBloque } from '../reductor';
import { EditorCita } from './EditorCita';
import { EditorCodigo } from './EditorCodigo';
import { EditorCta } from './EditorCta';
import { EditorGaleria } from './EditorGaleria';
import { EditorImagen } from './EditorImagen';
import { EditorLista } from './EditorLista';
import { EditorParrafo } from './EditorParrafo';
import { EditorSeparador } from './EditorSeparador';
import { EditorTitulo } from './EditorTitulo';
import { EditorVideo } from './EditorVideo';

type Props = {
  bloque: Bloque;
  indice: number;
  errores: ErrorBloque[];
  cambiar: (cambios: CambiosDeBloque) => void;
};

/** Elige el editor según el tipo; cada uno conoce solo los campos de su tipo. */
export function EditorDeBloque({ bloque, indice, errores, cambiar }: Props) {
  // Cada editor recibe `cambiar` acotado a su tipo: el cast es seguro porque el bloque ya es de ese tipo.
  const comun = { indice, errores, cambiar: cambiar as never };
  switch (bloque.tipo) {
    case 'parrafo':
      return <EditorParrafo bloque={bloque} {...comun} />;
    case 'titulo':
      return <EditorTitulo bloque={bloque} {...comun} />;
    case 'imagen':
      return <EditorImagen bloque={bloque} {...comun} />;
    case 'cita':
      return <EditorCita bloque={bloque} {...comun} />;
    case 'lista':
      return <EditorLista bloque={bloque} {...comun} />;
    case 'galeria':
      return <EditorGaleria bloque={bloque} {...comun} />;
    case 'cta':
      return <EditorCta bloque={bloque} {...comun} />;
    case 'separador':
      return <EditorSeparador />;
    case 'codigo':
      return <EditorCodigo bloque={bloque} {...comun} />;
    case 'video':
      return <EditorVideo bloque={bloque} {...comun} />;
  }
}
