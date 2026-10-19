import { Fragment, type ReactNode } from 'react';
import type { Bloque, Contenido } from '../esquema';
import { Cita } from './Cita';
import { Codigo } from './Codigo';
import { Cta } from './Cta';
import { Galeria } from './Galeria';
import { ImagenBloque } from './ImagenBloque';
import { Lista } from './Lista';
import { Parrafo } from './Parrafo';
import { Separador } from './Separador';
import { Titulo } from './Titulo';
import type { ComponentesBloques } from './tipos';
import { Video } from './Video';

function renderBloque(bloque: Bloque, componentes: ComponentesBloques): ReactNode {
  switch (bloque.tipo) {
    case 'parrafo':
      return <Parrafo bloque={bloque} />;
    case 'titulo':
      return <Titulo bloque={bloque} />;
    case 'imagen':
      return <ImagenBloque bloque={bloque} componentes={componentes} />;
    case 'cita':
      return <Cita bloque={bloque} />;
    case 'lista':
      return <Lista bloque={bloque} />;
    case 'galeria':
      return <Galeria bloque={bloque} componentes={componentes} />;
    case 'cta':
      return <Cta bloque={bloque} />;
    case 'separador':
      return <Separador />;
    case 'codigo':
      return <Codigo bloque={bloque} />;
    case 'video':
      return <Video bloque={bloque} />;
    default: {
      // Un tipo desconocido no rompe la página (contrato): no se muestra y se avisa.
      const desconocido: { tipo?: unknown } = bloque;
      console.warn(`Bloque de tipo desconocido, se omite: ${String(desconocido.tipo)}`);
      return null;
    }
  }
}

/** Contenido de un artículo en el orden del arreglo, sin contenedores por bloque. */
export function Bloques({ contenido, componentes }: { contenido: Contenido; componentes: ComponentesBloques }) {
  return (
    <>
      {contenido.map((bloque) => (
        <Fragment key={bloque.id}>{renderBloque(bloque, componentes)}</Fragment>
      ))}
    </>
  );
}
