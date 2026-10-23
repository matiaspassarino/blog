'use client';

import { datosDeElemento, type Elemento, type ErrorElemento } from '@blog/bloques';
import { EditorCita } from './EditorCita';
import { EditorCodigo } from './EditorCodigo';
import { EditorCta } from './EditorCta';
import { EditorGaleria } from './EditorGaleria';
import { EditorImagen } from './EditorImagen';
import { EditorLista } from './EditorLista';
import { EditorTitulo } from './EditorTitulo';
import type { CambiosDeElemento } from './tipos';
import { EditorVideo } from './EditorVideo';

type Props = {
  elemento: Elemento;
  indice: number;
  errores: ErrorElemento[];
  cambiar: (cambios: CambiosDeElemento) => void;
};

/**
 * Elige el editor de campos según el tipo; cada uno conoce solo los campos de su tipo y los recibe con los nombres
 * del panel (`datosDeElemento`). El texto de los elementos de texto se escribe en el lienzo; el párrafo y el
 * separador no tienen campos.
 */
export function EditorDeBloque({ elemento, indice, errores, cambiar }: Props) {
  // Cada editor recibe `cambiar` acotado a su tipo: el cast es seguro porque el elemento ya es de ese tipo.
  const comun = { indice, errores, cambiar: cambiar as never };
  switch (elemento.type) {
    case 'heading':
      return <EditorTitulo datos={datosDeElemento(elemento)} {...comun} />;
    case 'imagen':
      return <EditorImagen datos={datosDeElemento(elemento)} {...comun} />;
    case 'blockquote':
      return <EditorCita datos={datosDeElemento(elemento)} {...comun} />;
    case 'bulletList':
    case 'orderedList':
      return <EditorLista datos={datosDeElemento(elemento)} {...comun} />;
    case 'galeria':
      return <EditorGaleria datos={datosDeElemento(elemento)} {...comun} />;
    case 'cta':
      return <EditorCta datos={datosDeElemento(elemento)} {...comun} />;
    case 'codeBlock':
      return <EditorCodigo datos={datosDeElemento(elemento)} {...comun} />;
    case 'video':
      return <EditorVideo datos={datosDeElemento(elemento)} {...comun} />;
    default:
      return null;
  }
}
