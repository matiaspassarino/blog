// Nombres con prefijo `e2e-` para los datos de los E2E: `limpiarDatosE2E` (servicio.ts) los borra al terminar.
const PREFIJO = 'e2e-';

/** Nombre único y reconocible: `e2e-<etiqueta>-<sufijo>`. */
export function nombreDePrueba(etiqueta: string) {
  return `${PREFIJO}${etiqueta}-${crypto.randomUUID().slice(0, 6)}`;
}

/** Fecha futura en formato de `<input type="datetime-local">` (hora local del navegador). */
export function fechaFutura(minutos: number) {
  const f = new Date(Date.now() + minutos * 60_000);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}T${dos(f.getHours())}:${dos(f.getMinutes())}`;
}
