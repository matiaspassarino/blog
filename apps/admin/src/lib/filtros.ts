// Filtros de la lista de artículos en la dirección de la pantalla (RF-016, RF-017). Puras: la página las usa
// en el servidor y las pruebas sin framework. Un valor inválido se ignora, nunca rompe la pantalla.
import type { EstadoArticulo, FiltrosPanel } from '@blog/db';
import { z } from 'zod';

type Parametros = Record<string, string | string[] | undefined>;

const esquemas = {
  estado: z.enum(['borrador', 'programado', 'publicado', 'archivado'] satisfies EstadoArticulo[]),
  categoria: z.uuid(),
  autor: z.uuid(),
  // Más de 100 caracteres no es una búsqueda razonable: se ignora en lugar de truncarse.
  q: z.string().trim().min(1).max(100),
  pagina: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().safe()),
};

/** Un parámetro repetido (`?q=a&q=b`) llega como arreglo: se toma el primero. */
const primero = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);

/** Lee los filtros de la dirección; siempre devuelve `pagina` (1 por defecto). */
export function leerFiltros(parametros: Parametros): FiltrosPanel & { pagina: number } {
  const resultado: FiltrosPanel & { pagina: number } = { pagina: 1 };

  const estado = esquemas.estado.safeParse(primero(parametros.estado));
  if (estado.success) resultado.estado = estado.data;
  const categoria = esquemas.categoria.safeParse(primero(parametros.categoria));
  if (categoria.success) resultado.categoria = categoria.data;
  const autor = esquemas.autor.safeParse(primero(parametros.autor));
  if (autor.success) resultado.autor = autor.data;
  const q = esquemas.q.safeParse(primero(parametros.q));
  if (q.success) resultado.q = q.data;
  const pagina = esquemas.pagina.safeParse(primero(parametros.pagina));
  if (pagina.success) resultado.pagina = pagina.data;

  return resultado;
}

/** Inversa de `leerFiltros`: omite los vacíos y la página 1 para que la dirección quede corta. */
export function aSearchParams(filtros: FiltrosPanel): URLSearchParams {
  const parametros = new URLSearchParams();
  if (filtros.estado) parametros.set('estado', filtros.estado);
  if (filtros.categoria) parametros.set('categoria', filtros.categoria);
  if (filtros.autor) parametros.set('autor', filtros.autor);
  if (filtros.q) parametros.set('q', filtros.q);
  if (filtros.pagina && filtros.pagina > 1) parametros.set('pagina', String(filtros.pagina));
  return parametros;
}
