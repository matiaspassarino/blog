// Anchos de las imágenes optimizadas: fuente única para los componentes y para la configuración
// del servicio de imágenes de Vercel, que solo genera los anchos declarados (si no, cae en 1920
// y una tarjeta de 400 px descarga una imagen de 250 KB; T099). Sin imports de Astro: lo usa
// astro.config.mjs.

/** Fotos de contenido (tarjetas, destacada, cuerpo del artículo, hero). */
export const ANCHOS_IMAGEN = [480, 800, 1200, 1600];

/** Avatares y fotos de testimonios (1x y 2x). */
const ANCHOS_AVATAR = [48, 64, 96, 128];

/** Todos los anchos que Vercel puede generar. */
export const ANCHOS_VERCEL = [...ANCHOS_AVATAR, ...ANCHOS_IMAGEN, 1920];
