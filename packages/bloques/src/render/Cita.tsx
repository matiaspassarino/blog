import type { BloqueDe } from '../esquema';
import { AvisoOtraPestania } from './AvisoOtraPestania';
import { atributosEnlace, CLASE_ENLACE, esExterno, hrefSeguro } from './enlaces';
import { TextoEnLinea } from './TextoEnLinea';

export function Cita({ bloque }: { bloque: BloqueDe<'cita'> }) {
  const fuente = hrefSeguro(bloque.fuente);
  return (
    <figure className="mt-10 border-l-4 border-marca pl-6">
      <blockquote cite={fuente ?? undefined} className="font-titulos text-titulo-3 leading-snug text-balance">
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
