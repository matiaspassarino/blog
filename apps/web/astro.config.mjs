// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';

import vercel from '@astrojs/vercel';
import { cacheVercel } from '@astrojs/vercel/cache';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { identidad } from '@blog/ui/identidad';

// Render y caché: SSR + caché de rutas en el CDN de Vercel, invalidado por tags desde
// /api/revalidar (specs/002-sitio-publico/research.md D1–D3; constitución §IV.1).
const urlSupabase = new URL(process.env.PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:56321');

export default defineConfig({
  site: process.env.PUBLIC_URL_SITIO ?? 'http://localhost:4321',
  output: 'server',
  trailingSlash: 'never',
  adapter: vercel({ imageService: true }),
  cache: { provider: cacheVercel() },
  integrations: [react()],

  env: {
    schema: {
      PUBLIC_URL_SITIO: envField.string({ context: 'server', access: 'public' }),
      PUBLIC_SUPABASE_URL: envField.string({ context: 'server', access: 'public' }),
      PUBLIC_SUPABASE_ANON_KEY: envField.string({ context: 'server', access: 'public' }),
      SECRETO_REVALIDACION: envField.string({ context: 'server', access: 'secret', min: 32 }),
    },
  },

  // Las familias salen de @blog/ui/identidad (§VII.6). Las variables se consumen desde
  // tokens.css (--font-cuerpo y --font-titulos), con el respaldo de sistema.
  fonts: [
    { provider: fontProviders.fontsource(), name: identidad.fuentes.cuerpo, cssVariable: '--fuente-cuerpo' },
    { provider: fontProviders.fontsource(), name: identidad.fuentes.titulos, cssVariable: '--fuente-titulos' },
  ],

  image: {
    remotePatterns: [
      { protocol: urlSupabase.protocol.replace(':', ''), hostname: urlSupabase.hostname },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
