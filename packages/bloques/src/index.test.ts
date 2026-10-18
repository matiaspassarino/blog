import { describe, expect, it } from 'vitest';
import { TIPOS_BLOQUE } from './index';

describe('bloques', () => {
  it('no tiene tipos de bloque duplicados', () => {
    expect(new Set(TIPOS_BLOQUE).size).toBe(TIPOS_BLOQUE.length);
  });
});
