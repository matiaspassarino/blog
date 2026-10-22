// T066 (spec 003, H3-E3, RF-013, research D18): conversión y formato de fechas del panel.
// FASE ROJA: `./fechas` no existe aún (T071).
//
// Firmas supuestas, exportadas desde `lib/fechas.ts` (lógica pura, sin React):
//   aIsoUtc(valor: string): string | null
//     `valor` es lo que entrega un `<input type="datetime-local">` ("2026-10-22T15:30"), en la hora local del
//     navegador. Devuelve `new Date(valor).toISOString()`; un valor vacío o que no es una fecha devuelve `null`.
//   formatearFecha(iso: string | null | undefined, zona?: string): string | null
//     Texto en español ("Intl.DateTimeFormat('es', …)") con día, mes, año y hora:minutos, en la zona IANA `zona`
//     (por defecto, la del navegador). Un valor vacío, nulo o inválido devuelve `null`.
// El texto exacto lo decide `Intl`; las pruebas comprueban sus partes (día, mes en español, año y hora), no el orden.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ahoraLocal, aIsoUtc, formatearFecha } from './fechas';

describe('aIsoUtc (D18)', () => {
  it('H3-E3: convierte la hora local del navegador a ISO UTC', () => {
    const esperado = new Date(2026, 9, 22, 15, 30).toISOString(); // mes 9 = octubre, en la zona del proceso

    expect(aIsoUtc('2026-10-22T15:30')).toBe(esperado);
  });

  it('H3-E3: devuelve un ISO completo en UTC (termina en Z, con segundos y milésimas en cero)', () => {
    expect(aIsoUtc('2026-10-22T15:30')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
  });

  it('el resultado vuelve al mismo instante: leerlo como fecha da la hora local escrita', () => {
    const iso = aIsoUtc('2026-01-05T08:05')!;
    const fecha = new Date(iso);

    expect([fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), fecha.getHours(), fecha.getMinutes()]).toEqual([
      2026, 0, 5, 8, 5,
    ]);
  });

  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['texto cualquiera', 'mañana a la tarde'],
    ['fecha imposible', '2026-13-45T99:99'],
  ])('un valor %s devuelve null', (_descripcion, valor) => {
    expect(aIsoUtc(valor)).toBeNull();
  });
});

describe('formatearFecha (D18)', () => {
  const iso = '2026-10-22T15:30:00.000Z';

  it('H3-E1: produce el texto en español, con día, mes, año y hora en la zona pedida', () => {
    const texto = formatearFecha(iso, 'UTC')!;

    expect(texto).toMatch(/22/);
    expect(texto).toMatch(/oct/i);
    expect(texto).toMatch(/2026/);
    expect(texto).toMatch(/15:30/);
  });

  it('H3-E3: usa la zona indicada (Buenos Aires está 3 horas detrás de UTC)', () => {
    const texto = formatearFecha(iso, 'America/Argentina/Buenos_Aires')!;

    expect(texto).toMatch(/12:30/);
    expect(texto).not.toMatch(/15:30/);
  });

  it('cambia el día cuando la zona cruza la medianoche', () => {
    const texto = formatearFecha('2026-10-22T02:00:00.000Z', 'America/Argentina/Buenos_Aires')!;

    expect(texto).toMatch(/21/);
    expect(texto).toMatch(/23:00/);
  });

  it('sin zona usa la del proceso y no falla', () => {
    expect(formatearFecha(iso)).toEqual(expect.any(String));
  });

  it.each([
    ['vacío', ''],
    ['nulo', null],
    ['indefinido', undefined],
    ['inválido', 'no-es-una-fecha'],
  ])('un valor %s devuelve null', (_descripcion, valor) => {
    expect(formatearFecha(valor as string | null | undefined, 'UTC')).toBeNull();
  });
});

// T014 (spec 004, RF-018, H1; research D7): `ahoraLocal()` pasa de AccionesEstado.tsx a este módulo. FASE ROJA: aún no
// está exportada desde `./fechas`.
//   ahoraLocal(): string — "YYYY-MM-DDTHH:mm" en la hora local del navegador, sin segundos: el `min` de un
//   `<input type="datetime-local">`.
describe('ahoraLocal (RF-018)', () => {
  const zonaOriginal = process.env.TZ;

  afterEach(() => {
    vi.useRealTimers();
    if (zonaOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = zonaOriginal;
  });

  /** Fija el reloj y la zona; comprueba que el proceso adoptó la zona (si no, la prueba no probaría nada). */
  function conRelojEnZona(zona: string, minutosDeDesfase: number, instante: string) {
    process.env.TZ = zona;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(instante));
    expect(new Date(instante).getTimezoneOffset(), `el proceso no adoptó la zona ${zona}`).toBe(minutosDeDesfase);
  }

  it('devuelve el formato YYYY-MM-DDTHH:mm, sin segundos', () => {
    conRelojEnZona('UTC', 0, '2026-10-22T15:30:45.123Z');

    expect(ahoraLocal()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('en UTC coincide con la hora del reloj', () => {
    conRelojEnZona('UTC', 0, '2026-10-22T15:30:45.123Z');

    expect(ahoraLocal()).toBe('2026-10-22T15:30');
  });

  it('en Buenos Aires (UTC-3) es la hora local, 3 horas antes que UTC', () => {
    conRelojEnZona('America/Argentina/Buenos_Aires', 180, '2026-10-22T15:30:45.123Z');

    expect(ahoraLocal()).toBe('2026-10-22T12:30');
  });

  it('en Tokio (UTC+9) cruza la medianoche y cambia el día', () => {
    conRelojEnZona('Asia/Tokyo', -540, '2026-10-22T15:30:45.123Z');

    expect(ahoraLocal()).toBe('2026-10-23T00:30');
  });

  it('en Buenos Aires, poco después de la medianoche UTC, todavía es el día anterior', () => {
    conRelojEnZona('America/Argentina/Buenos_Aires', 180, '2026-01-01T01:05:00.000Z');

    expect(ahoraLocal()).toBe('2025-12-31T22:05');
  });

  it('es coherente con aIsoUtc: leída como hora local, vuelve al instante del reloj sin los segundos', () => {
    conRelojEnZona('America/Argentina/Buenos_Aires', 180, '2026-10-22T15:30:45.123Z');

    expect(aIsoUtc(ahoraLocal())).toBe('2026-10-22T15:30:00.000Z');
  });
});
