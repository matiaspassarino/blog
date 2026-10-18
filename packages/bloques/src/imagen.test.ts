// T020: sub-esquema de imagen compartido (contracts/bloques.md, "Imagen"; research D15; RF-004).
import { describe, expect, it } from 'vitest';
import { esquemaImagen } from './imagen';

const MENSAJE_SIN_ALT = 'La imagen necesita un texto alternativo o marcarse como decorativa';

const imagenValida = {
  ruta: 'articulos/portada.jpg',
  ancho: 1200,
  alto: 630,
  alt: 'Escritorio con una laptop y una taza de café',
};

function mensajesDe(entrada: unknown): string[] {
  const resultado = esquemaImagen.safeParse(entrada);
  return resultado.success ? [] : resultado.error.issues.map((problema) => problema.message);
}

describe('esquemaImagen', () => {
  it('acepta una imagen válida y marca decorativa = false por defecto', () => {
    const resultado = esquemaImagen.safeParse(imagenValida);
    expect(resultado.success).toBe(true);
    expect(resultado.data).toEqual({ ...imagenValida, decorativa: false });
  });

  it('acepta un alt de exactamente 200 caracteres', () => {
    expect(esquemaImagen.safeParse({ ...imagenValida, alt: 'a'.repeat(200) }).success).toBe(true);
  });

  describe('RF-004: texto alternativo obligatorio salvo imagen decorativa', () => {
    it('rechaza una imagen sin alt y no decorativa, con un mensaje accionable en español sobre el campo alt', () => {
      const { alt: _sinAlt, ...sinAlt } = imagenValida;
      const resultado = esquemaImagen.safeParse({ ...sinAlt, decorativa: false });
      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: ['alt'], message: MENSAJE_SIN_ALT })]),
      );
    });

    it('rechaza una imagen sin alt cuando decorativa no se informa (vale false)', () => {
      const { alt: _sinAlt, ...sinAlt } = imagenValida;
      expect(mensajesDe(sinAlt)).toContain(MENSAJE_SIN_ALT);
    });

    it('acepta una imagen decorativa sin alt', () => {
      const { alt: _sinAlt, ...sinAlt } = imagenValida;
      const resultado = esquemaImagen.safeParse({ ...sinAlt, decorativa: true });
      expect(resultado.success).toBe(true);
      expect(resultado.data?.decorativa).toBe(true);
    });

    it('rechaza un alt vacío', () => {
      expect(esquemaImagen.safeParse({ ...imagenValida, alt: '' }).success).toBe(false);
    });

    it('rechaza un alt de más de 200 caracteres', () => {
      expect(esquemaImagen.safeParse({ ...imagenValida, alt: 'a'.repeat(201) }).success).toBe(false);
    });
  });

  describe('dimensiones explícitas (§IV.6, evitan CLS)', () => {
    it.each([
      ['ancho', 0],
      ['ancho', -10],
      ['ancho', 12.5],
      ['ancho', '1200'],
      ['alto', 0],
      ['alto', -1],
      ['alto', 630.2],
      ['alto', '630'],
    ])('rechaza %s = %j (debe ser un entero mayor que 0)', (campo, valor) => {
      expect(esquemaImagen.safeParse({ ...imagenValida, [campo]: valor }).success).toBe(false);
    });

    it.each(['ancho', 'alto'])('rechaza una imagen sin %s', (campo) => {
      const sinCampo: Record<string, unknown> = { ...imagenValida };
      delete sinCampo[campo];
      expect(esquemaImagen.safeParse(sinCampo).success).toBe(false);
    });
  });

  describe('ruta', () => {
    it('rechaza una imagen sin ruta', () => {
      const { ruta: _sinRuta, ...sinRuta } = imagenValida;
      expect(esquemaImagen.safeParse(sinRuta).success).toBe(false);
    });

    it('rechaza una ruta vacía', () => {
      expect(esquemaImagen.safeParse({ ...imagenValida, ruta: '' }).success).toBe(false);
    });
  });

  it.each([null, 'portada.jpg', 42, []])('rechaza una entrada que no es un objeto: %j', (entrada) => {
    expect(esquemaImagen.safeParse(entrada).success).toBe(false);
  });
});
