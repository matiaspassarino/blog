import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'on-first-retry' },
  projects: [
    { name: 'web', use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4321' }, testMatch: /web\/.*\.spec\.ts/ },
    { name: 'admin', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3100' }, testMatch: /admin\/.*\.spec\.ts/ },
  ],
  webServer: [
    { command: 'pnpm --filter web dev --ignore-lock', url: 'http://localhost:4321', reuseExistingServer: !process.env.CI },
    { command: 'pnpm --filter admin dev', url: 'http://localhost:3100', reuseExistingServer: !process.env.CI },
  ],
});
