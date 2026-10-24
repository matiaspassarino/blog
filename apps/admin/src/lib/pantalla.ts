'use client';

// Medidas de la pantalla que cambian la disposición del editor (spec 005, contracts/componentes.md).
import { useEffect, useState, useSyncExternalStore } from 'react';

/** Cierto desde `px` de ancho. En el servidor y en la primera pintura es falso (una sola columna). */
export function useAnchoMinimo(px: number): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia(`(min-width: ${px}px)`);
      consulta.addEventListener('change', avisar);
      return () => consulta.removeEventListener('change', avisar);
    },
    () => window.matchMedia(`(min-width: ${px}px)`).matches,
    () => false,
  );
}

/** Alto en píxeles del primer elemento que cumple `selector` (0 si no existe); se actualiza si cambia de tamaño. */
export function useAltoDe(selector: string): number {
  const [alto, setAlto] = useState(0);
  useEffect(() => {
    const elemento = document.querySelector(selector);
    if (!elemento) return;
    const observador = new ResizeObserver(() => setAlto(elemento.getBoundingClientRect().height));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [selector]);
  return alto;
}
