import { Documento } from '@blog/bloques/render';
import { obtenerArticuloParaEditar } from '@blog/db';
import type { Documento as TipoDocumento, Imagen } from '@blog/bloques';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ImagenAdmin } from '../../../../../componentes/ImagenAdmin';
import { crearClienteDeSesion } from '../../../../../lib/supabase';
import { AvisoEstado } from '../../../../../componentes/AvisoEstado';

// Sin `canonical` y fuera de /blog: no se confunde con la página pública (RSEO-002). El panel entero es noindex.
export const metadata: Metadata = { title: 'Vista previa' };

const ESTADOS = { borrador: 'borrador', programado: 'programado', publicado: 'publicado', archivado: 'archivado' };

export default async function PaginaVistaPrevia({ params }: PageProps<'/articulos/[id]/vista-previa'>) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const articulo = await obtenerArticuloParaEditar(await crearClienteDeSesion(), id);
  if (!articulo) notFound();
  const destacada = articulo.imagen_destacada as Imagen | null;

  return (
    <div className="flex flex-col gap-6">
      <AvisoEstado
        tipo="advertencia"
        titulo={articulo.estado === 'publicado' ? 'Vista previa de la versión guardada' : 'Vista previa, no publicada'}
      >
        Vista previa: así se verá en el sitio. Estado del artículo: {ESTADOS[articulo.estado]}.
      </AvisoEstado>
      <article className="mx-auto w-full max-w-(--container-lectura)">
        <h1 className="font-titulos text-titulo-1 font-semibold">{articulo.titulo}</h1>
        {articulo.extracto && <p className="mt-4 text-lg text-texto-suave">{articulo.extracto}</p>}
        {destacada && destacada.ruta !== '' && (
          <div className="mt-6">
            <ImagenAdmin imagen={destacada} sizes="(min-width: 768px) 68ch, 100vw" />
          </div>
        )}
        <div className="mt-6">
          <Documento contenido={articulo.contenido as TipoDocumento} componentes={{ Imagen: ImagenAdmin }} />
        </div>
      </article>
    </div>
  );
}
