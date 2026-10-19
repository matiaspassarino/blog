// Datos del sitio para el JSON-LD de todas las páginas (fuente única).
import { PUBLIC_SUPABASE_URL, PUBLIC_URL_SITIO } from 'astro:env/server';
import { landing } from '../contenido/landing';
import type { SitioJsonLd } from './json-ld';

export const sitio: SitioJsonLd = {
  url: PUBLIC_URL_SITIO,
  nombre: landing.sitio.nombre,
  // Servido por src/pages/logo.svg.ts desde @blog/ui/identidad.
  logo: '/logo.svg',
  supabaseUrl: PUBLIC_SUPABASE_URL,
};
