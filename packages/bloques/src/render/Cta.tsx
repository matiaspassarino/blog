import { clasesBoton } from '@blog/ui/clases';
import type { BloqueDe } from '../esquema';
import { AvisoOtraPestania } from './AvisoOtraPestania';
import { atributosEnlace, esExterno, hrefSeguro } from './enlaces';

/** Llamada a la acción. Un destino no permitido se muestra como texto (RF-003). */
export function Cta({ bloque }: { bloque: BloqueDe<'cta'> }) {
  const href = hrefSeguro(bloque.url);
  const claseBoton = `mt-5 ${clasesBoton(bloque.variante)}`;
  return (
    <aside className="mt-10 rounded-lg bg-marca-suave p-6 sm:p-8">
      <p className="font-titulos text-titulo-3 font-bold text-balance">{bloque.titulo}</p>
      {bloque.texto && <p className="mt-2 text-lg">{bloque.texto}</p>}
      {href ? (
        <a {...atributosEnlace(href)} className={claseBoton}>
          {bloque.etiquetaBoton}
          {esExterno(href) && <AvisoOtraPestania />}
        </a>
      ) : (
        <p className="mt-5 font-semibold">{bloque.etiquetaBoton}</p>
      )}
    </aside>
  );
}
