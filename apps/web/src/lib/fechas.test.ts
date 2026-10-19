// T020 (spec 002): fecha larga en español de Argentina (research D17).
import { describe, expect, it } from 'vitest';
import { fechaLarga } from './fechas';

describe('fechaLarga', () => {
  it('D17: formatea una fecha ISO como "18 de octubre de 2026"', () => {
    expect(fechaLarga('2026-10-18T15:00:00Z')).toBe('18 de octubre de 2026');
  });

  it('D17: usa la zona America/Argentina/Buenos_Aires (01:00 UTC es el día anterior)', () => {
    expect(fechaLarga('2026-10-19T01:00:00Z')).toBe('18 de octubre de 2026');
  });

  it('D17: a las 03:00 UTC ya es el mismo día en Buenos Aires (UTC−3)', () => {
    expect(fechaLarga('2026-10-19T03:00:00Z')).toBe('19 de octubre de 2026');
  });
});
