import type { ElementoDe } from '../esquema';
import { cuadricula } from '../tablas';
import { CLASES_PARRAFO } from './clases';
import { EnLinea } from './EnLinea';

type PropsTabla = {
  elemento: ElementoDe<'table'>;
  indice?: number;
};

export function Tabla({ elemento, indice }: PropsTabla) {
  const idTabla = elemento.attrs?.id ?? 'tabla';
  const descripcion = elemento.attrs?.descripcion;
  const idDesc = descripcion ? `tabla-desc-${idTabla}` : undefined;
  const ariaLabel = !descripcion ? `Tabla ${(indice ?? 0) + 1}` : undefined;

  const res = cuadricula(elemento);

  return (
    <div
      role="region"
      tabIndex={0}
      aria-labelledby={idDesc}
      aria-label={ariaLabel}
      className="my-bloque max-w-full overflow-x-auto focus-visible:outline-none focus-visible:ring-(--foco-ancho) focus-visible:ring-foco focus-visible:ring-offset-(--foco-separacion)"
    >
      <table className="w-full border-collapse border border-borde-tabla text-base">
        {descripcion ? (
          <caption id={idDesc} className="mb-2 text-left text-sm text-texto-suave">
            {descripcion}
          </caption>
        ) : null}
        {res.tieneEncabezado && res.celdas.length > 0 ? (
          <thead>
            <tr>
              {(res.celdas[0] ?? []).map((item) => {
                const idCol = `col-${idTabla}-${item.columna}`;
                return (
                  <th
                    key={idCol}
                    scope="col"
                    id={idCol}
                    colSpan={item.colspan > 1 ? item.colspan : undefined}
                    rowSpan={item.rowspan > 1 ? item.rowspan : undefined}
                    className="border border-borde-tabla bg-fondo-encabezado-tabla p-3 text-left font-semibold align-top"
                  >
                    {(item.celda.content ?? []).map((p, pi) => (
                      <p key={pi} className={CLASES_PARRAFO}>
                        <EnLinea contenido={(p as { content?: unknown[] }).content as never} />
                      </p>
                    ))}
                  </th>
                );
              })}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {(res.tieneEncabezado ? res.celdas.slice(1) : res.celdas).map((fila, fi) => (
            <tr key={fi}>
              {fila.map((item, ci) => {
                const esTh = item.celda.type === 'tableHeader';
                const idCol = `col-${idTabla}-${item.columna}`;
                const headers =
                  item.encabezadosColumna.length > 0
                    ? item.encabezadosColumna.map((c) => `col-${idTabla}-${c.replace('col-', '')}`).join(' ')
                    : undefined;

                if (esTh) {
                  return (
                    <th
                      key={ci}
                      scope="col"
                      id={idCol}
                      colSpan={item.colspan > 1 ? item.colspan : undefined}
                      rowSpan={item.rowspan > 1 ? item.rowspan : undefined}
                      className="border border-borde-tabla bg-fondo-encabezado-tabla p-3 text-left font-semibold align-top"
                    >
                      {(item.celda.content ?? []).map((p, pi) => (
                        <p key={pi} className={CLASES_PARRAFO}>
                          <EnLinea contenido={(p as { content?: unknown[] }).content as never} />
                        </p>
                      ))}
                    </th>
                  );
                }

                return (
                  <td
                    key={ci}
                    headers={headers}
                    colSpan={item.colspan > 1 ? item.colspan : undefined}
                    rowSpan={item.rowspan > 1 ? item.rowspan : undefined}
                    className="border border-borde-tabla p-3 align-top"
                  >
                    {(item.celda.content ?? []).map((p, pi) => (
                      <p key={pi} className={CLASES_PARRAFO}>
                        <EnLinea contenido={(p as { content?: unknown[] }).content as never} />
                      </p>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
