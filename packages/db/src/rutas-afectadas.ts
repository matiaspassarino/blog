// Rutas del sitio público a revalidar ante un cambio (contracts/revalidacion.md).
// Fuente única: la usa el endpoint /api/revalidar de apps/web.

export type CambioPublico = {
  tipo: 'articulo' | 'categoria' | 'etiqueta' | 'autor';
  id: string;
  /** Actuales y anteriores; para 'autor', los de sus artículos publicados (máx. 50). */
  slugs: string[];
  categorias?: string[];
  etiquetas?: string[];
};

/** Páginas del listado que se revalidan (las primeras 5). */
const PAGINAS_DEL_BLOG = Array.from({ length: 5 }, (_, i) => `/blog/pagina/${i + 1}`);

export function rutasAfectadas(cambio: CambioPublico): string[] {
  const rutas = new Set<string>();
  const agregar = (prefijo: string, slugs: string[] = []) => slugs.forEach((slug) => rutas.add(`${prefijo}${slug}`));

  switch (cambio.tipo) {
    case 'articulo':
      agregar('/blog/', cambio.slugs);
      rutas.add('/blog');
      PAGINAS_DEL_BLOG.forEach((ruta) => rutas.add(ruta));
      agregar('/blog/categoria/', cambio.categorias);
      agregar('/blog/etiqueta/', cambio.etiquetas);
      rutas.add('/');
      rutas.add('/sitemap.xml');
      rutas.add('/rss.xml');
      break;
    case 'categoria':
    case 'etiqueta':
      agregar(`/blog/${cambio.tipo}/`, cambio.slugs);
      rutas.add('/blog');
      rutas.add('/sitemap.xml');
      break;
    case 'autor':
      agregar('/blog/', cambio.slugs);
      rutas.add('/blog');
      break;
  }
  return [...rutas];
}
