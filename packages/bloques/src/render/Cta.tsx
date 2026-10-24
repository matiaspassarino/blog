import { clasesBoton } from '@blog/ui/clases';
import type { ElementoDe } from '../esquema';
import { AvisoOtraPestania } from './AvisoOtraPestania';
import { atributosEnlace, esExterno, hrefSeguro } from './enlaces';

/** Llamada a la acción. Un destino no permitido se muestra como texto (RF-003). */
export function Cta({ elemento }: { elemento: ElementoDe<'cta'> }) {
  const campos = elemento.attrs;
  const href = hrefSeguro(campos.url);
  const claseBoton = `mt-5 ${clasesBoton(campos.variante)}`;
  return (
    <aside className="mt-10 rounded-lg bg-marca-suave p-6 sm:p-8">
      <p className="font-titulos text-titulo-3 font-bold text-balance">{campos.titulo}</p>
      {campos.texto && <p className="mt-2 text-lg">{campos.texto}</p>}
      {href ? (
        <a {...atributosEnlace(href)} className={claseBoton}>
          {campos.etiquetaBoton}
          {esExterno(href) && <AvisoOtraPestania />}
        </a>
      ) : (
        <p className="mt-5 font-semibold">{campos.etiquetaBoton}</p>
      )}
    </aside>
  );
}
