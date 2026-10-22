import type { Metadata } from 'next';
import { PaginaTaxonomias } from '../../../componentes/taxonomia/PaginaTaxonomias';

export const metadata: Metadata = { title: 'Etiquetas' };

export default function PaginaEtiquetas() {
  return <PaginaTaxonomias tipo="etiqueta" />;
}
