// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';

import vercel from '@astrojs/vercel';
import { cacheVercel } from '@astrojs/vercel/cache';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { identidad } from '@blog/ui/identidad';
import { ANCHOS_VERCEL } from './src/lib/anchos-imagen';

// Render y caché: SSR + caché de rutas en el CDN de Vercel, invalidado por tags desde
// /api/revalidar (specs/002-sitio-publico/research.md D1–D3; constitución §IV.1).
const urlSupabase = new URL(process.env.PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:56321');
/** @type {Array<{ protocol: 'http' | 'https'; hostname: string }>} */
const origenesImagen = [
  { protocol: urlSupabase.protocol === 'https:' ? 'https' : 'http', hostname: urlSupabase.hostname },
  { protocol: 'https', hostname: 'picsum.photos' },
  { protocol: 'https', hostname: 'fastly.picsum.photos' },
];

export default defineConfig({
  site: process.env.PUBLIC_URL_SITIO ?? 'http://localhost:4321',
  output: 'server',
  trailingSlash: 'never',
  adapter: vercel({
    imageService: true,
    // Vercel solo genera los anchos declarados (T099); AVIF y WebP pesan menos que JPEG.
    imagesConfig: { sizes: ANCHOS_VERCEL, formats: ['image/avif', 'image/webp'], remotePatterns: origenesImagen },
  }),
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
    remotePatterns: origenesImagen,
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
