// specs/005-editor-estilo-documento/contracts/documento.md "Tablas"
// research D27, D29 y D31 U15, C13: cuadrícula, regularidad, límites y asociaciones H43.

export const LIMITES_TABLA = {
  MIN_FILAS: 1,
  MAX_FILAS: 50,
  MIN_COLUMNAS: 1,
  MAX_COLUMNAS: 10,
  MAX_CARACTERES_CELDA: 1000,
  MAX_CARACTERES_DESCRIPCION: 150,
} as const;

export type CeldaEstructural = {
  type?: string;
  attrs?: {
    colspan?: number;
    rowspan?: number;
    [key: string]: unknown;
  };
  content?: unknown[];
};

export type FilaEstructural = {
  type?: string;
  content?: CeldaEstructural[];
};

export type TablaEstructural = {
  type?: string;
  attrs?: {
    id?: string;
    descripcion?: string;
    [key: string]: unknown;
  };
  content?: FilaEstructural[];
};

export type CeldaUbicada = {
  celda: CeldaEstructural;
  fila: number;
  columna: number;
  colspan: number;
  rowspan: number;
  encabezadosColumna: string[];
};

export type ResultadoCuadricula = {
  filas: number;
  columnas: number;
  esRegular: boolean;
  dentroDeLimites: boolean;
  tieneEncabezado: boolean;
  encabezadoValido: boolean;
  celdas: CeldaUbicada[][];
};

/**
 * Resuelve la cuadrícula de una tabla con sus dimensiones reales, regularidad,
 * comprobación de límites y asociaciones de encabezados para accesibilidad (técnica H43).
 */
export function cuadricula(tabla: TablaEstructural): ResultadoCuadricula {
  const filasRaw = tabla.content ?? [];
  const R = filasRaw.length;
  if (R === 0) {
    return {
      filas: 0,
      columnas: 0,
      esRegular: false,
      dentroDeLimites: false,
      tieneEncabezado: false,
      encabezadoValido: true,
      celdas: [],
    };
  }

  // Matriz de ocupación dinámica: ocupado[r][c] = boolean
  const ocupado: boolean[][] = [];
  const getOcupado = (r: number, c: number) => ocupado[r]?.[c] ?? false;
  const setOcupado = (r: number, c: number, val: boolean) => {
    if (!ocupado[r]) ocupado[r] = [];
    ocupado[r][c] = val;
  };

  const celdasUbicadasPorFila: CeldaUbicada[][] = Array.from({ length: R }, () => []);
  let esRegular = true;
  let maxColumna = 0;
  let hayTableHeaderEnCuerpo = false;
  let tableHeaderConRowspan = false;

  for (let r = 0; r < R; r++) {
    const fila = filasRaw[r]?.content ?? [];
    let colActual = 0;

    for (let i = 0; i < fila.length; i++) {
      const celda = fila[i];
      if (!celda) continue;
      const tipo = celda.type ?? 'tableCell';
      const colspan = Math.max(1, typeof celda.attrs?.colspan === 'number' ? celda.attrs.colspan : 1);
      const rowspan = Math.max(1, typeof celda.attrs?.rowspan === 'number' ? celda.attrs.rowspan : 1);

      if (r > 0 && tipo === 'tableHeader') {
        hayTableHeaderEnCuerpo = true;
      }
      if (tipo === 'tableHeader' && rowspan > 1) {
        tableHeaderConRowspan = true;
      }

      // Avanza hasta encontrar una columna libre en la fila actual
      while (getOcupado(r, colActual)) {
        colActual++;
      }

      const inicioCol = colActual;
      // Verifica si alguna posición está ya ocupada
      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          if (getOcupado(r + dr, inicioCol + dc)) {
            esRegular = false;
          }
          setOcupado(r + dr, inicioCol + dc, true);
        }
      }

      maxColumna = Math.max(maxColumna, inicioCol + colspan);

      celdasUbicadasPorFila[r]?.push({
        celda,
        fila: r,
        columna: inicioCol,
        colspan,
        rowspan,
        encabezadosColumna: [],
      });

      colActual += colspan;
    }
  }

  const C = maxColumna;

  // Comprueba que no haya huecos en la cuadrícula [0..R-1] x [0..C-1]
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (!getOcupado(r, c)) {
        esRegular = false;
      }
    }
  }

  // Encabezados
  const primeraFila = filasRaw[0]?.content ?? [];
  const tieneEncabezado =
    R > 0 &&
    primeraFila.length > 0 &&
    primeraFila.every((c) => c.type === 'tableHeader');

  const encabezadoValido = !hayTableHeaderEnCuerpo && !tableHeaderConRowspan;

  // Asocia encabezados de columna H43 si la tabla tiene encabezados
  if (tieneEncabezado && R > 0) {
    const mapaEncabezadosColumna = new Map<number, string>();
    const fila0 = celdasUbicadasPorFila[0] ?? [];
    for (const celdaH of fila0) {
      const idCol = `col-${celdaH.columna}`;
      for (let dc = 0; dc < celdaH.colspan; dc++) {
        mapaEncabezadosColumna.set(celdaH.columna + dc, idCol);
      }
    }

    for (let r = 1; r < R; r++) {
      const filaR = celdasUbicadasPorFila[r] ?? [];
      for (const celdaD of filaR) {
        const headersSet = new Set<string>();
        for (let dc = 0; dc < celdaD.colspan; dc++) {
          const h = mapaEncabezadosColumna.get(celdaD.columna + dc);
          if (h) headersSet.add(h);
        }
        celdaD.encabezadosColumna = Array.from(headersSet);
      }
    }
  }

  const dentroDeLimites =
    R >= LIMITES_TABLA.MIN_FILAS &&
    R <= LIMITES_TABLA.MAX_FILAS &&
    C >= LIMITES_TABLA.MIN_COLUMNAS &&
    C <= LIMITES_TABLA.MAX_COLUMNAS;

  return {
    filas: R,
    columnas: C,
    esRegular: esRegular && dentroDeLimites && encabezadoValido,
    dentroDeLimites,
    tieneEncabezado,
    encabezadoValido,
    celdas: celdasUbicadasPorFila,
  };
}

/**
 * Comprueba si un conjunto de celdas seleccionadas forman un rectángulo geométrico
 * contiguo y conexo en la cuadrícula sin salientes ni huecos.
 */
export function esRectangulo(celdas: { fila: number; columna: number }[]): boolean {
  if (celdas.length === 0) return false;
  let minFila = Infinity;
  let maxFila = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  const claves = new Set<string>();

  for (const c of celdas) {
    minFila = Math.min(minFila, c.fila);
    maxFila = Math.max(maxFila, c.fila);
    minCol = Math.min(minCol, c.columna);
    maxCol = Math.max(maxCol, c.columna);
    claves.add(`${c.fila}:${c.columna}`);
  }

  const filas = maxFila - minFila + 1;
  const columnas = maxCol - minCol + 1;
  if (celdas.length !== filas * columnas) return false;

  for (let r = minFila; r <= maxFila; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (!claves.has(`${r}:${c}`)) {
        return false;
      }
    }
  }

  return true;
}
