// T022 (spec 003): el panel no se indexa (RSEO-001). Convención `robots.ts` de Next: el export por
// defecto devuelve `MetadataRoute.Robots`; `rules` puede ser un objeto o un arreglo.
import { describe, expect, it } from 'vitest';
import robots from './robots';

describe('robots', () => {
  it('RSEO-001: prohíbe a todos los robots rastrear cualquier ruta', () => {
    const reglas = [robots().rules].flat();

    expect(reglas.length).toBeGreaterThan(0);
    for (const regla of reglas) {
      expect(regla.userAgent).toBe('*');
      expect([regla.disallow].flat()).toContain('/');
    }
  });

  it('RSEO-001: no permite ninguna ruta', () => {
    for (const regla of [robots().rules].flat()) {
      expect(regla.allow ?? []).toEqual([]);
    }
  });

  it('RSEO-001: no declara sitemap', () => {
    expect(robots()).not.toHaveProperty('sitemap');
  });
});
