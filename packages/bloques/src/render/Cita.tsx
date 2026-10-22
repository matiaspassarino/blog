import type { BloqueDe } from '../esquema';
import { AvisoOtraPestania } from './AvisoOtraPestania';
import { CLASES_CITA, CLASES_CITA_TEXTO } from './clases';
import { atributosEnlace, CLASE_ENLACE, esExterno, hrefSeguro } from './enlaces';
import { TextoEnLinea } from './TextoEnLinea';

export function Cita({ bloque }: { bloque: BloqueDe<'cita'> }) {
  const fuente = hrefSeguro(bloque.fuente);
  return (
    <figure className={CLASES_CITA}>
      <blockquote cite={fuente ?? undefined} className={CLASES_CITA_TEXTO}>
        <TextoEnLinea texto={bloque.texto} />
      </blockquote>
      {(bloque.autor || fuente) && (
        <figcaption className="mt-3 text-texto-suave">
          — {bloque.autor}
          {fuente && (
            <>
              {bloque.autor && ', '}
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
