import { Fragment } from 'react';
import type { BloqueDe } from '../esquema';
import { partirParrafos } from '../parrafos';
import { CLASES_PARRAFO } from './clases';
import { TextoEnLinea } from './TextoEnLinea';

/** Doble salto de línea: otro párrafo. Salto simple: <br>. */
export function Parrafo({ bloque }: { bloque: BloqueDe<'parrafo'> }) {
  return partirParrafos(bloque.texto)
    .filter((tramo) => tramo.texto.trim() !== '')
    .map((tramo, i) => (
      <p key={i} className={CLASES_PARRAFO}>
        {tramo.texto.split('\n').map((linea, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            <TextoEnLinea texto={linea} />
          </Fragment>
        ))}
      </p>
    ));
}
