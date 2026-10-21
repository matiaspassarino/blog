import { listarCategoriasPanel, listarEtiquetasPanel } from '@blog/db';
import type { Metadata } from 'next';
import { DATOS_NUEVO } from '../../../../componentes/editor/datos';
import { EditorArticulo } from '../../../../componentes/editor/EditorArticulo';
import { obtenerMiembro } from '../../../../lib/sesion';
import { crearClienteDeSesion } from '../../../../lib/supabase';

export const metadata: Metadata = { title: 'Nuevo artículo' };

export default async function PaginaNuevoArticulo() {
  const cliente = await crearClienteDeSesion();
  const [categorias, etiquetas] = await Promise.all([listarCategoriasPanel(cliente), listarEtiquetasPanel(cliente)]);

  // El layout del panel ya exigió un miembro activo; aquí solo se lee su rol.
  const { miembro } = await obtenerMiembro();
  if (!miembro) return null;

  return <EditorArticulo nuevo datos={DATOS_NUEVO} rol={miembro.rol} categorias={categorias} etiquetas={etiquetas} />;
}
