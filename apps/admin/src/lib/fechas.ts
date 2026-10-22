// Fechas del panel (research D18 de la spec 003): la persona escribe la hora de su navegador; la base guarda
// UTC. Funciones puras: las usan los componentes de cliente y las pruebas.

/**
 * Convierte el valor de un `<input type="datetime-local">` ("2026-10-22T15:30", hora local del navegador) a
 * ISO UTC. Un valor vacío o que no es una fecha devuelve `null`.
 */
export function aIsoUtc(valor: string): string | null {
  if (valor.trim() === '') return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

/**
 * Texto en español con día, mes, año y hora ("22 oct 2026, 15:30"), en la zona IANA indicada o, por
 * defecto, en la del navegador. Un valor vacío o inválido devuelve `null`.
 */
export function formatearFecha(iso: string | null | undefined, zona?: string): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: zona,
  }).format(fecha);
}
