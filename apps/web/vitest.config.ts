/// <reference types="vitest/config" />
// Vitest con la config de Astro: resuelve astro:env, astro:middleware y astro:assets
// en los tests de src/lib, src/middleware.ts y los componentes.
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
