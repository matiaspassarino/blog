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

/** Fuera de un editor (por ejemplo, en una prueba de render) no hay subidas ni imágenes guardadas. */
const CONTEXTO_VACIO: ContextoDelEditor = { anunciar: () => {}, subiendo: () => {}, imagenGuardada: () => false };

export const ContextoEditor = createContext<ContextoDelEditor>(CONTEXTO_VACIO);

export function useContextoEditor(): ContextoDelEditor {
  return useContext(ContextoEditor);
}
