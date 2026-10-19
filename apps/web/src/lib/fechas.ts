// Fechas largas en español de Argentina (specs/002-sitio-publico/research.md D17).
const formato = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'long',
  timeZone: 'America/Argentina/Buenos_Aires',
});

/** "18 de octubre de 2026" a partir de una fecha ISO. */
export function fechaLarga(iso: string): string {
  return formato.format(new Date(iso));
}
