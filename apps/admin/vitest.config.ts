import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // Conexión a Supabase local para las pruebas de integración de las acciones (se saltan si no está).
    // Los archivos comparten la base local y algunos dependen del estado global (por ejemplo, que haya un solo
    // admin activo en las pruebas del equipo): se corren de a uno.
    fileParallelism: false,
    globalSetup: ['@blog/db/pruebas/entorno'],
  },
});
