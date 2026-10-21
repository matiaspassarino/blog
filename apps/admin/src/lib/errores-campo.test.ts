// T021 (spec 003): ids de los campos con error en el editor (RF-006, CE-004, H2-E3).
// Firmas supuestas (T033), exportadas desde './errores-campo'; los errores son `ErrorBloque`
// de @blog/bloques (`{ indice, campo, mensaje }`):
//   idDeCampo(error): string                 `bloque-<indice>-<campo>`; con indice -1: `campo-<primer segmento>`
//                                            (la imagen destacada es `campo-imagen_destacada` aunque el
//                                            error diga `imagen_destacada.alt`)
//   agruparPorBloque(errores): Map<number, ErrorBloque[]>
//   primerCampoInvalido(errores): string | null   id del primero por orden de pantalla (imagen destacada,
//                                            que usa indice -1, y luego los bloques de menor a mayor índice)
import type { ErrorBloque } from '@blog/bloques';
import { describe, expect, it } from 'vitest';
import { agruparPorBloque, idDeCampo, primerCampoInvalido } from './errores-campo';

const error = (indice: number, campo: string, mensaje = 'Mensaje de prueba'): ErrorBloque => ({ indice, campo, mensaje });

describe('idDeCampo', () => {
  it('CE-004: convierte { indice, campo } en bloque-<indice>-<campo>', () => {
    expect(idDeCampo(error(2, 'imagen.alt'))).toBe('bloque-2-imagen.alt');
    expect(idDeCampo(error(0, 'texto'))).toBe('bloque-0-texto');
  });

  it('CE-004: los errores de la imagen destacada (indice -1) apuntan a campo-imagen_destacada', () => {
    expect(idDeCampo(error(-1, 'imagen_destacada.alt'))).toBe('campo-imagen_destacada');
    expect(idDeCampo(error(-1, 'imagen_destacada.ruta'))).toBe('campo-imagen_destacada');
  });

  it('RF-006: los errores de otro campo con indice -1 usan su propio nombre (por ejemplo el avatar)', () => {
    expect(idDeCampo(error(-1, 'avatar.alt'))).toBe('campo-avatar');
  });
});

describe('agruparPorBloque', () => {
  const errores = [error(2, 'imagen.alt'), error(0, 'texto'), error(2, 'leyenda'), error(-1, 'imagen_destacada.alt')];

  it('CE-004: agrupa los errores por índice de bloque', () => {
    const mapa = agruparPorBloque(errores);

    expect(mapa.get(2)).toEqual([error(2, 'imagen.alt'), error(2, 'leyenda')]);
    expect(mapa.get(0)).toEqual([error(0, 'texto')]);
  });

  it('CE-004: agrupa también los de la imagen destacada bajo -1', () => {
    expect(agruparPorBloque(errores).get(-1)).toEqual([error(-1, 'imagen_destacada.alt')]);
  });

  it('CE-004: un bloque sin errores no aparece en el mapa', () => {
    const mapa = agruparPorBloque(errores);

    expect(mapa.has(1)).toBe(false);
    expect(mapa.size).toBe(3);
  });

  it('CE-004: sin errores devuelve un mapa vacío', () => {
    expect(agruparPorBloque([]).size).toBe(0);
  });
});

describe('primerCampoInvalido', () => {
  it('H2-E3: devuelve el id del primer campo con error por orden de pantalla (menor índice)', () => {
    const desordenados = [error(3, 'texto'), error(1, 'imagen.alt'), error(2, 'leyenda')];

    expect(primerCampoInvalido(desordenados)).toBe('bloque-1-imagen.alt');
  });

  it('H2-E3: la imagen destacada va antes que los bloques', () => {
    const errores = [error(0, 'texto'), error(-1, 'imagen_destacada.alt')];

    expect(primerCampoInvalido(errores)).toBe('campo-imagen_destacada');
  });

  it('H2-E3: con un solo error devuelve su id', () => {
    expect(primerCampoInvalido([error(4, 'url')])).toBe('bloque-4-url');
  });

  it('H2-E3: sin errores devuelve null', () => {
    expect(primerCampoInvalido([])).toBeNull();
  });
});
