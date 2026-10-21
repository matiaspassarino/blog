'use client';

// Lo que los campos del editor necesitan del componente que los contiene: anunciar un mensaje en la región
// role="status" (sin recrearla), contar las subidas en curso (bloquean el guardado) y saber si una imagen
// ya está guardada (quitarla pide confirmación).
import { createContext, useContext } from 'react';

export type ContextoDelEditor = {
  anunciar: (mensaje: string) => void;
  subiendo: (delta: 1 | -1) => void;
  imagenGuardada: (ruta: string) => boolean;
};

export const ContextoEditor = createContext<ContextoDelEditor | null>(null);

export function useEditor(): ContextoDelEditor {
  const contexto = useContext(ContextoEditor);
  if (!contexto) throw new Error('useEditor debe usarse dentro de <EditorArticulo>');
  return contexto;
}
