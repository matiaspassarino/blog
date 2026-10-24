// Manejo de pegado en el editor (spec 005, Fase 14, Historia 4; RF-015, RF-028; research D28).
// Divide párrafos que superan el límite de caracteres sin cortar palabras, limpia ids y valida tablas pegadas.
import { cuadricula, LIMITES_TABLA, type TablaEstructural } from '@blog/bloques';

const MAXIMO_CARACTERES_PARRAFO = 5000;

const LIMITES_TIPO: Record<string, number> = {
  paragraph: MAXIMO_CARACTERES_PARRAFO,
  heading: 150,
  blockquote: 1000,
  listItem: 500,
  codeBlock: 20000,
  tableCell: 1000,
  tableHeader: 1000,
};

/**
 * Divide un texto largo en trozos de hasta `maximo` caracteres:
 * busca cortar prioritariamente en un fin de oración (". ") o en un fin de palabra (espacio),
 * nunca en medio de una palabra.
 */
export function partirTexto(texto: string, maximo = MAXIMO_CARACTERES_PARRAFO): string[] {
  if (texto.length <= maximo) {
    return [texto];
  }

  const partes: string[] = [];
  let restante = texto;

  while (restante.length > maximo) {
    const ventana = restante.slice(0, maximo + 1);

    // 1. Busca el último fin de oración dentro de la ventana (al menos a partir del 40% del largo)
    let corte = -1;
    const finOracion = ventana.lastIndexOf('. ');
    if (finOracion > maximo * 0.4) {
      corte = finOracion + 1; // incluye el punto
    }

    // 2. Si no hay fin de oración adecuado, busca el último espacio en blanco
    if (corte === -1) {
      const finPalabra = ventana.lastIndexOf(' ');
      if (finPalabra > 0) {
        corte = finPalabra;
      }
    }

    // 3. Caso extremo sin espacios ni puntos: corta en el máximo
    if (corte <= 0) {
      corte = maximo;
    }

    const fragmento = restante.slice(0, corte).trim();
    if (fragmento.length > 0) {
      partes.push(fragmento);
    }
    restante = restante.slice(corte).trim();
  }

  if (restante.length > 0) {
    partes.push(restante);
  }

  return partes;
}

export type ResultadoRestriccion = {
  texto: string;
  sobranteEnParrafos: boolean;
  parrafos?: string[];
};

/**
 * Aplica el límite correspondiente según el tipo del elemento donde se pega:
 * en párrafos el sobrante puede pasar a párrafos nuevos; en los demás tipos solo se recorta sin crear otros elementos.
 */
export function restringirTextoPorTipo(tipo: string, texto: string): ResultadoRestriccion {
  const limite = LIMITES_TIPO[tipo] ?? MAXIMO_CARACTERES_PARRAFO;

  if (tipo === 'paragraph') {
    if (texto.length > limite) {
      const parrafos = partirTexto(texto, limite);
      return {
        texto: parrafos[0] ?? '',
        sobranteEnParrafos: true,
        parrafos,
      };
    }
    return { texto, sobranteEnParrafos: false };
  }

  // Título, cita, ítem, celda, código: se recortan a su límite sin generar párrafos
  return {
    texto: texto.slice(0, limite),
    sobranteEnParrafos: false,
  };
}

/**
 * Elimina recursivamente el atributo `id` de los nodos para que al pegarse no se dupliquen identificadores únicos.
 */
export function limpiarIdsDeNodos<T extends Record<string, unknown>>(nodo: T): T {
  const copia = { ...nodo } as Record<string, unknown>;

  if (copia.attrs && typeof copia.attrs === 'object') {
    const { id: _id, ...restoAttrs } = copia.attrs as Record<string, unknown>;
    copia.attrs = restoAttrs;
  }

  if (Array.isArray(copia.content)) {
    copia.content = (copia.content as Record<string, unknown>[]).map((hijo) => limpiarIdsDeNodos(hijo));
  }

  return copia as T;
}

export type ResultadoProcesamientoTabla = {
  tabla?: Record<string, unknown>;
  esTexto: boolean;
  parrafos?: string[];
  anuncio: string;
  celdasSeparadas?: boolean;
  avisoSeparadas?: string;
};

function extraerTextosDeTabla(tabla: Record<string, unknown>): string[] {
  const textos: string[] = [];
  const filas = (tabla.content as Record<string, unknown>[] | undefined) ?? [];
  for (const fila of filas) {
    const celdas = (fila.content as Record<string, unknown>[] | undefined) ?? [];
    for (const celda of celdas) {
      const parrafos = (celda.content as Record<string, unknown>[] | undefined) ?? [];
      for (const p of parrafos) {
        const nodosTexto = (p.content as { text?: string }[] | undefined) ?? [];
        const textoParrafo = nodosTexto.map((t) => t.text ?? '').join('');
        if (textoParrafo.trim().length > 0) {
          textos.push(textoParrafo);
        }
      }
    }
  }
  return textos;
}

/**
 * Aplica las reglas a una tabla pegada: si supera las 10 columnas o 50 filas, se convierte a párrafos;
 * si contiene combinaciones inválidas, se separan sus celdas combinadas.
 */
export function procesarTablaPegada(tabla: Record<string, unknown>): ResultadoProcesamientoTabla {
  const grid = cuadricula(tabla as TablaEstructural);

  if (grid.filas > LIMITES_TABLA.MAX_FILAS || grid.columnas > LIMITES_TABLA.MAX_COLUMNAS) {
    const parrafos = extraerTextosDeTabla(tabla);
    return {
      esTexto: true,
      parrafos,
      anuncio: 'La tabla supera el máximo de filas o columnas: se pegó como texto',
    };
  }

  let celdasSeparadas = false;
  let avisoSeparadas: string | undefined;

  let tablaFinal = tabla;
  if (!grid.esRegular || !grid.encabezadoValido) {
    celdasSeparadas = true;
    avisoSeparadas = 'Se separaron celdas combinadas que no forman un rectángulo';

    // Deshace combinaciones quitando colspan y rowspan
    const filasLimpias = ((tabla.content as Record<string, unknown>[] | undefined) ?? []).map((fila) => {
      const celdasLimpias = ((fila.content as Record<string, unknown>[] | undefined) ?? []).map((celda) => {
        const attrs = (celda.attrs as Record<string, unknown> | undefined) ?? {};
        const { colspan: _c, rowspan: _r, ...resto } = attrs;
        return {
          ...celda,
          type: 'tableCell',
          attrs: resto,
        };
      });
      return { ...fila, content: celdasLimpias };
    });

    tablaFinal = {
      ...tabla,
      content: filasLimpias,
    };
  }

  return {
    tabla: tablaFinal,
    esTexto: false,
    anuncio: `Se pegó una tabla de ${grid.filas} filas y ${grid.columnas} columnas`,
    celdasSeparadas,
    avisoSeparadas,
  };
}
