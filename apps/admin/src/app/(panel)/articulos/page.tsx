import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Artículos' };

// Marcador de posición: la lista con filtros llega con la Historia 4 (T078).
export default function PaginaArticulos() {
  return <h1 className="font-titulos text-titulo-2 font-semibold">Artículos</h1>;
}
