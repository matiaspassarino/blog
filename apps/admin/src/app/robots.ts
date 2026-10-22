import type { MetadataRoute } from 'next';

// Ningún buscador entra al panel (RSEO-001): sin rutas permitidas y sin sitemap.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
