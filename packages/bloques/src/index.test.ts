import { describe, expect, it } from 'vitest';
import { TIPOS_ELEMENTO } from './index';

describe('bloques', () => {
  it('no tiene tipos de elemento duplicados', () => {
    expect(new Set(TIPOS_ELEMENTO).size).toBe(TIPOS_ELEMENTO.length);
  });
});
