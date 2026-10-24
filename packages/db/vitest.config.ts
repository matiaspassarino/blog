import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    globalSetup: ['./src/pruebas/entorno.ts'],
  },
});
