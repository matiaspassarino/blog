import type { BloqueDe } from '../esquema';
import { atributosEnlace, esExterno, hrefSeguro } from './enlaces';

const BOTON = {
  primaria: 'bg-marca text-marca-contraste hover:bg-marca/90',
  secundaria: 'border border-borde bg-fondo text-texto hover:bg-superficie',
} as const;

/** Llamada a la acción. Un destino no permitido se muestra como texto (RF-003). */
export function Cta({ bloque }: { bloque: BloqueDe<'cta'> }) {
  const href = hrefSeguro(bloque.url);
  const clasesBoton = `mt-5 inline-flex min-h-11 items-center rounded-md px-5 py-2.5 font-titulos font-semibold ${BOTON[bloque.variante ?? 'primaria']}`;
  return (
    <aside className="mt-10 rounded-lg bg-marca-suave p-6 sm:p-8">
      <p className="font-titulos text-titulo-3 font-bold text-balance">{bloque.titulo}</p>
      {bloque.texto && <p className="mt-2 text-lg">{bloque.texto}</p>}
      {href ? (
        <a {...atributosEnlace(href)} className={clasesBoton}>
          {bloque.etiquetaBoton}
          {esExterno(href) && <span className="sr-only"> (se abre en otra pestaña)</span>}
        </a>
      ) : (
        <p className="mt-5 font-semibold">{bloque.etiquetaBoton}</p>
      )}
    </aside>
  );
}
