// Paginación de la lista: enlaces que conservan los filtros. Muestra siempre la primera y la última página y
// las vecinas de la actual; la actual lleva aria-current="page" y todos miden al menos 44 px (§VII.4).
import type { FiltrosPanel } from '@blog/db';
import { clasesBoton } from '@blog/ui/clases';
import Link from 'next/link';
import { aSearchParams } from '../../lib/filtros';
import { cn } from '../../lib/cn';

type Props = { filtros: FiltrosPanel; pagina: number; totalPaginas: number };

/** Números de página a mostrar, con `null` donde hay un salto (se pinta como "…"). */
function numerosVisibles(actual: number, total: number): (number | null)[] {
  const deseadas = new Set([1, total, actual - 1, actual, actual + 1]);
  const orden = [...deseadas].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  return orden.flatMap((n, i) => (i > 0 && n - (orden[i - 1] ?? n) > 1 ? [null, n] : [n]));
}

export function Paginacion({ filtros, pagina, totalPaginas }: Props) {
  if (totalPaginas <= 1) return null;
  const href = (n: number) => {
    const parametros = aSearchParams({ ...filtros, pagina: n }).toString();
    return parametros ? `/articulos?${parametros}` : '/articulos';
  };
  const clases = clasesBoton('secundaria', { tamanio: 'compacto' });

  return (
    <nav aria-label="Paginación">
      <ul className="flex flex-wrap items-center gap-2">
        {numerosVisibles(pagina, totalPaginas).map((n, i) =>
          n === null ? (
            <li key={`salto-${i}`} aria-hidden="true">
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={href(n)}
                aria-label={`Página ${n}`}
                aria-current={n === pagina ? 'page' : undefined}
                className={cn(clases, n === pagina && 'border-marca bg-marca-suave font-semibold text-marca')}
              >
                {n}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}
