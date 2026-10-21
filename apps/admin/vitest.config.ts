import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // Conexión a Supabase local para las pruebas de integración de las acciones (se saltan si no está).
    globalSetup: ['@blog/db/pruebas/entorno'],
  },
});
