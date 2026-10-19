import { Fragment } from 'react';
import type { BloqueDe } from '../esquema';
import { TextoEnLinea } from './TextoEnLinea';

/** Doble salto de línea: otro párrafo. Salto simple: <br>. */
export function Parrafo({ bloque }: { bloque: BloqueDe<'parrafo'> }) {
  return bloque.texto
    .split(/\n{2,}/)
    .filter((parte) => parte.trim() !== '')
    .map((parte, i) => (
      <p key={i} className="mt-bloque text-lg leading-relaxed">
        {parte.split('\n').map((linea, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            <TextoEnLinea texto={linea} />
          </Fragment>
        ))}
      </p>
    ));
}
