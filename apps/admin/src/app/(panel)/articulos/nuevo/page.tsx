import { listarCategoriasPanel, listarEtiquetasPanel } from '@blog/db';
import type { Metadata } from 'next';
import { DATOS_NUEVO } from '../../../../componentes/editor/datos';
import { EditorArticulo } from '../../../../componentes/editor/EditorArticulo';
import { crearClienteDeSesion } from '../../../../lib/supabase';

export const metadata: Metadata = { title: 'Nuevo artículo' };

export default async function PaginaNuevoArticulo() {
  const cliente = await crearClienteDeSesion();
  const [categorias, etiquetas] = await Promise.all([listarCategoriasPanel(cliente), listarEtiquetasPanel(cliente)]);

  return <EditorArticulo nuevo datos={DATOS_NUEVO} categorias={categorias} etiquetas={etiquetas} />;
}
