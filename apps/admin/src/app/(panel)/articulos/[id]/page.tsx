import { listarCategoriasPanel, listarEtiquetasPanel, obtenerArticuloParaEditar } from '@blog/db';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { aDatosArticulo } from '../../../../componentes/editor/datos';
import { EditorArticulo } from '../../../../componentes/editor/EditorArticulo';
import { crearClienteDeSesion } from '../../../../lib/supabase';

export const metadata: Metadata = { title: 'Editar artículo' };

export default async function PaginaEditarArticulo({ params }: PageProps<'/articulos/[id]'>) {
  const { id } = await params;
  // Un id que no es uuid no puede existir: se responde como cualquier otro artículo inexistente.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const cliente = await crearClienteDeSesion();
  const [articulo, categorias, etiquetas] = await Promise.all([
    obtenerArticuloParaEditar(cliente, id),
    listarCategoriasPanel(cliente),
    listarEtiquetasPanel(cliente),
  ]);
  if (!articulo) notFound();

  return (
    <EditorArticulo
      nuevo={false}
      id={articulo.id}
      datos={aDatosArticulo(articulo, articulo.etiquetas)}
      categorias={categorias}
      etiquetas={etiquetas}
    />
  );
}
