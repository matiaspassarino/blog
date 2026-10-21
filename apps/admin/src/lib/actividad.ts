// Vencimiento de la sesión por inactividad (spec 003, RF-002, research D3). El de Supabase es de
// planes de pago: el panel guarda en una cookie la hora de la última actividad y la compara aquí.

/** Nombre de la cookie con la hora de la última actividad (milisegundos desde la época, en texto). */
export const COOKIE_ACTIVIDAD = 'blog_actividad';

/** 8 horas sin actividad (clarificación del 2026-10-21). */
export const limiteInactividad = 8 * 60 * 60 * 1000;

/**
 * `ultimaActividad` es el valor de la cookie. Sin cookie (primera visita de la sesión) no hay nada que
 * vencer; un valor ilegible se trata como vencido, para no dejar entrar con una cookie adulterada.
 */
export function sesionVencida(ultimaActividad: string | undefined, ahora: number, limiteMs: number): boolean {
  if (ultimaActividad === undefined) return false;
  if (!/^\d+$/.test(ultimaActividad)) return true;
  return ahora - Number(ultimaActividad) > limiteMs;
}
