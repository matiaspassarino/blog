import { defineConfig, devices } from '@playwright/test';

// Los E2E del panel preparan y limpian datos con la clave de servicio, que vive en apps/admin/.env.local
// (ignorado por git; en CI la entrega el entorno). Si el archivo no existe, no pasa nada.
try {
  process.loadEnvFile('apps/admin/.env.local');
} catch {
  // sin archivo local: las variables vienen del entorno
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'on-first-retry' },
  projects: [
    { name: 'web', use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4321' }, testMatch: /web\/.*\.spec\.ts/ },
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3100' },
      testMatch: /admin\/.*\.spec\.ts/,
      // Cada spec del panel limpia sus datos por prefijo en afterAll: si sus pruebas se repartieran entre
      // trabajadores, uno borraría lo que otro todavía usa. Los archivos sí corren en paralelo.
      fullyParallel: false,
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter web dev --ignore-lock',
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
    },
    { command: 'pnpm --filter admin dev', url: 'http://localhost:3100', reuseExistingServer: !process.env.CI },
  ],
});
