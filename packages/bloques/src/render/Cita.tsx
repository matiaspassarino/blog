import type { ElementoDe } from '../esquema';
import { AvisoOtraPestania } from './AvisoOtraPestania';
import { CLASES_CITA, CLASES_CITA_TEXTO } from './clases';
import { atributosEnlace, CLASE_ENLACE, esExterno, hrefSeguro } from './enlaces';
import { EnLinea } from './EnLinea';

export function Cita({ elemento }: { elemento: ElementoDe<'blockquote'> }) {
  const { autor } = elemento.attrs;
  const fuente = hrefSeguro(elemento.attrs.fuente);
  return (
    <figure className={CLASES_CITA}>
      <blockquote cite={fuente ?? undefined} className={CLASES_CITA_TEXTO}>
        <EnLinea contenido={elemento.content[0].content} />
      </blockquote>
      {(autor || fuente) && (
        <figcaption className="mt-3 text-texto-suave">
          — {autor}
          {fuente && (
            <>
              {autor && ', '}
              <a {...atributosEnlace(fuente)} className={CLASE_ENLACE}>
                ver la fuente
                {esExterno(fuente) && <AvisoOtraPestania />}
              </a>
            </>
          )}
        </figcaption>
      )}
    </figure>
  );
}
