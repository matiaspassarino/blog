// Un párrafo guardado puede traer varios tramos separados por líneas en blanco. El editor los muestra como
// párrafos distintos y los vuelve a unir con el separador exacto, para no cambiar ni un salto de línea (D4).

export type TramoDeParrafo = { texto: string; separador: string };

/** Parte por dos o más saltos seguidos; el separador es la secuencia exacta que sigue al tramo anterior. */
export function partirParrafos(texto: string): TramoDeParrafo[] {
  const piezas = texto.split(/(\n{2,})/);
  const tramos: TramoDeParrafo[] = [];
  for (let i = 0; i < piezas.length; i += 2) {
    tramos.push({ texto: piezas[i] ?? '', separador: i === 0 ? '' : (piezas[i - 1] ?? '') });
  }
  return tramos;
}

export function unirParrafos(tramos: TramoDeParrafo[]): string {
  return tramos.map((tramo) => tramo.separador + tramo.texto).join('');
}
