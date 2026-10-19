// T024 (spec 002): esquema del contenido de la landing (contracts/landing.md; RF-013c, H3-E5).
// landing.ts exporta el contenido ya parseado; los casos inválidos parsean con el esquema
// una copia modificada (solo se copian los niveles que cambian).
import { describe, expect, it } from 'vitest';
import { esquemaLanding } from './esquema';
import { landing } from './landing';

/** Rutas ("hero.titulo") de los errores de un parseo fallido, o [] si es válido. */
function rutasConError(contenido: unknown): string[] {
  const resultado = esquemaLanding.safeParse(contenido);
  return resultado.success ? [] : resultado.error.issues.map((problema) => problema.path.join('.'));
}

describe('esquema de la landing', () => {
  it('RF-013c: el contenido de demo de landing.ts es válido', () => {
    const resultado = esquemaLanding.safeParse(landing);

    expect(resultado.success, JSON.stringify(resultado.error?.issues)).toBe(true);
  });

  it('H3-E5: sin hero.titulo, el parseo falla y el error nombra hero.titulo', () => {
    const { titulo: _sinTitulo, ...heroSinTitulo } = landing.hero;

    expect(rutasConError({ ...landing, hero: heroSinTitulo })).toContain('hero.titulo');
  });

  it('H3-E5: con contacto.whatsapp "+54 11", el parseo falla y el error nombra contacto.whatsapp', () => {
    const contenido = { ...landing, contacto: { ...landing.contacto, whatsapp: '+54 11' } };

    expect(rutasConError(contenido)).toContain('contacto.whatsapp');
  });

  it('contrato: servicios.items con 2 elementos falla (mínimo 3)', () => {
    const contenido = {
      ...landing,
      servicios: { ...landing.servicios, items: landing.servicios.items.slice(0, 2) },
    };

    expect(rutasConError(contenido)).toContain('servicios.items');
  });

  it('contrato: sitio.descripcion de menos de 50 caracteres falla', () => {
    const contenido = { ...landing, sitio: { ...landing.sitio, descripcion: 'Descripción demasiado corta.' } };

    expect(rutasConError(contenido)).toContain('sitio.descripcion');
  });
});
