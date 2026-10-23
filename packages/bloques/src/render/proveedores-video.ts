// Proveedores de video admitidos: el reproductor, la página original y la miniatura de cada uno. Sin React: lo usan
// el renderer (`Video`) y `visibleDeDocumento`.
export const PROVEEDORES = {
  youtube: {
    nombre: 'YouTube',
    reproductor: (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
    original: (id: string) => `https://www.youtube.com/watch?v=${id}`,
    miniatura: (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  },
  vimeo: {
    nombre: 'Vimeo',
    reproductor: (id: string) => `https://player.vimeo.com/video/${id}?autoplay=1`,
    original: (id: string) => `https://vimeo.com/${id}`,
    // Vimeo no expone la miniatura sin su API: fondo liso con el título.
    miniatura: () => null,
  },
} as const;
