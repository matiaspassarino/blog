import type { BloqueDe } from '../esquema';
import { CLASES_CODIGO } from './clases';

/** Texto literal, sin resaltado (research D5). tabIndex permite desplazarse con el teclado. */
export function Codigo({ bloque }: { bloque: BloqueDe<'codigo'> }) {
  return (
    <figure className="mt-bloque">
      <pre tabIndex={0} className={CLASES_CODIGO}>
        <code data-lenguaje={bloque.lenguaje}>{bloque.codigo}</code>
      </pre>
      {bloque.lenguaje && <figcaption className="mt-2 text-sm text-texto-suave">{bloque.lenguaje}</figcaption>}
    </figure>
  );
}
