import type { ElementoDe } from '../esquema';
import { CLASES_CODIGO } from './clases';

/** Texto literal, sin resaltado (research D5). tabIndex permite desplazarse con el teclado. */
export function Codigo({ elemento }: { elemento: ElementoDe<'codeBlock'> }) {
  const { lenguaje } = elemento.attrs;
  return (
    <figure className="mt-bloque">
      <pre tabIndex={0} className={CLASES_CODIGO}>
        <code data-lenguaje={lenguaje}>{elemento.content?.[0]?.text ?? ''}</code>
      </pre>
      {lenguaje && <figcaption className="mt-2 text-sm text-texto-suave">{lenguaje}</figcaption>}
    </figure>
  );
}
