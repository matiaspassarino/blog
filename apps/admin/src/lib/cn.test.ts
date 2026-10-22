import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('conserva el tamaño de título al combinarlo con un color de texto', () => {
    expect(cn('text-titulo-3 font-semibold', 'text-texto')).toBe('text-titulo-3 font-semibold text-texto');
  });

  it('sigue resolviendo conflictos entre colores', () => {
    expect(cn('text-texto', 'text-marca')).toBe('text-marca');
  });
});
