import type { NextConfig } from 'next';

// El panel es dinámico y está detrás del ingreso: sin cacheComponents (research D4 de la spec 003).
const nextConfig: NextConfig = {
  // Habilita forbidden() para negar el acceso a /equipo a quien no es admin (contracts/rutas.md).
  experimental: { authInterrupts: true },
  // Ningún buscador entra al panel (RSEO-001, research D20).
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
