import type { Metadata } from 'next';
import { PaginaTaxonomias } from '../../../componentes/taxonomia/PaginaTaxonomias';

export const metadata: Metadata = { title: 'Categorías' };

export default function PaginaCategorias() {
  return <PaginaTaxonomias tipo="categoria" />;
}
