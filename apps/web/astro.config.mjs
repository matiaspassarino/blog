// @ts-check
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Estrategia de render e ISR: ver .claude/skills/astro-seo/SKILL.md
export default defineConfig({
  site: process.env.PUBLIC_URL_SITIO ?? 'http://localhost:4321',
  output: 'server',
  adapter: vercel({
    isr: {
      expiration: false,
      bypassToken: process.env.SECRETO_REVALIDACION,
      exclude: [/^\/api\/.*/, /^\/blog\/buscar/],
    },
    imageService: true,
  }),
  integrations: [react(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },
});
