// T075 (spec 002): verificación de la firma del aviso de cambio (research D4; H4-E2, CE-009;
// contrato 001, specs/001-modelo-de-contenido/contracts/revalidacion.md).
//
// Firma elegida (la implementa T080):
//   verificarAviso({ cuerpo, marca, firma, secreto, ahora }): boolean
//   - cuerpo: el texto crudo del cuerpo (`await request.text()`).
//   - marca: el valor de `X-Blog-Marca-Tiempo` tal como llega (segundos epoch, string), o null.
//   - firma: el valor COMPLETO de `X-Blog-Firma`, con el prefijo: `sha256=<hex>`, o null.
//   - secreto: SECRETO_REVALIDACION.
//   - ahora: milisegundos epoch (`Date.now()`).
// Devuelve true solo si la firma es HMAC-SHA256(marca + '.' + cuerpo, secreto) en hex con el
// prefijo `sha256=` y |ahora - marca| <= 300 s. Nunca lanza.
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verificarAviso } from './aviso';

const SECRETO = 'secreto-de-prueba';
const MARCA = 1_792_411_200; // 2026-10-19T12:00:00Z en segundos
const AHORA = MARCA * 1000;
// Como lo serializa la base (jsonb::text): con espacios después de ':' y ','.
const CUERPO =
  '{"id": "5b0c0000-0000-4000-8000-000000000001", "tipo": "articulo", "slugs": ["b", "a"], "ocurrido_en": "2026-10-19T12:00:00+00:00"}';

/** Firma como notificar_cambio_publico (supabase/migrations/20261018120500_notificacion.sql). */
function firmar(cuerpo: string, marca: string | number, secreto = SECRETO) {
  return 'sha256=' + createHmac('sha256', secreto).update(`${marca}.${cuerpo}`).digest('hex');
}

function aviso(campos: Partial<Parameters<typeof verificarAviso>[0]> = {}) {
  return {
    cuerpo: CUERPO,
    marca: String(MARCA),
    firma: firmar(CUERPO, MARCA),
    secreto: SECRETO,
    ahora: AHORA,
    ...campos,
  };
}

describe('verificarAviso', () => {
  it('H4-E2: acepta la firma HMAC-SHA256 correcta sobre marca + "." + cuerpo', () => {
    expect(verificarAviso(aviso())).toBe(true);
  });

  it('H4-E2: rechaza un aviso sin firma', () => {
    expect(verificarAviso(aviso({ firma: null }))).toBe(false);
    expect(verificarAviso(aviso({ firma: '' }))).toBe(false);
  });

  it('H4-E2: rechaza un aviso sin marca de tiempo', () => {
    expect(verificarAviso(aviso({ marca: null }))).toBe(false);
    expect(verificarAviso(aviso({ marca: '' }))).toBe(false);
  });

  it('rechaza una marca que no es un número de segundos', () => {
    const marca = 'mañana';
    expect(verificarAviso(aviso({ marca, firma: firmar(CUERPO, marca) }))).toBe(false);
  });

  it('H4-E2: rechaza la firma de otro cuerpo', () => {
    const otroCuerpo = CUERPO.replace('"b", "a"', '"c"');
    expect(verificarAviso(aviso({ firma: firmar(otroCuerpo, MARCA) }))).toBe(false);
  });

  it('H4-E2: rechaza si el cuerpo cambia en un solo byte (se firma el texto crudo, no el JSON parseado)', () => {
    expect(verificarAviso(aviso({ cuerpo: CUERPO.replace(': ', ':') }))).toBe(false);
  });

  it('H4-E2: rechaza la firma hecha con otro secreto', () => {
    expect(verificarAviso(aviso({ firma: firmar(CUERPO, MARCA, 'otro-secreto') }))).toBe(false);
  });

  it('H4-E2: rechaza la firma de otra marca (no se puede reutilizar una firma con una marca nueva)', () => {
    expect(verificarAviso(aviso({ firma: firmar(CUERPO, MARCA - 1) }))).toBe(false);
  });

  it('rechaza la firma correcta sin el prefijo sha256=', () => {
    const sinPrefijo = firmar(CUERPO, MARCA).slice('sha256='.length);
    expect(verificarAviso(aviso({ firma: sinPrefijo }))).toBe(false);
  });

  it('rechaza la firma con otro prefijo de algoritmo', () => {
    const conOtroPrefijo = firmar(CUERPO, MARCA).replace('sha256=', 'sha1=');
    expect(verificarAviso(aviso({ firma: conOtroPrefijo }))).toBe(false);
  });

  it('CE-009: rechaza una firma de largo distinto sin lanzar excepción', () => {
    const firmaCorrecta = firmar(CUERPO, MARCA);
    for (const firma of [firmaCorrecta.slice(0, -1), firmaCorrecta + '0', 'sha256=', 'sha256=abc', 'x']) {
      expect(() => verificarAviso(aviso({ firma }))).not.toThrow();
      expect(verificarAviso(aviso({ firma }))).toBe(false);
    }
  });

  it('rechaza una firma del mismo largo que no es hex sin lanzar excepción', () => {
    const noHex = 'sha256=' + 'z'.repeat(64);
    expect(() => verificarAviso(aviso({ firma: noHex }))).not.toThrow();
    expect(verificarAviso(aviso({ firma: noHex }))).toBe(false);
  });

  it('H4-E2: rechaza una marca de más de 300 s en el pasado', () => {
    expect(verificarAviso(aviso({ ahora: AHORA + 301_000 }))).toBe(false);
  });

  it('H4-E2: rechaza una marca de más de 300 s en el futuro', () => {
    expect(verificarAviso(aviso({ ahora: AHORA - 301_000 }))).toBe(false);
  });

  it('acepta justo en 300 s, en ambos sentidos', () => {
    expect(verificarAviso(aviso({ ahora: AHORA + 300_000 }))).toBe(true);
    expect(verificarAviso(aviso({ ahora: AHORA - 300_000 }))).toBe(true);
  });

  it('acepta dentro de la ventana', () => {
    expect(verificarAviso(aviso({ ahora: AHORA + 59_999 }))).toBe(true);
  });
});
