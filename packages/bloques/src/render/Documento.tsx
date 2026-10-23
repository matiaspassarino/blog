import { Fragment, type ReactNode } from 'react';
import { anclasUnicas } from '../elementos';
import type { Documento as TipoDocumento, Elemento } from '../esquema';
import { Cita } from './Cita';
import { CLASES_PARRAFO } from './clases';
import { Codigo } from './Codigo';
import { Cta } from './Cta';
import { EnLinea } from './EnLinea';
import { Galeria } from './Galeria';
import { ImagenBloque } from './ImagenBloque';
import { Lista } from './Lista';
import { Separador } from './Separador';
import { Titulo } from './Titulo';
import type { ComponentesDocumento } from './tipos';
import { Video } from './Video';

function renderElemento(
  elemento: Elemento,
  componentes: ComponentesDocumento,
  anclas: Map<string, string | undefined>,
): ReactNode {
  switch (elemento.type) {
    case 'paragraph':
      return (
        <p className={CLASES_PARRAFO}>
          <EnLinea contenido={elemento.content} />
        </p>
      );
    case 'heading':
      return <Titulo elemento={elemento} ancla={anclas.get(elemento.attrs.id)} />;
    case 'bulletList':
    case 'orderedList':
      return <Lista elemento={elemento} />;
    case 'blockquote':
      return <Cita elemento={elemento} />;
    case 'codeBlock':
      return <Codigo elemento={elemento} />;
    case 'horizontalRule':
      return <Separador />;
    case 'imagen':
      return <ImagenBloque elemento={elemento} componentes={componentes} />;
    case 'galeria':
      return <Galeria elemento={elemento} componentes={componentes} />;
    case 'cta':
      return <Cta elemento={elemento} />;
    case 'video':
      return <Video elemento={elemento} />;
    default: {
      // Un tipo desconocido no rompe la página (contrato): no se muestra y se avisa.
      const desconocido: { type?: unknown } = elemento;
      console.warn(`Elemento de tipo desconocido, se omite: ${String(desconocido.type)}`);
      return null;
    }
  }
}

/** Contenido de un artículo en el orden del documento, sin contenedores por elemento. */
export function Documento({ contenido, componentes }: { contenido: TipoDocumento; componentes: ComponentesDocumento }) {
  const anclas = anclasUnicas(contenido);
  return (
    <>
      {contenido.content.map((elemento, i) => (
        <Fragment key={elemento.attrs?.id ?? i}>{renderElemento(elemento, componentes, anclas)}</Fragment>
      ))}
    </>
  );
}
