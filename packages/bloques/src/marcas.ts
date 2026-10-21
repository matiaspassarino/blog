// Marcas de formato en línea del editor (spec 003, research D12): las cuatro que el sitio interpreta
// (D9 de la spec 001): negrita, cursiva, código y enlace. Sin HTML ni subrayado. Función pura.

export type MarcaEnLinea = 'negrita' | 'cursiva' | 'codigo' | 'enlace';
export type Seleccion = { inicio: number; fin: number };

/** URL marcadora de un enlace nuevo: queda seleccionada para escribir la verdadera enseguida. */
const URL_MARCADORA = 'url';

const ENVOLTURAS: Record<Exclude<MarcaEnLinea, 'enlace'>, string> = { negrita: '**', cursiva: '_', codigo: '`' };

/**
 * Aplica la marca a la selección (`fin` exclusivo). Con la selección vacía inserta los marcadores
 * vacíos en el cursor. Devuelve el texto nuevo y la selección que conviene dejar al usuario.
 */
export function aplicarMarca(
  texto: string,
  { inicio, fin }: Seleccion,
  marca: MarcaEnLinea,
): { texto: string; seleccion: Seleccion } {
  const antes = texto.slice(0, inicio);
  const elegido = texto.slice(inicio, fin);
  const despues = texto.slice(fin);

  if (marca === 'enlace') {
    const urlInicio = fin + 3; // "[" + selección + "](" delante de la URL
    return {
      texto: `${antes}[${elegido}](${URL_MARCADORA})${despues}`,
      seleccion: { inicio: urlInicio, fin: urlInicio + URL_MARCADORA.length },
    };
  }

  const envoltura = ENVOLTURAS[marca];
  const largo = envoltura.length;
  return {
    texto: `${antes}${envoltura}${elegido}${envoltura}${despues}`,
    seleccion: { inicio: inicio + largo, fin: fin + largo },
  };
}
