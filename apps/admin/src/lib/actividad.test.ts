// T018 (spec 003): vencimiento de la sesión por inactividad (RF-002, D3). Funciones puras.
// Firmas supuestas (T033), exportadas desde './actividad':
//   sesionVencida(ultimaActividad: string | undefined, ahora: number, limiteMs: number): boolean
//     `ultimaActividad` es el valor de la cookie `blog_actividad`: milisegundos desde la época en texto.
//   limiteInactividad: number (milisegundos)
import { describe, expect, it } from 'vitest';
import { limiteInactividad, sesionVencida } from './actividad';

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const ahora = Date.UTC(2026, 9, 21, 12, 0, 0);
const hace = (ms: number) => String(ahora - ms);

describe('limiteInactividad', () => {
  it('RF-002: es de 8 horas', () => {
    expect(limiteInactividad).toBe(8 * HORA);
  });
});

describe('sesionVencida', () => {
  it('RF-002: sigue vigente a las 7 h 59 min sin actividad', () => {
    expect(sesionVencida(hace(7 * HORA + 59 * MINUTO), ahora, limiteInactividad)).toBe(false);
  });

  it('RF-002: venció pasadas las 8 h sin actividad', () => {
    expect(sesionVencida(hace(8 * HORA + MINUTO), ahora, limiteInactividad)).toBe(true);
    expect(sesionVencida(hace(24 * HORA), ahora, limiteInactividad)).toBe(true);
  });

  it('RF-002: con actividad reciente sigue vigente', () => {
    expect(sesionVencida(hace(0), ahora, limiteInactividad)).toBe(false);
    expect(sesionVencida(hace(5 * MINUTO), ahora, limiteInactividad)).toBe(false);
  });

  it('RF-002: sin cookie (primera visita de la sesión) no está vencida', () => {
    expect(sesionVencida(undefined, ahora, limiteInactividad)).toBe(false);
  });

  it.each(['', 'abc', 'NaN', '12abc', '{"t":1}', 'null'])(
    'RF-002: con un valor ilegible (%j) se considera vencida',
    (valor) => {
      expect(sesionVencida(valor, ahora, limiteInactividad)).toBe(true);
    },
  );

  it('RF-002: respeta el límite que se le pasa', () => {
    expect(sesionVencida(hace(2 * MINUTO), ahora, MINUTO)).toBe(true);
    expect(sesionVencida(hace(30 * 1000), ahora, MINUTO)).toBe(false);
  });
});
