import { Fragment, type ReactNode } from 'react';
import type { Bloque, Contenido } from '../esquema';
import { anclaDe } from '../utilidades';
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

/** id reservados por el layout del sitio (el <main id="contenido"> del enlace para saltar). */
const IDS_RESERVADOS = ['contenido'];

/** id único por título (sufijo -2, -3…); un título sin letras ni números no lleva id. */
function anclasUnicas(contenido: Contenido): Map<string, string | undefined> {
  const usados = new Set(IDS_RESERVADOS);
  const anclas = new Map<string, string | undefined>();
  for (const bloque of contenido) {
    if (bloque.tipo !== 'titulo') continue;
    const base = anclaDe(bloque.texto);
    if (!base) {
      anclas.set(bloque.id, undefined);
      continue;
    }
    let candidato = base;
    for (let n = 2; usados.has(candidato); n++) candidato = `${base}-${n}`;
    usados.add(candidato);
    anclas.set(bloque.id, candidato);
  }
  return anclas;
}

function renderBloque(
  bloque: Bloque,
  componentes: ComponentesBloques,
  anclas: Map<string, string | undefined>,
): ReactNode {
  switch (bloque.tipo) {
    case 'parrafo':
      return <Parrafo bloque={bloque} />;
    case 'titulo':
      return <Titulo bloque={bloque} ancla={anclas.get(bloque.id)} />;
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
  const anclas = anclasUnicas(contenido);
  return (
    <>
      {contenido.map((bloque) => (
        <Fragment key={bloque.id}>{renderBloque(bloque, componentes, anclas)}</Fragment>
      ))}
    </>
  );
}
