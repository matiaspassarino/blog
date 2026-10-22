// Información de la publicación (spec 004, aclaración 1): estado, fecha de publicación o de programación y
// "Ver en el sitio". Sin botones: las acciones de estado viven en la barra fija del editor.
import type { EstadoArticulo } from '@blog/db';
import { useId } from 'react';
import { FechaLocal } from '../FechaLocal';
import { TituloSeccion } from '../estructura/TituloSeccion';
import { Badge } from '../ui/badge';

type Props = {
  slug: string;
  estado: EstadoArticulo;
  programadoPara: string | null;
  publicadoEn: string | null;
};

export function InfoPublicacion({ slug, estado, programadoPara, publicadoEn }: Props) {
  const idTitulo = useId();
  const fechaDelEstado = estado === 'programado' ? programadoPara : estado === 'publicado' ? publicadoEn : null;
  const urlSitio = `${process.env.NEXT_PUBLIC_URL_SITIO ?? ''}/blog/${slug}`;

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-3 rounded-md border border-borde p-4">
      <TituloSeccion id={idTitulo}>Publicación</TituloSeccion>
      <p>
        Estado: <Badge estado={estado}>{estado}</Badge>
      </p>
      {fechaDelEstado && (
        <p className="text-texto-suave">
          {estado === 'programado' ? 'Se publica el ' : 'Publicado el '}
          <FechaLocal iso={fechaDelEstado} />
        </p>
      )}
      {estado === 'publicado' && (
        <a href={urlSitio} className="flex min-h-(--tactil-min) items-center underline">
          Ver en el sitio
        </a>
      )}
    </section>
  );
}
